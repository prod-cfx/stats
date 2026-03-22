import { execFileSync } from 'node:child_process'
import * as crypto from 'node:crypto'
import * as path from 'node:path'

// 控制 E2E 日志详细程度，默认关闭，仅在 E2E_VERBOSE_LOG=true 时输出详细日志
const E2E_VERBOSE_LOG = process.env.E2E_VERBOSE_LOG === 'true'
const logVerbose = (...args: unknown[]) => {
  if (E2E_VERBOSE_LOG) console.log(...args)
}

// 全局存储当前测试使用的数据库名称
let currentTestDatabase: string | null = null
let originalDatabaseUrl: string | null = null

const backendDir = path.resolve(__dirname, '..')

/**
 * 转义 SQL 标识符（表名、列名、数据库名等）
 * 使用双引号包裹并转义内部双引号
 */
function escapeIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`
}

/**
 * 转义 SQL 字符串常量
 * 使用单引号包裹并转义内部单引号
 */
function escapeLiteral(literal: string): string {
  return `'${literal.replace(/'/g, "''")}'`
}

/**
 * 生成唯一的测试数据库名称
 * 格式: test_db_YYYYMMDDHHmmss_<12-char-hex>
 */
function generateTestDatabaseName(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.]/g, '')
    .slice(0, 14)
  const randomId = crypto.randomBytes(6).toString('hex')
  return `test_db_${timestamp}_${randomId}`
}

/**
 * 从 DATABASE_URL 中提取连接参数
 */
