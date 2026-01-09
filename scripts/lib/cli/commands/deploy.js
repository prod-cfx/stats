import { logger } from '../../logger.js'
import { envManager } from '../../env.js'
import { confirmManager } from '../../confirm.js'

export async function handleDeploy(cli, args) {
  if (args.length > 0) {
    logger.error('deploy 命令不接受位置参数')
    logger.info('用法: ./scripts/dx deploy [环境标志]')
    logger.info('示例: ./scripts/dx deploy --dev')
    process.exitCode = 1
    return
  }

  const deployRoot = cli.commands.deploy
  if (!deployRoot) {
    logger.error('未配置 deploy 命令，无法执行数据库部署。')
    process.exitCode = 1
    return
  }

  const environment = cli.determineEnvironment()
  const envKey = cli.normalizeEnvKey(environment)
  let config = deployRoot

  if (typeof config === 'object' && !config.command) {
    const variantCandidates = buildDbVariantCandidates(envKey, environment)
    const matchedVariant = variantCandidates.find(key => config[key])
    if (matchedVariant) {
      config = config[matchedVariant]
    } else {
      const available = Object.keys(config)
        .filter(key => config[key]?.command)
        .join(', ')
      logger.error(
        `deploy 命令未提供 ${environment} 环境配置（也未找到兼容别名），命令已中止。`
      )
      if (available) {
        logger.info(`可用环境变体: ${available}`)
      }
      logger.info('请使用受支持的环境标志，例如 --dev / --staging / --prod / --test / --e2e。')
      process.exitCode = 1
      return
    }
  }

  if (!config?.command) {
    logger.error('deploy 命令配置无效：缺少可执行的 command。')
    process.exitCode = 1
    return
  }

  logger.step(`部署数据库迁移 (${environment})`)

  if (config.dangerous) {
    const confirmed = await confirmManager.confirmDatabaseOperation(
      'deploy',
      envManager.getEnvironmentDescription(environment),
      cli.flags.Y
    )
    if (!confirmed) {
      logger.info('操作已取消')
      return
    }
  }

  const extraEnv = { NX_CACHE: 'false' }
  logger.info('为数据库部署禁用 Nx 缓存: NX_CACHE=false')

  const execFlags = { ...cli.flags }
  ;['dev', 'development', 'prod', 'production', 'test', 'e2e', 'staging', 'stage'].forEach(
    key => delete execFlags[key]
  )
  if (envKey === 'prod') execFlags.prod = true
  else if (envKey === 'dev') execFlags.dev = true
  else if (envKey === 'test') execFlags.test = true
  else if (envKey === 'e2e') execFlags.e2e = true
  else if (envKey === 'staging') execFlags.staging = true

  await cli.executeCommand(
    { ...config, env: { ...(config.env || {}), ...extraEnv } },
    execFlags
  )
}

function buildDbVariantCandidates(envKey, environment) {
  const candidates = [envKey]
  if (envKey === 'dev') candidates.push('development')
  if (envKey === 'prod') candidates.push('production', 'staging')
  if (envKey === 'staging') candidates.push('prod', 'production')
  if (environment && !candidates.includes(environment)) candidates.push(environment)
  return candidates
}
