import { execSync } from 'node:child_process'
import * as crypto from 'node:crypto'
import * as path from 'node:path'

// 鎺у埗 E2E 鏃ュ織璇︾粏绋嬪害锛岄粯璁ゅ叧闂紝浠呭湪 E2E_VERBOSE_LOG=true 鏃惰緭鍑鸿缁嗘棩蹇?
const E2E_VERBOSE_LOG = process.env.E2E_VERBOSE_LOG === 'true'
const logE2eInfo = (...args: unknown[]) => {
  if (E2E_VERBOSE_LOG)
    console.log(...args)
}

// 鍏ㄥ眬瀛樺偍褰撳墠娴嬭瘯浣跨敤鐨勬暟鎹簱鍚嶇О
let currentTestDatabase: string | null = null
let originalDatabaseUrl: string | null = null

/**
 * 杞箟 SQL 鏍囪瘑绗?(琛ㄥ悕銆佸垪鍚嶃€佹暟鎹簱鍚嶇瓑)
 * 浣跨敤鍙屽紩鍙峰寘瑁瑰苟杞箟鍐呴儴鍙屽紩鍙?
 */
function escapeIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`
}

/**
 * 杞箟 SQL 瀛楃涓插父閲?
 * 浣跨敤鍗曞紩鍙峰寘瑁瑰苟杞箟鍐呴儴鍗曞紩鍙?
 */
function escapeLiteral(literal: string): string {
  return `'${literal.replace(/'/g, "''")}'`
}

/**
 * 鐢熸垚鍞竴鐨勬祴璇曟暟鎹簱鍚嶇О
 */
function generateTestDatabaseName(): string {
  // 鏍煎紡: test_db_YYYYMMDDHHmmss_hex
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.]/g, '')
    .slice(0, 14)
  const randomId = crypto.randomBytes(6).toString('hex')
  return `test_db_${timestamp}_${randomId}`
}

/**
 * 浠?DATABASE_URL 涓彁鍙栬繛鎺ュ弬鏁?
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
    const database = url.pathname.slice(1) // 绉婚櫎寮€澶寸殑 '/'
    const username = url.username
    const password = url.password

    // 浣跨敤 URL API 鏋勫缓 baseUrl,鑷姩澶勭悊鐗规畩瀛楃缂栫爜
    const baseUrlObj = new URL(dbUrl)
    baseUrlObj.pathname = '/postgres'
    const baseUrl = baseUrlObj.toString()

    return { host, port, database, username, password, baseUrl }
  }
  catch (error) {
    throw new Error(`鏃犳晥鐨?DATABASE_URL 鏍煎紡: ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * 鏋勫缓鎸囧悜鎸囧畾鏁版嵁搴撶殑 URL
 */
function buildDatabaseUrl(params: {
  username: string
  password: string
  host: string
  port: string
  database: string
}): string {
  // 浣跨敤 URL API 鑷姩澶勭悊缂栫爜
  const url = new URL(`postgresql://${params.host}:${params.port}/`)
  if (params.username)
    url.username = params.username
  if (params.password)
    url.password = params.password
  url.pathname = `/${params.database}`
  return url.toString()
}

/**
 * 鎵ц PostgreSQL 鍛戒护
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
    throw new Error(`鎵ц PostgreSQL 鍛戒护澶辫触: ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * 妫€鏌ユ暟鎹簱鏉冮檺
 */
function checkDatabasePermissions(baseUrl: string): boolean {
  try {
    const testDbName = `test_permission_check_${Date.now()}`
    executePsqlCommand(baseUrl, `CREATE DATABASE ${escapeIdentifier(testDbName)}`, true)
    executePsqlCommand(baseUrl, `DROP DATABASE ${escapeIdentifier(testDbName)}`, true)
    return true
  }
  catch (error) {
    console.error('[E2E setup] 鏁版嵁搴撴潈闄愭鏌ュけ璐?', error instanceof Error ? error.message : error)
    return false
  }
}

/**
 * 娓呯悊瓒呰繃鎸囧畾鏃堕棿鐨勫巻鍙叉暟鎹簱
 */
