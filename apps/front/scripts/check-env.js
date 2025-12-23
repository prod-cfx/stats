#!/usr/bin/env node

/**
 * 环境变量检查脚本（apps/front）
 *
 * 在构建前检查必要的环境变量是否已配置。
 * 前端只需要知道「网关入口」而不是后端直连地址，因此以
 * NEXT_PUBLIC_API_BASE_URL 作为唯一必需的后端 API 基础地址
 *（通常形如：https://api.example.com/api/v1）。
 *
 * 注意：旧的 NEXT_PUBLIC_API_SERVER_URL 视为兼容字段，不再强制要求。
 */

// 必需的环境变量：
// - NEXT_PUBLIC_API_BASE_URL: 完整的 API 基础地址（指向网关），通常包含 /api/v1 前缀
// - APP_ENV / NEXT_PUBLIC_APP_ENV: 用于区分环境，前后端需保持一致
const requiredEnvVars = ['NEXT_PUBLIC_API_BASE_URL', 'APP_ENV', 'NEXT_PUBLIC_APP_ENV']

console.log('检查环境变量配置...')

// 检查环境变量是否存在
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])

// 如果有缺失的环境变量，则输出错误信息并退出
if (missingEnvVars.length > 0) {
  console.error('\x1B[31m%s\x1B[0m', '错误: 以下必要的环境变量未配置:')
  missingEnvVars.forEach(envVar => {
    console.error('\x1B[33m%s\x1B[0m', `  - ${envVar}`)
  })
  console.error('\x1B[31m%s\x1B[0m', '请确保在根目录的环境变量文件中配置这些变量。')
  console.error('\x1B[36m%s\x1B[0m', '提示: 在 monorepo 中，环境变量由根目录的启动命令统一加载')
  process.exit(1)
}

// 检查 APP_ENV 的值是否合法
const validAppEnvValues = ['dev', 'development', 'production', 'test', 'local', 'e2e']
const appEnv = process.env.APP_ENV
if (!validAppEnvValues.includes(appEnv)) {
  console.error('\x1B[31m%s\x1B[0m', '错误: APP_ENV 的值必须是以下之一:')
  console.error('\x1B[33m%s\x1B[0m', `  - ${validAppEnvValues.join(', ')}`)
  console.error('\x1B[31m%s\x1B[0m', `当前值: ${appEnv}`)
  process.exit(1)
}

// 确保客户端可用环境与服务端一致
if (process.env.NEXT_PUBLIC_APP_ENV !== appEnv) {
  console.error('\x1B[31m%s\x1B[0m', '错误: NEXT_PUBLIC_APP_ENV 必须与 APP_ENV 保持一致')
  console.error(
    '\x1B[33m%s\x1B[0m',
    `  - APP_ENV=${appEnv}  NEXT_PUBLIC_APP_ENV=${process.env.NEXT_PUBLIC_APP_ENV}`,
  )
  process.exit(1)
}

// 如果是生产环境，检查 API URL 不能包含 localhost 或 127.0.0.1
// 但需要区分真正的生产部署和本地构建测试
if (appEnv === 'production') {
  const apiUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || '').toLowerCase()
  const isLocalBuild = apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')

  // 检查是否是真正的生产环境部署
  // 如果设置了 VERCEL、NETLIFY、CI 等环境变量，说明是真正的生产部署
  const isRealProduction =
    process.env.VERCEL ||
    process.env.NETLIFY ||
    process.env.CI === 'true' ||
    process.env.APP_ENV_STAGE === 'production'

  if (isRealProduction && isLocalBuild) {
    console.error(
      '\x1B[31m%s\x1B[0m',
      '错误: 在生产环境部署中，NEXT_PUBLIC_API_SERVER_URL 不能包含 localhost 或 127.0.0.1',
    )
    console.error('\x1B[33m%s\x1B[0m', `当前值: ${process.env.NEXT_PUBLIC_API_SERVER_URL}`)
    console.error('\x1B[36m%s\x1B[0m', '提示: 请设置正确的生产环境 API 地址')
    process.exit(1)
  } else if (isLocalBuild) {
    console.warn('\x1B[33m%s\x1B[0m', '⚠️  检测到本地构建测试，允许使用 localhost API 地址')
  }
}

// 验证 NEXT_PUBLIC_LOG_LEVEL 合法性（可选变量）
const validLogLevels = ['SILLY', 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']
if (process.env.NEXT_PUBLIC_LOG_LEVEL) {
  const logLevel = process.env.NEXT_PUBLIC_LOG_LEVEL.toUpperCase()
  if (!validLogLevels.includes(logLevel)) {
    console.error('\x1B[31m%s\x1B[0m', '错误: NEXT_PUBLIC_LOG_LEVEL 必须是以下之一:')
    validLogLevels.forEach(level => console.error(`  - ${level}`))
    console.error('\x1B[33m%s\x1B[0m', `当前值: ${process.env.NEXT_PUBLIC_LOG_LEVEL}`)
    console.error('\x1B[36m%s\x1B[0m', '提示: 如果不设置此变量，将使用环境默认值（开发: DEBUG, 生产: WARN）')
    process.exit(1)
  }
  console.log('\x1B[32m%s\x1B[0m', `✓ 日志级别设置为: ${logLevel}`)
} else {
  console.info('\x1B[36m%s\x1B[0m', `ℹ  未设置 NEXT_PUBLIC_LOG_LEVEL，将使用环境默认值（${appEnv === 'production' ? 'WARN' : 'DEBUG'}）`)
}

console.log('\x1B[32m%s\x1B[0m', '✓ 所有环境变量检查通过')
