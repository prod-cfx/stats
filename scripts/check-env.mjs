#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const workspaceRoot = resolve(new URL('.', import.meta.url).pathname, '..')
const PLACEHOLDER = '__SET_IN_env.local__'
const REQUIRED_ENV_FILES = [
  '.env.development',
  '.env.staging',
  '.env.production',
  '.env.e2e',
]
const LOCAL_ENV_FILES = ['.env.development.local', '.env.e2e.local']

const readEnvFile = async file => {
  const content = await readFile(resolve(workspaceRoot, file), 'utf-8')
  return content
    .split('\n')
    .filter(Boolean)
    .filter(line => !line.trim().startsWith('#'))
    .map(line => line.split('='))
    .reduce((acc, [key, ...value]) => {
      if (!key) return acc
      acc[key.trim()] = value.join('=').trim()
      return acc
    }, {})
}

const ensureAppEnv = (file, data) => {
  if (!('APP_ENV' in data)) {
    throw new Error(`${file} 缺少 APP_ENV`)
  }
  if (file.startsWith('.env.') && !file.endsWith('.local')) {
    const envName = file.replace('.env.', '')
    if (data.APP_ENV !== envName) {
      throw new Error(`${file} 的 APP_ENV=${data.APP_ENV} 与文件名不一致`)
    }
  }
}

const ensureExampleOnlyContainsPlaceholders = (file, data) => {
  const invalid = Object.entries(data).filter(([, value]) => value && value !== PLACEHOLDER)
  if (invalid.length > 0) {
    throw new Error(
      `${file} 中存在非占位值：${invalid.map(([key]) => key).join(', ')}`,
    )
  }
}

const ensureLocalFilesHaveNoPlaceholders = (file, data) => {
  const pending = Object.entries(data).filter(([, value]) => value === PLACEHOLDER)
  if (pending.length > 0) {
    console.warn(
      `⚠️  ${file} 存在占位符字段：${pending
        .map(([key]) => key)
        .join(', ')}（本地示例文件可忽略，此提示仅供提醒）`,
    )
  }
}

const main = async () => {
  const example = await readEnvFile('.env.example')
  ensureExampleOnlyContainsPlaceholders('.env.example', example)

  for (const file of REQUIRED_ENV_FILES) {
    const data = await readEnvFile(file)
    ensureAppEnv(file, data)
  }

  for (const file of LOCAL_ENV_FILES) {
    try {
      const data = await readEnvFile(file)
      ensureLocalFilesHaveNoPlaceholders(file, data)
    } catch {
      // 允许缺失 local 文件
    }
  }

  console.log('✅ 环境变量文件检查通过')
}

main().catch(error => {
  console.error('❌ 环境变量检查失败：', error.message)
  process.exitCode = 1
})

