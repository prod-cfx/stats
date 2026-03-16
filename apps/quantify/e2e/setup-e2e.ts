import { execSync } from 'node:child_process'
import * as crypto from 'node:crypto'
import * as path from 'node:path'

// 控制 E2E 日志详细程度，默认关闭，仅在 E2E_VERBOSE_LOG=true 时输出详细日志
const E2E_VERBOSE_LOG = process.env.E2E_VERBOSE_LOG === 'true'
const logE2eInfo = (...args: unknown[]) => {
  if (E2E_VERBOSE_LOG)
    console.log(...args)
}

// 全局存储当前测试使用的数据库名称
let currentTestDatabase: string | null = null
let originalDatabaseUrl: string | null = null

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
 */
function generateTestDatabaseName(): string {
  // 格式: test_db_YYYYMMDDHHmmss_hex
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
} {
  try {
    const url = new URL(dbUrl)
    const host = url.hostname
    const port = url.port || '5432'
    const database = url.pathname.slice(1) // 移除开头的 '/'
    const username = url.username
    const password = url.password

    // 使用 URL API 构建 baseUrl,自动处理特殊字符编码
    const baseUrlObj = new URL(dbUrl)
    baseUrlObj.pathname = '/postgres'
    const baseUrl = baseUrlObj.toString()

    return { host, port, database, username, password, baseUrl }
  }
  catch (error) {
    throw new Error(`无效的 DATABASE_URL 格式: ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * 构建指向指定数据库的 URL
 */
function buildDatabaseUrl(params: {
  username: string
  password: string
  host: string
  port: string
  database: string
}): string {
  // 使用 URL API 自动处理编码
  const url = new URL(`postgresql://${params.host}:${params.port}/`)
  if (params.username)
    url.username = params.username
  if (params.password)
    url.password = params.password
  url.pathname = `/${params.database}`
  return url.toString()
}

/**
 * 执行 PostgreSQL 命令
 */
function executePsqlCommand(connectionUrl: string, command: string, silent = false): string {
  try {
    const params = parseDatabaseUrl(connectionUrl)
    const psqlCommand = `PGPASSWORD="${params.password}" psql -h "${params.host}" -p "${params.port}" -U "${params.username}" -d "${params.database}" -t -c "${command}"`

    return execSync(psqlCommand, {
      stdio: silent ? 'pipe' : 'inherit',
      encoding: 'utf-8',
    })
  }
  catch (error) {
    throw new Error(`执行 PostgreSQL 命令失败: ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * 检查数据库权限
 */
function checkDatabasePermissions(baseUrl: string): boolean {
  try {
    const testDbName = `test_permission_check_${Date.now()}`
    executePsqlCommand(baseUrl, `CREATE DATABASE ${escapeIdentifier(testDbName)}`, true)
    executePsqlCommand(baseUrl, `DROP DATABASE ${escapeIdentifier(testDbName)}`, true)
    return true
  }
  catch (error) {
    console.error('[E2E setup] 数据库权限检查失败:', error instanceof Error ? error.message : error)
    return false
  }
}

/**
 * 清理超过指定时间的历史数据库
 */
function cleanupOldDatabases(baseUrl: string, maxAgeHours = 24): void {
  // 环境变量控制
  if (process.env.E2E_CLEANUP_OLD_DB !== 'true') {
    logE2eInfo('[E2E setup] 历史数据库清理已禁用 (E2E_CLEANUP_OLD_DB != true)')
    return
  }

  try {
    logE2eInfo(`[E2E setup] 开始清理超过${maxAgeHours} 小时的历史 test_db_* ...`)

    // 查询所有 test_db_* 开头的数据库
    const result = executePsqlCommand(
      baseUrl,
      "SELECT datname FROM pg_database WHERE datname LIKE 'test_db_%'",
      true,
    )

    const databases = result
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.startsWith('test_db_'))

    if (databases.length === 0) {
      logE2eInfo('[E2E setup] 没有找到需要清理的历史测试数据库')
      return
    }

    logE2eInfo(`[E2E setup] 发现 ${databases.length} 个历史 test_db_*`)

    let cleanedCount = 0
    let skippedCount = 0

    for (const dbName of databases) {
      try {
        // 1. 解析时间戳 test_db_YYYYMMDDHHmmss_xxx
        const match = dbName.match(/^test_db_(\d{14})_[a-f0-9]+$/)
        if (!match) {
          logE2eInfo(`[E2E setup] 跳过数据库 ${dbName} (格式不匹配)`)
          skippedCount++
          continue
        }

        // 2. 计算年龄
        const timestampStr = match[1]
        const dbTimestamp = new Date(
          `${timestampStr.slice(0, 4)}-${timestampStr.slice(4, 6)}-${timestampStr.slice(
            6,
            8,
          )}T${timestampStr.slice(8, 10)}:${timestampStr.slice(10, 12)}:${timestampStr.slice(
            12,
            14,
          )}Z`,
        )

        if (Number.isNaN(dbTimestamp.getTime())) {
          logE2eInfo(`[E2E setup] 跳过数据库 ${dbName} (时间戳解析失败)`)
          skippedCount++
          continue
        }

        const ageHours = (Date.now() - dbTimestamp.getTime()) / (1000 * 60 * 60)

        if (ageHours < maxAgeHours) {
          logE2eInfo(
            `[E2E setup] 跳过数据库 ${dbName} (${ageHours.toFixed(1)} 小时,未超过 ${maxAgeHours} 小时)`,
          )
          skippedCount++
          continue
        }

        // 3. 检查活动连接
        const activeConnsResult = executePsqlCommand(
          baseUrl,
          `SELECT COUNT(*) FROM pg_stat_activity WHERE datname = '${dbName.replace(/'/g, "''")}'`,
          true,
        )
        const activeConns = Number.parseInt(activeConnsResult.trim(), 10)

        if (activeConns > 0) {
          logE2eInfo(
            `[E2E setup] 跳过数据库 ${dbName} (${activeConns} 个活动连接,可能正在测试中)`,
          )
          skippedCount++
          continue
        }

        // 4. 删除数据库(无需强制终止连接)
        executePsqlCommand(baseUrl, `DROP DATABASE IF EXISTS "${dbName.replace(/"/g, '""')}"`, true)
        logE2eInfo(`[E2E setup] 已清理数据库 ${dbName} (年龄: ${ageHours.toFixed(1)} 小时)`)
        cleanedCount++
      }
      catch (error) {
        console.warn(
          `[E2E setup] 清理数据库 ${dbName} 失败:`,
          error instanceof Error ? error.message : error,
        )
      }
    }

    logE2eInfo(
      `[E2E setup] 清理完成: 成功 ${cleanedCount} 个, 跳过 ${skippedCount} 个, 总计 ${databases.length} 个`,
    )
  }
  catch (error) {
    console.warn(
      '[E2E setup] 清理历史数据库失败(忽略):',
      error instanceof Error ? error.message : error,
    )
  }
}

