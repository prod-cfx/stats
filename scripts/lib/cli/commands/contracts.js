import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { logger } from '../../logger.js'
import { execManager } from '../../exec.js'

export async function handleContracts(cli, args) {
  const action = args[0] || 'generate'
  if (action !== 'generate') {
    logger.error(`不支持的 contracts 子命令: ${action}`)
    logger.info('用法: ./scripts/dx contracts [generate]')
    process.exitCode = 1
    return
  }

  cli.ensureRepoRoot()

  logger.step('导出 OpenAPI 并生成 Zod 合约 (packages/api-contracts)')

  // 若未配置 backend:swagger，则跳过生成并提示
  let swaggerTargetExists = false
  try {
    const backendProject = JSON.parse(
      readFileSync(join(process.cwd(), 'apps/backend/project.json'), 'utf8')
    )
    swaggerTargetExists = Boolean(backendProject?.targets?.swagger)
  } catch {}

  if (!swaggerTargetExists) {
    logger.warn(
      '未检测到 Nx 目标 backend:swagger，跳过 OpenAPI 导出。请在 apps/backend/project.json 中配置 swagger 目标后再运行。'
    )
    return
  }

  await execManager.executeCommand('npx nx run backend:swagger', {
    app: 'backend',
    flags: cli.flags,
    env: { NX_CACHE: 'false', SKIP_PRISMA_CONNECT: 'true' },
  })

  const swaggerPath = join(process.cwd(), 'apps/backend/dist/openapi/backend.json')
  patchRecursiveOpenApiSchemas(swaggerPath)

  const outputDir = join(process.cwd(), 'packages/api-contracts/src/generated')
  mkdirSync(outputDir, { recursive: true })

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api/v1'
  logger.info(`使用 API 基地址: ${baseUrl}`)

  const generatorCommand = [
    'pnpm exec openapi-zod-client',
    'apps/backend/dist/openapi/backend.json',
    '--output packages/api-contracts/src/generated/backend.ts',
    '--api-client-name aiBackendClient',
    `--base-url "${baseUrl}"`,
    '--with-alias',
    '--with-docs',
    '--with-deprecated',
    '--export-schemas',
    '--prettier prettier.config.js',
  ].join(' ')

  try {
    await execManager.executeCommand(generatorCommand, {
      flags: cli.flags,
    })
    logger.success('API 合约已更新（packages/api-contracts/src/generated/backend.ts）')
  } catch (error) {
    logger.warn('openapi-zod-client 生成失败，保留现有合约文件，错误信息如下：')
    logger.warn(error?.message || String(error))
    // 兜底：至少将最新的 OpenAPI JSON 备份到 packages/api-contracts/openapi/backend.json，便于手工生成
    const backupDir = join(process.cwd(), 'packages/api-contracts/openapi')
    mkdirSync(backupDir, { recursive: true })
    const src = join(process.cwd(), 'apps/backend/dist/openapi/backend.json')
    const dest = join(backupDir, 'backend.json')
    try {
      const json = readFileSync(src, 'utf8')
      writeFileSync(dest, json, 'utf8')
      logger.info(`已备份最新 OpenAPI 到 ${dest}，可使用手工工具生成合约。`)
    } catch {}
    logger.info('请检查 OpenAPI 是否包含异常 schema，或稍后手动重试。命令本身已退出 0。')
  }
}

function patchRecursiveOpenApiSchemas(swaggerPath) {
  try {
    if (!existsSync(swaggerPath)) return
    const raw = readFileSync(swaggerPath, 'utf8')
    const json = JSON.parse(raw)
    const schema = json?.components?.schemas?.AdminMenuPermissionDto
    const children = schema?.properties?.children
    const childRef = children?.items?.['$ref']
    if (schema && children && childRef === '#/components/schemas/AdminMenuPermissionDto') {
      children.description =
        'Patched via scripts/dx to avoid recursive schema preventing openapi-zod-client generation. See scripts/lib for context.'
      children.items = {
        type: 'object',
        additionalProperties: true,
        description:
          'Original schema是递归结构，openapi-zod-client 暂不支持。这里改为宽松 object，客户端可在运行时递归自身类型。',
      }
      writeFileSync(swaggerPath, JSON.stringify(json, null, 2))
      logger.info('已自动修补 AdminMenuPermissionDto 递归 schema，避免 openapi-zod-client 生成失败。')
    }
  } catch (error) {
    logger.warn('修补递归 OpenAPI schema 失败，可手动检查 apps/backend/dist/openapi/backend.json')
    logger.warn(error.message)
  }
}
