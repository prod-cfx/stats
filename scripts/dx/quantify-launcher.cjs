#!/usr/bin/env node

const { spawn } = require('node:child_process')

const REQUIRED_KEYS = [
  'QUANTIFY_DATABASE_URL',
  'QUANTIFY_REDIS_URL',
  'QUANTIFY_APP_SECRET',
  'QUANTIFY_JWT_SECRET',
]

const MAPPINGS = {
  QUANTIFY_PORT: 'PORT',
  QUANTIFY_DATABASE_URL: 'DATABASE_URL',
  QUANTIFY_REDIS_URL: 'REDIS_URL',
  QUANTIFY_APP_SECRET: 'APP_SECRET',
  QUANTIFY_JWT_SECRET: 'JWT_SECRET',
}

function normalizedValue(value) {
  if (value == null)
    return undefined
  const trimmed = String(value).trim()
  return trimmed === '' ? undefined : trimmed
}

function ensureAbsoluteUrl(name, value) {
  let parsed
  try {
    parsed = new URL(value)
  }
  catch {
    throw new Error(`${name} must be absolute http(s) url`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    throw new Error(`${name} must be absolute http(s) url`)
}

function ensureRedisUrl(value) {
  let parsed
  try {
    parsed = new URL(value)
  }
  catch {
    throw new Error('quantify redis url must be redis')
  }

  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:')
    throw new Error('quantify redis url must be redis')
}

function ensurePostgresUrl(value) {
  let parsed
  try {
    parsed = new URL(value)
  }
  catch {
    throw new Error('quantify database url must be postgres')
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:')
    throw new Error('quantify database url must be postgres')
}

function ensurePort(value) {
  const port = Number.parseInt(value, 10)
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('quantify port must be a valid tcp port')
}

function resolveQuantifyEnv(rawEnv) {
  const env = { ...rawEnv }

  const quantifyDatabaseUrl = normalizedValue(env.QUANTIFY_DATABASE_URL)
  if (!quantifyDatabaseUrl)
    throw new Error('quantify database url is required')
  ensurePostgresUrl(quantifyDatabaseUrl)

  const quantifyRedisUrl = normalizedValue(env.QUANTIFY_REDIS_URL)
  if (!quantifyRedisUrl)
    throw new Error('quantify redis url is required')
  ensureRedisUrl(quantifyRedisUrl)

  for (const key of REQUIRED_KEYS) {
    if (!normalizedValue(env[key])) {
      const target = MAPPINGS[key]
      throw new Error(`${target} is required for quantify`)
    }
  }

  const quantifyPort = normalizedValue(env.QUANTIFY_PORT)
  if (quantifyPort)
    ensurePort(quantifyPort)

  const quantifyBaseUrl = normalizedValue(env.QUANTIFY_BASE_URL)
  if (quantifyBaseUrl)
    ensureAbsoluteUrl('quantify base url', quantifyBaseUrl)

  const backendDatabaseUrl = normalizedValue(env.DATABASE_URL)
  if (backendDatabaseUrl && backendDatabaseUrl === quantifyDatabaseUrl)
    throw new Error('quantify database must not equal backend database')

  for (const [sourceKey, targetKey] of Object.entries(MAPPINGS)) {
    const sourceValue = normalizedValue(env[sourceKey])
    if (sourceValue)
      env[targetKey] = sourceValue
  }

  return env
}

function run() {
  const args = process.argv.slice(2)
  const env = resolveQuantifyEnv(process.env)
  const child = spawn(args[0], args.slice(1), {
    stdio: 'inherit',
    shell: false,
    env,
  })

  child.on('error', (err) => {
    console.error(err?.message || String(err))
    process.exit(1)
  })

  child.on('exit', (code, signal) => {
    if (typeof code === 'number')
      process.exit(code)
    process.exit(signal ? 1 : 0)
  })
}

module.exports = {
  resolveQuantifyEnv,
}

if (require.main === module)
  run()
