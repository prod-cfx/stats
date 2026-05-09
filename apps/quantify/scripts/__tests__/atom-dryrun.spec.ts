import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import {
  buildSentinelSql,
  executeDryrun,
  parseDryrunArgs,
  renderMarkdown,
  writeReport,
} from '../atom-dryrun'

describe('atom-dryrun', () => {
  describe('parseDryrunArgs', () => {
    it('parses required and optional args', () => {
      const args = parseDryrunArgs([
        '--atom', 'volume.threshold',
        '--executableSinceVersion', '2026.05.W02',
        '--env', 'production-readonly',
      ])
      expect(args).toEqual({
        atom: 'volume.threshold',
        executableSinceVersion: '2026.05.W02',
        env: 'production-readonly',
      })
    })

    it('defaults env to production-readonly', () => {
      const args = parseDryrunArgs(['--atom', 'x', '--executableSinceVersion', '2026.05.W02'])
      expect(args.env).toBe('production-readonly')
    })

    it('rejects missing atom', () => {
      expect(() => parseDryrunArgs(['--executableSinceVersion', '2026.05.W02'])).toThrow(/--atom/)
    })

    it('rejects malformed version (missing zero pad)', () => {
      // critic round 1 M4 修复：原 regex `/W\\d\{2\}|零填充/` 含字面量转义符，
      // 仅靠 `|零填充` 分支碰巧通过，未真正断言 W 部分。改为有效正则。
      expect(() =>
        parseDryrunArgs(['--atom', 'volume.threshold', '--executableSinceVersion', '2026.05.W2']),
      ).toThrow(/W\d\{2\}|零填充/)
    })

    it('rejects atom key that violates whitelist (critic round 1 C3)', () => {
      expect(() =>
        parseDryrunArgs(['--atom', "volume.threshold' OR 1=1 --", '--executableSinceVersion', '2026.05.W02']),
      ).toThrow(/--atom 必须匹配/)
    })

    it('rejects atom key starting with digit', () => {
      expect(() =>
        parseDryrunArgs(['--atom', '1volume', '--executableSinceVersion', '2026.05.W02']),
      ).toThrow(/--atom 必须匹配/)
    })
  })

  describe('buildSentinelSql', () => {
    it('embeds atom key with quote prefix to avoid substring false positive', () => {
      const sql = buildSentinelSql({
        atom: 'volume.threshold',
        executableSinceVersion: '2026.05.W02',
      })
      expect(sql).toContain('ILIKE \'%"key":"volume.threshold"%\'')
      expect(sql).toContain('"deployed_at_semantic_version" COLLATE "C" >= \'2026.05.W02\' COLLATE "C"')
      expect(sql).toContain('DISTINCT ON (s.strategy_instance_id)')
      expect(sql).toContain('i.status IN (\'running\', \'paused\')')
    })
  })

  describe('executeDryrun (skip path when DB unavailable)', () => {
    it('returns kind=skipped report on connection error (ECONNREFUSED)', async () => {
      const report = await executeDryrun(
        { atom: 'volume.threshold', executableSinceVersion: '2026.05.W02', env: 'unavailable' },
        () => {
          throw new Error('connect ECONNREFUSED 127.0.0.1:5432')
        },
      )
      expect(report.result.kind).toBe('skipped')
      if (report.result.kind === 'skipped') {
        expect(report.result.reason).toContain('ECONNREFUSED')
      }
    })

    it('throws non-connection errors instead of silently skipping (critic round 1 M1)', async () => {
      await expect(
        executeDryrun(
          { atom: 'volume.threshold', executableSinceVersion: '2026.05.W02', env: 'corrupt' },
          () => {
            throw new Error('column "spec_snapshot" does not exist')
          },
        ),
      ).rejects.toThrow(/column .* does not exist/)
    })
  })

  describe('renderMarkdown + writeReport', () => {
    it('renders skipped report markdown + writes both files', () => {
      const tmp = mkdtempSync(resolve(tmpdir(), 'atom-dryrun-'))
      try {
        const report = {
          atom: 'volume.threshold',
          executableSinceVersion: '2026.05.W02',
          env: 'staging-readonly',
          generatedAt: '2026-05-09T00:00:00.000Z',
          sentinelSql: 'SELECT 1;',
          result: { kind: 'skipped' as const, reason: 'no env' },
        }
        const md = renderMarkdown(report)
        expect(md).toContain('Skipped: no env')
        expect(md).toContain('```sql')
        const { jsonPath, mdPath } = writeReport(report, tmp)
        // critic round 1 Minor 6 修复：'.' 替换为 '__'，文件名中无 extension 歧义
        expect(jsonPath).toMatch(/2026-05-09-volume__threshold\.json$/)
        expect(mdPath).toMatch(/2026-05-09-volume__threshold\.md$/)
        expect(JSON.parse(readFileSync(jsonPath, 'utf-8')).atom).toBe('volume.threshold')
        expect(readFileSync(mdPath, 'utf-8')).toContain('Atom Dryrun Report')
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })
  })
})