/**
 * 创建测试数据库并运行迁移
 */
function setupTestDatabase(
  baseUrl: string,
  dbName: string,
  urlParams: ReturnType<typeof parseDatabaseUrl>,
): void {
  try {
    logE2eInfo(`[E2E setup] 创建测试数据库 ${dbName}`)

    // 创建数据库
    executePsqlCommand(baseUrl, `CREATE DATABASE ${escapeIdentifier(dbName)}`, true)

    // 构建指向新数据库的 URL
    const testDbUrl = buildDatabaseUrl({
      username: urlParams.username,
      password: urlParams.password,
      host: urlParams.host,
      port: urlParams.port,
      database: dbName,
    })

    logE2eInfo(`[E2E setup] 在数据库 ${dbName} 中同步 schema...`)
    logE2eInfo(`[E2E setup] 使用 DATABASE_URL: ${testDbUrl.replace(/:[^:@]+@/, ':****@')}`)

    // 直接同步当前 schema；当前项目不保留历史 migrations，测试库始终按空库初始化。
    const backendDir = path.resolve(__dirname, '..')

    try {
      logE2eInfo('[E2E setup] 使用 prisma db push 同步当前 schema')
      execSync('npx prisma db push', {
        stdio: 'inherit',
        cwd: backendDir,
        env: {
          ...process.env,
          DATABASE_URL: testDbUrl,
          APP_ENV: 'e2e',
        },
      })
    }
    catch (schemaSyncErr) {
      console.error(
        '[E2E setup] Schema 同步失败:',
        schemaSyncErr instanceof Error ? schemaSyncErr.message : schemaSyncErr,
      )
      throw schemaSyncErr
    }

    // 运行种子数据 - 直接调用 Prisma
    try {
      logE2eInfo(`[E2E setup] 在数据库 ${dbName} 中运行种子数据...`)
      execSync('npx prisma db seed', {
        stdio: 'inherit',
        cwd: backendDir,
        env: {
          ...process.env,
          DATABASE_URL: testDbUrl,
          APP_ENV: 'e2e',
        },
      })
    }
    catch (seedErr) {
      console.warn(
        '[E2E setup] 种子数据导入失败(忽略,继续执行测试):',
        seedErr instanceof Error ? seedErr.message : seedErr,
      )
    }

    logE2eInfo(`[E2E setup] 数据库 ${dbName} 初始化完成`)
  }
  catch (error) {
    throw new Error(`设置测试数据库失败: ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * 清理测试数据库
 */
function cleanupTestDatabase(baseUrl: string, dbName: string): void {
  try {
    logE2eInfo(`[E2E setup] 清理测试数据库 ${dbName}`)

    // 终止所有到该数据库的连接
    try {
      executePsqlCommand(
        baseUrl,
        `SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = ${escapeLiteral(dbName)} AND pid <> pg_backend_pid()`,
        true,
      )
    }
    catch {
      // 忽略终止连接的错误
    }

    // 删除数据库
    executePsqlCommand(baseUrl, `DROP DATABASE IF EXISTS ${escapeIdentifier(dbName)}`, true)
    logE2eInfo(`[E2E setup] 数据库 ${dbName} 已清理`)
  }
  catch (error) {
    console.error(
      `[E2E setup] 清理数据库 ${dbName} 失败:`,
      error instanceof Error ? error.message : error,
    )
  }
}

// ========== 主入口==========

// 验证测试数据库URL
const dbUrl = process.env.DATABASE_URL
if (!dbUrl || (!dbUrl.includes('e2e') && !dbUrl.includes('test'))) {
  const maskedUrl = (() => {
    if (!dbUrl)
      return '(missing)'
    try {
      const u = new URL(dbUrl)
      if (u.password)
        u.password = '****'
      return u.toString()
    }
    catch {
      return '(invalid format)'
    }
  })()
  console.error('[E2E setup] 缺少有效的 DATABASE_URL,检测结果:', maskedUrl)
  console.error('[E2E setup] APP_ENV:', process.env.APP_ENV, ' NODE_ENV:', process.env.NODE_ENV)
  process.exit(1)
}

// 解析原始 URL 并保存
const urlParams = parseDatabaseUrl(dbUrl)
originalDatabaseUrl = urlParams.baseUrl

// 检查数据库权限
logE2eInfo('[E2E setup] 检查数据库 CREATE DATABASE 权限...')
if (!checkDatabasePermissions(originalDatabaseUrl)) {
  console.error('[E2E setup] 数据库权限不足，无法创建测试数据库')
  console.error('[E2E setup] 请确认数据库用户拥有 CREATE DATABASE 权限')
  console.error('[E2E setup] 或联系管理员授予权限')
  process.exit(1)
}
logE2eInfo('[E2E setup] 数据库权限检查通过')

// 清理历史残留数据库
cleanupOldDatabases(originalDatabaseUrl, 24)

// 生成唯一的测试数据库
currentTestDatabase = generateTestDatabaseName()
logE2eInfo(`[E2E setup] 使用测试数据库 ${currentTestDatabase}`)

// 构建新的 DATABASE_URL
const testDbUrl = buildDatabaseUrl({
  username: urlParams.username,
  password: urlParams.password,
  host: urlParams.host,
  port: urlParams.port,
  database: currentTestDatabase,
})

// 设置环境变量
process.env.DATABASE_URL = testDbUrl

// 初始化测试数据库
try {
  setupTestDatabase(originalDatabaseUrl, currentTestDatabase, urlParams)
}
catch (error) {
  console.error('[E2E setup] 初始化测试数据库失败:', error instanceof Error ? error.message : error)
  // 清理失败的数据库
  if (currentTestDatabase) {
    cleanupTestDatabase(originalDatabaseUrl, currentTestDatabase)
  }
  process.exit(1)
}

// 注册全局钩子:在所有测试结束后清理数据库
afterAll(async () => {
  if (currentTestDatabase && originalDatabaseUrl) {
    logE2eInfo(`[E2E teardown] 开始清理测试数据库: ${currentTestDatabase}`)

    // Prisma 7 使用 Driver Adapter 模式，无需手动断开连接
    // cleanupTestDatabase 会通过 pg_terminate_backend 强制终止所有连接

    // 清理数据库
    cleanupTestDatabase(originalDatabaseUrl, currentTestDatabase)

    // 恢复原始 URL
    process.env.DATABASE_URL = buildDatabaseUrl(urlParams)
    currentTestDatabase = null
    originalDatabaseUrl = null
  }
})

// Set test timeout
jest.setTimeout(30000)