function cleanupOldDatabases(baseUrl: string, maxAgeHours = 24): void {
  // 鐜鍙橀噺鎺у埗
  if (process.env.E2E_CLEANUP_OLD_DB !== 'true') {
    logE2eInfo('[E2E setup] 鍘嗗彶鏁版嵁搴撴竻鐞嗗凡绂佺敤 (E2E_CLEANUP_OLD_DB != true)')
    return
  }

  try {
    logE2eInfo(`[E2E setup] 寮€濮嬫竻鐞嗚秴杩?${maxAgeHours} 灏忔椂鐨勫巻鍙?test_db_* ...`)

    // 鏌ヨ鎵€鏈?test_db_* 寮€澶寸殑鏁版嵁搴?
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

    logE2eInfo(`[E2E setup] 鍙戠幇 ${databases.length} 涓巻鍙?test_db_*`)

    let cleanedCount = 0
    let skippedCount = 0

    for (const dbName of databases) {
      try {
        // 1. 瑙ｆ瀽鏃堕棿鎴? test_db_YYYYMMDDHHmmss_xxx
        const match = dbName.match(/^test_db_(\d{14})_[a-f0-9]+$/)
        if (!match) {
          logE2eInfo(`[E2E setup] 璺宠繃鏁版嵁搴?${dbName} (鏍煎紡涓嶅尮閰?`)
          skippedCount++
          continue
        }

        // 2. 璁＄畻骞撮緞
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
          logE2eInfo(`[E2E setup] 璺宠繃鏁版嵁搴?${dbName} (鏃堕棿鎴宠В鏋愬け璐?`)
          skippedCount++
          continue
        }

        const ageHours = (Date.now() - dbTimestamp.getTime()) / (1000 * 60 * 60)

        if (ageHours < maxAgeHours) {
          logE2eInfo(
            `[E2E setup] 璺宠繃鏁版嵁搴?${dbName} (浠?${ageHours.toFixed(1)} 灏忔椂,鏈秴杩?${maxAgeHours} 灏忔椂)`,
          )
          skippedCount++
          continue
        }

        // 3. 妫€鏌ユ椿鍔ㄨ繛鎺?
        const activeConnsResult = executePsqlCommand(
          baseUrl,
          `SELECT COUNT(*) FROM pg_stat_activity WHERE datname = '${dbName.replace(/'/g, "''")}'`,
          true,
        )
        const activeConns = Number.parseInt(activeConnsResult.trim(), 10)

        if (activeConns > 0) {
          logE2eInfo(
            `[E2E setup] 璺宠繃鏁版嵁搴?${dbName} (鏈?${activeConns} 涓椿鍔ㄨ繛鎺?鍙兘姝ｅ湪娴嬭瘯涓?`,
          )
          skippedCount++
          continue
        }

        // 4. 鍒犻櫎鏁版嵁搴?(鏃犻渶寮哄埗缁堟杩炴帴)
        executePsqlCommand(baseUrl, `DROP DATABASE IF EXISTS "${dbName.replace(/"/g, '""')}"`, true)
        logE2eInfo(`[E2E setup] 宸叉竻鐞嗘暟鎹簱 ${dbName} (骞撮緞: ${ageHours.toFixed(1)} 灏忔椂)`)
        cleanedCount++
      }
      catch (error) {
        console.warn(
          `[E2E setup] 娓呯悊鏁版嵁搴?${dbName} 澶辫触:`,
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
      '[E2E setup] 娓呯悊鍘嗗彶鏁版嵁搴撳け璐?蹇界暐):',
      error instanceof Error ? error.message : error,
    )
  }
}

/**
 * 鍒涘缓娴嬭瘯鏁版嵁搴撳苟杩愯杩佺Щ
 */
function setupTestDatabase(
  baseUrl: string,
  dbName: string,
  urlParams: ReturnType<typeof parseDatabaseUrl>,
): void {
  try {
    logE2eInfo(`[E2E setup] 创建测试数据库 ${dbName}`)

    // 鍒涘缓鏁版嵁搴?
    executePsqlCommand(baseUrl, `CREATE DATABASE ${escapeIdentifier(dbName)}`, true)

    // 鏋勫缓鎸囧悜鏂版暟鎹簱鐨?URL
    const testDbUrl = buildDatabaseUrl({
      username: urlParams.username,
      password: urlParams.password,
      host: urlParams.host,
      port: urlParams.port,
      database: dbName,
    })

    logE2eInfo(`[E2E setup] 在数据库 ${dbName} 中同步 schema...`)
    logE2eInfo(`[E2E setup] 浣跨敤 DATABASE_URL: ${testDbUrl.replace(/:[^:@]+@/, ':****@')}`)

    // 鐩存帴鍚屾褰撳墠 schema锛涘綋鍓嶉」鐩笉淇濈暀鍘嗗彶 migrations锛屾祴璇曞簱濮嬬粓鎸夌┖搴撳垵濮嬪寲銆?
    const backendDir = path.resolve(__dirname, '..')

    try {
      logE2eInfo('[E2E setup] 浣跨敤 prisma db push 鍚屾褰撳墠 schema')
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
        '[E2E setup] Schema 鍚屾澶辫触:',
        schemaSyncErr instanceof Error ? schemaSyncErr.message : schemaSyncErr,
      )
      throw schemaSyncErr
    }

    // 杩愯绉嶅瓙鏁版嵁 - 鐩存帴璋冪敤 Prisma
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
        '[E2E setup] 绉嶅瓙鏁版嵁瀵煎叆澶辫触(蹇界暐,缁х画鎵ц娴嬭瘯):',
        seedErr instanceof Error ? seedErr.message : seedErr,
      )
    }

    logE2eInfo(`[E2E setup] 数据库 ${dbName} 初始化完成`)
  }
  catch (error) {
    throw new Error(`璁剧疆娴嬭瘯鏁版嵁搴撳け璐? ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * 娓呯悊娴嬭瘯鏁版嵁搴?
 */
function cleanupTestDatabase(baseUrl: string, dbName: string): void {
  try {
    logE2eInfo(`[E2E setup] 娓呯悊娴嬭瘯鏁版嵁搴? ${dbName}`)

    // 缁堟鎵€鏈夊埌璇ユ暟鎹簱鐨勮繛鎺?
    try {
      executePsqlCommand(
        baseUrl,
        `SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = ${escapeLiteral(dbName)} AND pid <> pg_backend_pid()`,
        true,
      )
    }
    catch {
      // 蹇界暐缁堟杩炴帴鐨勯敊璇?
    }

    // 鍒犻櫎鏁版嵁搴?
    executePsqlCommand(baseUrl, `DROP DATABASE IF EXISTS ${escapeIdentifier(dbName)}`, true)
    logE2eInfo(`[E2E setup] 数据库 ${dbName} 已清理`)
  }
  catch (error) {
    console.error(
      `[E2E setup] 娓呯悊鏁版嵁搴?${dbName} 澶辫触:`,
      error instanceof Error ? error.message : error,
    )
  }
}

// ========== 涓诲叆鍙?==========

// 楠岃瘉娴嬭瘯鏁版嵁搴揢RL
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
  console.error('[E2E setup] 缂哄皯鏈夋晥鐨?DATABASE_URL,妫€娴嬬粨鏋?', maskedUrl)
  console.error('[E2E setup] APP_ENV:', process.env.APP_ENV, ' NODE_ENV:', process.env.NODE_ENV)
  process.exit(1)
}

// 瑙ｆ瀽鍘熷 URL 骞朵繚瀛?
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

// 娓呯悊鍘嗗彶娈嬬暀鏁版嵁搴?
cleanupOldDatabases(originalDatabaseUrl, 24)

// 鐢熸垚鍞竴鐨勬祴璇曟暟鎹簱
currentTestDatabase = generateTestDatabaseName()
logE2eInfo(`[E2E setup] 使用测试数据库 ${currentTestDatabase}`)

// 鏋勫缓鏂扮殑 DATABASE_URL
const testDbUrl = buildDatabaseUrl({
  username: urlParams.username,
  password: urlParams.password,
  host: urlParams.host,
  port: urlParams.port,
  database: currentTestDatabase,
})

// 璁剧疆鐜鍙橀噺
process.env.DATABASE_URL = testDbUrl

// 鍒濆鍖栨祴璇曟暟鎹簱
try {
  setupTestDatabase(originalDatabaseUrl, currentTestDatabase, urlParams)
}
catch (error) {
  console.error('[E2E setup] 鍒濆鍖栨祴璇曟暟鎹簱澶辫触:', error instanceof Error ? error.message : error)
  // 娓呯悊澶辫触鐨勬暟鎹簱
  if (currentTestDatabase) {
    cleanupTestDatabase(originalDatabaseUrl, currentTestDatabase)
  }
  process.exit(1)
}

// 娉ㄥ唽鍏ㄥ眬閽╁瓙:鍦ㄦ墍鏈夋祴璇曠粨鏉熷悗娓呯悊鏁版嵁搴?
afterAll(async () => {
  if (currentTestDatabase && originalDatabaseUrl) {
    logE2eInfo(`[E2E teardown] 开始清理测试数据库: ${currentTestDatabase}`)

    // Prisma 7 浣跨敤 Driver Adapter 妯″紡锛屾棤闇€鎵嬪姩鏂紑杩炴帴
    // cleanupTestDatabase 浼氶€氳繃 pg_terminate_backend 寮哄埗缁堟鎵€鏈夎繛鎺?

    // 娓呯悊鏁版嵁搴?
    cleanupTestDatabase(originalDatabaseUrl, currentTestDatabase)

    // 鎭㈠鍘熷 URL
    process.env.DATABASE_URL = buildDatabaseUrl(urlParams)
    currentTestDatabase = null
    originalDatabaseUrl = null
  }
})

// Set test timeout
jest.setTimeout(30000)
