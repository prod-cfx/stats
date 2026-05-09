/**
 * atom-dryrun — Phase 1/2/4 atom 翻牌前的现存策略影响 dry-run（#1043）
 *
 * 用法：
 *   pnpm --filter quantify exec ts-node scripts/atom-dryrun.ts \
 *     --atom volume.threshold \
 *     --executableSinceVersion 2026.05.W02 \
 *     --env production-readonly
 *
 * 行为：
 *   1. 按参数生成 sentinel SQL（JOIN published_strategy_snapshots 取每 instance latest spec_snapshot）
 *   2. 若指定 env 的 DATABASE_URL 可连：执行 SQL，写真实计数
 *   3. 若不可连（如本地未配置 production-readonly）：输出 SQL + 空骨架报告 + 警告
 *   4. JSON + Markdown 报告写入 docs/ai-quant/dryrun-reports/<YYYY-MM-DD>-<atom>.{json,md}
 *
 * Sentinel SQL 来自 plan：docs/superpowers/plans/2026-05-08-ai-quant-984-phase1-2-4-nl-gateway-multi-pr.md
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { PrismaClient } from '../generated/prisma'

interface DryrunArgs {
  atom: string
  executableSinceVersion: string
  env: string
}

interface DryrunReport {
  atom: string
  executableSinceVersion: string
  env: string
  generatedAt: string
  sentinelSql: string
  result:
    | {
        kind: 'ok'
        activeInstances: number
        containingAtom: number
        legacyKeepOldBehavior: number
        newUseNewBehavior: number
      }
    | {
        kind: 'skipped'
        reason: string
      }
}

const VERSION_FORMAT = /^\d{4}\.\d{2}\.W\d{2}$/
// atom key 白名单，规避 SQL injection（critic round 1 C3 修复）。允许 a-z 0-9 . _ 段，
// 必须以小写字母开头。覆盖 supported atom 命名空间（如 volume.threshold / risk.atr_take_profit）。
const ATOM_KEY_FORMAT = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/

export function parseDryrunArgs(argv: string[]): DryrunArgs {
  const args: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg && arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        args[key] = next
        i++
      }
    }
  }

  if (!args.atom) {
    throw new Error('atom-dryrun: --atom <atom_key> 必填')
  }
  if (!ATOM_KEY_FORMAT.test(args.atom)) {
    throw new Error(
      `atom-dryrun: --atom 必须匹配 ${ATOM_KEY_FORMAT}（小写字母开头，仅允许 a-z 0-9 _ . 分隔），收到：${args.atom}`,
    )
  }
  if (!args.executableSinceVersion) {
    throw new Error('atom-dryrun: --executableSinceVersion <YYYY.MM.Wnn> 必填')
  }
  if (!VERSION_FORMAT.test(args.executableSinceVersion)) {
    throw new Error(
      `atom-dryrun: --executableSinceVersion 必须匹配 ${VERSION_FORMAT}（零填充周序号），收到：${args.executableSinceVersion}`,
    )
  }

  return {
    atom: args.atom,
    executableSinceVersion: args.executableSinceVersion,
    env: args.env ?? 'production-readonly',
  }
}

export function buildSentinelSql(args: Pick<DryrunArgs, 'atom' | 'executableSinceVersion'>): string {
  // 双重防御（critic round 1 C3 / round 2 M2 / M7）：
  // - atom 已在 parseDryrunArgs 经 ATOM_KEY_FORMAT 白名单校验（仅 a-z 0-9 _ .）
  // - executableSinceVersion 已经 VERSION_FORMAT 校验
  // - "key":"<atom>" 加双引号 + key 前缀规避子串误匹配
  // - COLLATE "C" 强制 binary 字典序，与 helper compareSemanticVersion 对齐
  return `
WITH latest_snapshot AS (
  SELECT DISTINCT ON (s.strategy_instance_id)
    s.strategy_instance_id,
    s.spec_snapshot,
    s.created_at AS snapshot_created_at
  FROM "published_strategy_snapshots" s
  WHERE s.strategy_instance_id IS NOT NULL
  ORDER BY s.strategy_instance_id, s.created_at DESC
)
SELECT
  count(*)                                                  AS active_instances,
  count(*) FILTER (
    WHERE ls.spec_snapshot::text ILIKE '%"key":"${args.atom}"%'
  )                                                         AS containing_atom,
  count(*) FILTER (
    WHERE ls.spec_snapshot::text ILIKE '%"key":"${args.atom}"%'
      AND i."deployed_at_semantic_version" IS NULL
  )                                                         AS legacy_keep_old_behavior,
  count(*) FILTER (
    WHERE ls.spec_snapshot::text ILIKE '%"key":"${args.atom}"%'
      AND i."deployed_at_semantic_version" COLLATE "C" >= '${args.executableSinceVersion}' COLLATE "C"
  )                                                         AS new_use_new_behavior
FROM "llm_strategy_instances" i
LEFT JOIN latest_snapshot ls ON ls.strategy_instance_id = i.id
WHERE i.status IN ('running', 'paused');
`.trim()
}

export async function executeDryrun(
  args: DryrunArgs,
  prismaFactory: () => PrismaClient = () => new PrismaClient(),
): Promise<DryrunReport> {
  const sentinelSql = buildSentinelSql(args)
  const generatedAt = new Date().toISOString()

  let prisma: PrismaClient | null = null
  try {
    prisma = prismaFactory()
    const rows = await prisma.$queryRawUnsafe<Array<{
      active_instances: bigint
      containing_atom: bigint
      legacy_keep_old_behavior: bigint
      new_use_new_behavior: bigint
    }>>(sentinelSql)
    const row = rows[0]!
    return {
      atom: args.atom,
      executableSinceVersion: args.executableSinceVersion,
      env: args.env,
      generatedAt,
      sentinelSql,
      result: {
        kind: 'ok',
        activeInstances: Number(row.active_instances),
        containingAtom: Number(row.containing_atom),
        legacyKeepOldBehavior: Number(row.legacy_keep_old_behavior),
        newUseNewBehavior: Number(row.new_use_new_behavior),
      },
    }
  } catch (error) {
    // critic round 1 M1 修复：仅把"无法连接"类错误降级为 skipped；
    // 其他 SQL/schema/权限错误抛出让 main() 以非 0 退出，避免 CI 误判 dryrun 通过。
    const message = (error as Error).message ?? ''
    const isConnectionError = /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|connect.*fail|database.*does not exist|environment variable not found/i.test(message)
    if (!isConnectionError) {
      throw error
    }
    return {
      atom: args.atom,
      executableSinceVersion: args.executableSinceVersion,
      env: args.env,
      generatedAt,
      sentinelSql,
      result: {
        kind: 'skipped',
        reason: `cannot execute against ${args.env}: ${message}`,
      },
    }
  } finally {
    if (prisma) {
      await prisma.$disconnect().catch(() => undefined)
    }
  }
}

export function renderMarkdown(report: DryrunReport): string {
  const lines: string[] = [
    `# Atom Dryrun Report — ${report.atom}`,
    '',
    `- **Generated**: ${report.generatedAt}`,
    `- **Environment**: ${report.env}`,
    `- **executableSinceVersion**: ${report.executableSinceVersion}`,
    '',
    '## Result',
    '',
  ]
  if (report.result.kind === 'ok') {
    lines.push(
      '| Metric | Count | Review |',
      '|---|---|---|',
      `| active_instances (running + paused) | ${report.result.activeInstances} | - |`,
      `| containing_atom | ${report.result.containingAtom} | - |`,
      `| legacy_keep_old_behavior (deployed_at IS NULL) | ${report.result.legacyKeepOldBehavior} | ✅ 保留旧行为 |`,
      `| new_use_new_behavior (deployed_at >= since) | ${report.result.newUseNewBehavior} | ${report.result.newUseNewBehavior > 0 ? '⚠️ 列出每个 instance ID + @owner review' : '✅'} |`,
    )
  } else {
    lines.push(`> ⚠️ Skipped: ${report.result.reason}`)
    lines.push('')
    lines.push('Sentinel SQL 已生成；待 production-readonly 连接就绪后人工执行。')
  }
  lines.push('', '## Sentinel SQL', '', '```sql', report.sentinelSql, '```', '')
  return lines.join('\n')
}

export function writeReport(report: DryrunReport, baseDir: string): { jsonPath: string; mdPath: string } {
  const date = report.generatedAt.slice(0, 10)
  // critic round 1 Minor 6 修复：'.' 也替换为 '__'，避免文件名中 atom.key 与 .json/.md
  // extension 混淆（如 volume.threshold.json 无法清晰识别 atom 边界）。
  const fileBase = `${date}-${report.atom.replace(/[^a-z0-9]/gi, '__')}`
  const jsonPath = resolve(baseDir, `${fileBase}.json`)
  const mdPath = resolve(baseDir, `${fileBase}.md`)
  if (!existsSync(dirname(jsonPath))) {
    mkdirSync(dirname(jsonPath), { recursive: true })
  }
  writeFileSync(jsonPath, JSON.stringify(report, null, 2))
  writeFileSync(mdPath, renderMarkdown(report))
  return { jsonPath, mdPath }
}

async function main(): Promise<void> {
  const args = parseDryrunArgs(process.argv.slice(2))
  const report = await executeDryrun(args)
  const baseDir = resolve(__dirname, '../../../docs/ai-quant/dryrun-reports')
  const { jsonPath, mdPath } = writeReport(report, baseDir)
  // eslint-disable-next-line no-console -- 脚本入口需要 stdout 反馈
  console.log(`atom-dryrun report written:\n  ${jsonPath}\n  ${mdPath}`)
  if (report.result.kind === 'skipped') {
    // eslint-disable-next-line no-console
    console.warn(`warning: ${report.result.reason}`)
  }
}

if (require.main === module) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(`atom-dryrun failed: ${(error as Error).message}`)
    process.exit(1)
  })
}