function parseDatabaseUrl(dbUrl: string): {
  host: string
  port: string
  database: string
  username: string
  password: string
  baseUrl: string
  originalUrl: string
} {
  try {
    const url = new URL(dbUrl)
    const host = url.hostname
    const port = url.port || '5432'
    const database = url.pathname.slice(1)
    const username = url.username
    const password = url.password

    const baseUrlObj = new URL(dbUrl)
    baseUrlObj.pathname = '/postgres'
    const baseUrl = baseUrlObj.toString()

    return { host, port, database, username, password, baseUrl, originalUrl: url.toString() }
  } catch (error) {
    throw new Error(`无效的 DATABASE_URL 格式: ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * 构建指向指定数据库的 URL
 */
function buildDatabaseUrl(baseUrl: string, database: string): string {
  const url = new URL(baseUrl)
  url.pathname = `/${database}`
  return url.toString()
}

/**
 * 通过 execFileSync + Node.js 内联脚本 + pg 客户端执行 SQL
 * 不依赖系统 psql，CI 兼容性好
 */
function executePgCommand(connectionUrl: string, sql: string, silent = false): string {
  try {
    const pgScript = `
      const { Client } = require('pg')
      ;(async () => {
        const [connectionString, sqlCmd] = process.argv.slice(1)
        const client = new Client({ connectionString })
        await client.connect()
        const result = await client.query(sqlCmd)
        if (result.rows && result.rows.length > 0) {
          if (result.fields.length === 1) {
            const fieldName = result.fields[0].name
            for (const row of result.rows) {
              const value = row[fieldName]
              if (value !== null && value !== undefined) {
                console.log(String(value))
              } else {
                console.log('')
              }
            }
          } else {
            console.log(JSON.stringify(result.rows))
          }
        }
        await client.end()
      })().catch(async (error) => {
        try {
          if (error && error.message) {
            console.error(error.message)
          } else {
            console.error(String(error))
          }
        } finally {
          process.exit(1)
        }
      })
    `

    return execFileSync(process.execPath, ['-e', pgScript, connectionUrl, sql], {
      stdio: silent ? 'pipe' : 'inherit',
      encoding: 'utf-8',
      cwd: backendDir,
    })
  } catch (error) {
    throw new Error(`执行 PostgreSQL 命令失败: ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * 检查数据库 CREATE DATABASE 权限
 */
function checkDatabasePermissions(baseUrl: string): boolean {
  try {
    const testDbName = `test_permission_check_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    executePgCommand(baseUrl, `DROP DATABASE IF EXISTS ${escapeIdentifier(testDbName)}`, true)
    executePgCommand(baseUrl, `CREATE DATABASE ${escapeIdentifier(testDbName)}`, true)
    executePgCommand(baseUrl, `DROP DATABASE ${escapeIdentifier(testDbName)}`, true)
    return true
  } catch (error) {
    console.error('[E2E setup] 数据库权限检查失败:', error instanceof Error ? error.message : error)
    return false
  }
}

/**
 * 清理超过指定时间的历史数据库
 * 仅在 E2E_CLEANUP_OLD_RESOURCES=true 时启用
 */
function cleanupOldDatabases(baseUrl: string, maxAgeHours = 24): void {
  if (process.env.E2E_CLEANUP_OLD_RESOURCES !== 'true') {
    logVerbose('[E2E setup] 历史数据库清理已禁用 (E2E_CLEANUP_OLD_RESOURCES != true)')
    return
  }

  try {
    console.log(`[E2E setup] 开始清理超过 ${maxAgeHours} 小时的历史 test_db_* ...`)

    const result = executePgCommand(
      baseUrl,
      "SELECT datname FROM pg_database WHERE datname LIKE 'test_db_%'",
      true,
    )

    const databases = result
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.startsWith('test_db_'))

    if (databases.length === 0) {
      console.log('[E2E setup] 没有找到需要清理的历史数据库')
      return
    }

    console.log(`[E2E setup] 发现 ${databases.length} 个历史 test_db_*`)

    let cleanedCount = 0
    let skippedCount = 0

    for (const dbName of databases) {
      try {
        const match = dbName.match(/^test_db_(\d{14})_[a-f0-9]+$/)
        if (!match) {
          logVerbose(`[E2E setup] 跳过数据库 ${dbName} (格式不匹配)`)
          skippedCount++
          continue
        }

        const timestampStr = match[1]
        const dbTimestamp = new Date(
          `${timestampStr.slice(0, 4)}-${timestampStr.slice(4, 6)}-${timestampStr.slice(6, 8)}T${timestampStr.slice(8, 10)}:${timestampStr.slice(10, 12)}:${timestampStr.slice(12, 14)}Z`,
        )

        if (Number.isNaN(dbTimestamp.getTime())) {
          logVerbose(`[E2E setup] 跳过数据库 ${dbName} (时间戳解析失败)`)
          skippedCount++
          continue
        }

        const ageHours = (Date.now() - dbTimestamp.getTime()) / (1000 * 60 * 60)

        if (ageHours < maxAgeHours) {
          logVerbose(
            `[E2E setup] 跳过数据库 ${dbName} (仅 ${ageHours.toFixed(1)} 小时,未超过 ${maxAgeHours} 小时)`,
          )
          skippedCount++
          continue
        }

        const activeConnsResult = executePgCommand(
          baseUrl,
          `SELECT COUNT(*) FROM pg_stat_activity WHERE datname = ${escapeLiteral(dbName)}`,
          true,
        )
        const activeConns = Number.parseInt(activeConnsResult.trim())

        if (activeConns > 0) {
          logVerbose(
            `[E2E setup] 跳过数据库 ${dbName} (有 ${activeConns} 个活动连接,可能正在测试中)`,
          )
          skippedCount++
          continue
        }

        executePgCommand(baseUrl, `DROP DATABASE IF EXISTS ${escapeIdentifier(dbName)}`, true)
        logVerbose(`[E2E setup] 已清理数据库 ${dbName} (年龄: ${ageHours.toFixed(1)} 小时)`)
        cleanedCount++
      } catch (error) {
        console.warn(
          `[E2E setup] 清理数据库 ${dbName} 失败:`,
          error instanceof Error ? error.message : error,
        )
      }
    }

    console.log(
      `[E2E setup] 清理完成: 成功 ${cleanedCount} 个, 跳过 ${skippedCount} 个, 总计 ${databases.length} 个`,
    )
  } catch (error) {
    console.warn(
      '[E2E setup] 清理历史数据库失败(忽略):',
      error instanceof Error ? error.message : error,
    )
  }
}

/**
 * 清理 E2E 测试产生的 Redis keys
 * 使用 SCAN + DEL 按前缀模式删除，避免阻塞 Redis
 */
function cleanupRedisKeys(dbName: string): void {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    logVerbose('[E2E teardown] 未配置 REDIS_URL，跳过 Redis 清理')
    return
  }

  const prefixes = [
    `e2e:${dbName}:cache:*`,
    `e2e:${dbName}:*`,
    `throttle:*:e2e:${dbName}::*`,
  ]

  const cleanScript = `
    const Redis = require('ioredis')
    ;(async () => {
      const [connectionUrl, ...patterns] = process.argv.slice(1)
      const redis = new Redis(connectionUrl, { lazyConnect: true, maxRetriesPerRequest: 1 })
      await redis.connect()
      let totalDeleted = 0
      for (const pattern of patterns) {
        let cursor = '0'
        do {
          const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200)
          cursor = nextCursor
          if (keys.length > 0) {
            await redis.del(...keys)
            totalDeleted += keys.length
          }
        } while (cursor !== '0')
      }
      console.log('[E2E teardown] Redis 清理完成: 删除 ' + totalDeleted + ' 个 keys')
      await redis.quit()
    })().catch(async (err) => {
      console.error('[E2E teardown] Redis 清理失败(忽略):', err.message || err)
      process.exit(0)
    })
  `

  try {
    execFileSync(process.execPath, ['-e', cleanScript, redisUrl, ...prefixes], {
      stdio: 'inherit',
      cwd: backendDir,
      timeout: 10000,
    })
  } catch (error) {
    console.warn(
      '[E2E teardown] Redis 清理异常(忽略):',
      error instanceof Error ? error.message : error,
    )
  }
}

/**
 * 启动时清理历史残留的 E2E Redis keys
 * 仅在 E2E_CLEANUP_OLD_RESOURCES=true 且 REDIS_URL 已配置时执行
 */
function cleanupOldRedisKeys(maxAgeHours = 24): void {
  if (process.env.E2E_CLEANUP_OLD_RESOURCES !== 'true') {
    return
  }

  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    return
  }

  const cleanScript = `
    const Redis = require('ioredis')
    ;(async () => {
      const [connectionUrl, maxAgeHoursStr] = process.argv.slice(1)
      const maxAge = Number(maxAgeHoursStr) || 24
      const redis = new Redis(connectionUrl, { lazyConnect: true, maxRetriesPerRequest: 1 })
      await redis.connect()

      const patterns = ['e2e:test_db_*', 'throttle:*:e2e:test_db_*']
      let totalDeleted = 0

      for (const pattern of patterns) {
        let cursor = '0'
        do {
          const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200)
          cursor = nextCursor
          const expiredKeys = keys.filter(key => {
            const match = key.match(/test_db_(\\d{14})_[a-f0-9]+/)
            if (!match) return false
            const ts = match[1]
            const d = new Date(
              ts.slice(0,4)+'-'+ts.slice(4,6)+'-'+ts.slice(6,8)+
              'T'+ts.slice(8,10)+':'+ts.slice(10,12)+':'+ts.slice(12,14)+'Z'
            )
            if (isNaN(d.getTime())) return false
            return (Date.now() - d.getTime()) / 3600000 > maxAge
          })
          if (expiredKeys.length > 0) {
            await redis.del(...expiredKeys)
            totalDeleted += expiredKeys.length
          }
        } while (cursor !== '0')
      }

      if (totalDeleted > 0) {
        console.log('[E2E setup] 清理历史 Redis keys: 删除 ' + totalDeleted + ' 个')
      }
      await redis.quit()
    })().catch((err) => {
      console.warn('[E2E setup] 清理历史 Redis keys 失败(忽略):', err.message || err)
      process.exit(0)
    })
  `

  try {
    execFileSync(process.execPath, ['-e', cleanScript, redisUrl, String(maxAgeHours)], {
      stdio: 'inherit',
      cwd: backendDir,
      timeout: 15000,
    })
  } catch (error) {
    console.warn(
      '[E2E setup] 清理历史 Redis keys 异常(忽略):',
      error instanceof Error ? error.message : error,
    )
  }
}

/**
 * 创建测试数据库并运行迁移 + 种子
 */
function setupTestDatabase(baseUrl: string, dbName: string, originalDbUrl: string): void {
  try {
    console.log(`[E2E setup] 创建测试数据库: ${dbName}`)

    executePgCommand(baseUrl, `CREATE DATABASE ${escapeIdentifier(dbName)}`, true)

    const testDbUrl = buildDatabaseUrl(originalDbUrl, dbName)

    console.log(`[E2E setup] 在数据库 ${dbName} 中运行迁移...`)
    logVerbose(`[E2E setup] 使用 DATABASE_URL: ${testDbUrl.replace(/:[^:@]+@/, ':****@')}`)

    try {
      execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
        stdio: 'inherit',
        cwd: backendDir,
        env: {
          ...process.env,
          DATABASE_URL: testDbUrl,
          E2E_DATABASE_URL: testDbUrl,
          APP_ENV: 'e2e',
        },
      })
    } catch (migrateErr) {
      console.error(
        '[E2E setup] 迁移失败:',
        migrateErr instanceof Error ? migrateErr.message : migrateErr,
      )
      throw migrateErr
    }

    try {
      logVerbose(`[E2E setup] 在数据库 ${dbName} 中运行种子数据...`)
      execFileSync('npx', ['prisma', 'db', 'seed'], {
        stdio: 'inherit',
        cwd: backendDir,
        env: {
          ...process.env,
          DATABASE_URL: testDbUrl,
          E2E_DATABASE_URL: testDbUrl,
          APP_ENV: 'e2e',
        },
      })
    } catch (seedErr) {
      console.warn(
        '[E2E setup] 种子数据导入失败(忽略,继续执行测试):',
        seedErr instanceof Error ? seedErr.message : seedErr,
      )
    }

    console.log(`[E2E setup] 数据库 ${dbName} 初始化完成`)
  } catch (error) {
    throw new Error(`设置测试数据库失败: ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * 清理测试数据库：终止连接 + DROP DATABASE
 */
function cleanupTestDatabase(baseUrl: string, dbName: string): void {
  try {
    console.log(`[E2E teardown] 清理测试数据库: ${dbName}`)

    try {
      executePgCommand(
        baseUrl,
        `SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = ${escapeLiteral(dbName)} AND pid <> pg_backend_pid()`,
        true,
      )
    } catch {
      // 忽略终止连接的错误
    }

    executePgCommand(baseUrl, `DROP DATABASE IF EXISTS ${escapeIdentifier(dbName)}`, true)
    console.log(`[E2E teardown] 数据库 ${dbName} 已清理`)
  } catch (error) {
    console.error(
      `[E2E teardown] 清理数据库 ${dbName} 失败:`,
      error instanceof Error ? error.message : error,
    )
  }
}

// ========== 主入口 ==========

// 验证测试数据库 URL 安全性
const dbUrl = process.env.DATABASE_URL
if (!dbUrl || (!dbUrl.includes('e2e') && !dbUrl.includes('test'))) {
  const maskedUrl = (() => {
    if (!dbUrl) return '(missing)'
    try {
      const u = new URL(dbUrl)
      if (u.password) u.password = '****'
      return u.toString()
    } catch {
      return '(invalid format)'
    }
  })()
  console.error('[E2E setup] 缺少有效的 DATABASE_URL,检测结果:', maskedUrl)
  console.error('[E2E setup] APP_ENV:', process.env.APP_ENV, ' NODE_ENV:', process.env.NODE_ENV)
  process.exit(1)
}

// 解析原始 URL 并保存
const urlParams = parseDatabaseUrl(dbUrl)
originalDatabaseUrl = urlParams.originalUrl
const adminDatabaseUrl = urlParams.baseUrl

// 检查数据库权限
console.log('[E2E setup] 检查数据库 CREATE DATABASE 权限...')
if (!checkDatabasePermissions(adminDatabaseUrl)) {
  console.error('[E2E setup] 数据库权限不足，无法创建数据库')
  console.error('[E2E setup] 请确保数据库用户拥有 CREATE DATABASE 权限')
  process.exit(1)
}
console.log('[E2E setup] 数据库权限检查通过')

// 清理历史残留（数据库 + Redis keys）
cleanupOldDatabases(adminDatabaseUrl, 24)
cleanupOldRedisKeys(24)

// 生成唯一的测试数据库
currentTestDatabase = generateTestDatabaseName()
console.log(`[E2E setup] 使用测试数据库: ${currentTestDatabase}`)

// 构建新的 DATABASE_URL
const testDbUrl = buildDatabaseUrl(urlParams.originalUrl, currentTestDatabase)

// 初始化测试数据库（在成功之前不修改 process.env.DATABASE_URL）
try {
  setupTestDatabase(adminDatabaseUrl, currentTestDatabase, urlParams.originalUrl)
} catch (error) {
  console.error('[E2E setup] 初始化测试数据库失败:', error instanceof Error ? error.message : error)
  if (currentTestDatabase) {
    cleanupTestDatabase(adminDatabaseUrl, currentTestDatabase)
  }
  process.exit(1)
}

// 仅在 setup 成功后替换环境变量
process.env.DATABASE_URL = testDbUrl

// 注册全局钩子：在所有测试结束后清理数据库
afterAll(async () => {
  if (currentTestDatabase && originalDatabaseUrl) {
    console.log(`[E2E teardown] 开始清理测试数据库: ${currentTestDatabase}`)

    // Best-effort 等待应用连接关闭；pg_terminate_backend 下方才是可靠的强制断连路径
    await new Promise(resolve => setTimeout(resolve, 200))

    // 清理本次测试产生的 Redis keys
    cleanupRedisKeys(currentTestDatabase)

    // 清理数据库
    cleanupTestDatabase(adminDatabaseUrl, currentTestDatabase)

    // 恢复原始 URL
    process.env.DATABASE_URL = originalDatabaseUrl
    currentTestDatabase = null
    originalDatabaseUrl = null
  }
})

// testTimeout 由 jest-e2e.json 统一配置（60000ms），此处不再覆盖
