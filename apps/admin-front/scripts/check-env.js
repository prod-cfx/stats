#!/usr/bin/env node

/**
 * Next 版管理后台环境变量检查
 */

const requiredEnvVars = ['NEXT_PUBLIC_API_BASE_URL', 'APP_ENV']

console.log('检查环境变量配置 (admin-front)...')

const missingEnvVars = requiredEnvVars.filter(key => !process.env[key])
if (missingEnvVars.length) {
  console.error('\x1B[31m%s\x1B[0m', '错误: 以下必要环境变量未配置:')
  missingEnvVars.forEach(key => console.error('\x1B[33m%s\x1B[0m', `  - ${key}`))
  process.exit(1)
}

const validAppEnvs = ['dev', 'development', 'production', 'test', 'local', 'e2e']
if (!validAppEnvs.includes(process.env.APP_ENV)) {
  console.error('\x1B[31m%s\x1B[0m', '错误: APP_ENV 值异常')
  process.exit(1)
}

console.log('\x1B[32m%s\x1B[0m', '✓ admin-front 环境变量检查通过')
