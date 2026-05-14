/**
 * Issue #1364 AC-5：真实 LLM 端到端 e2e 的 secrets 加载器。
 *
 * 加载策略：
 *   - CI：secrets 已通过 GH Actions env 注入，直接 return；
 *   - 本地：从 /home/ubuntu/jerry_work/stats/.env.staging.local 读 LLM_STRATEGY_CODEGEN_*
 *     注入到 process.env（不 override 已存在的值）；
 *   - 缺 API key 或缺关键变量：fail-loud（throw），禁止静默 skip。
 *
 * 该 loader 必须在 jest 启动时尽早调用（spec 文件顶层 import 前 OK；
 * 由各 spec 在 `beforeAll` 第一行显式调用更稳妥）。
 */
import { existsSync } from 'node:fs'
import { config as loadDotenv } from 'dotenv'

const STAGING_LOCAL_PATH = '/home/ubuntu/jerry_work/stats/.env.staging.local'

const REQUIRED_KEYS = [
  'LLM_STRATEGY_CODEGEN_API_KEY',
  'LLM_STRATEGY_CODEGEN_BASE_URL',
  'LLM_STRATEGY_CODEGEN_MODEL',
] as const

function looksLikeRealKey(value: string | undefined): boolean {
  if (!value) return false
  if (value.startsWith('test-no-')) return false
  if (value.startsWith('fake-')) return false
  if (value === '__SET_IN_env.local__') return false
  return value.length > 0
}

export function loadRealLlmEnv(): void {
  // 已注入（CI 通过 secrets）→ 直接 return
  if (looksLikeRealKey(process.env.LLM_STRATEGY_CODEGEN_API_KEY)) return

  if (!existsSync(STAGING_LOCAL_PATH)) {
    throw new Error(
      `[#1364 AC-5] 缺少 LLM secrets。CI 通过 GH Actions secrets 注入；本地需要 ${STAGING_LOCAL_PATH} 提供 LLM_STRATEGY_CODEGEN_*。`,
    )
  }

  // 只取 LLM_STRATEGY_CODEGEN_* 三个变量做 override；禁止把 staging .env 里的
  // DATABASE_URL / REDIS_URL / JWT_SECRET 等覆盖到 e2e 进程（会污染 test DB）。
  // dx 的 e2e env 加载链先注入 `__SET_IN_env.local__` 占位符，所以 LLM_* 必须 override。
  const parsed = loadDotenv({ path: STAGING_LOCAL_PATH, processEnv: {} as Record<string, string> }).parsed ?? {}
  for (const key of REQUIRED_KEYS) {
    if (parsed[key]) {
      process.env[key] = parsed[key]
    }
  }

  for (const key of REQUIRED_KEYS) {
    if (!process.env[key]) {
      throw new Error(`[#1364 AC-5] 从 ${STAGING_LOCAL_PATH} 加载后仍缺 env ${key}`)
    }
  }

  if (!looksLikeRealKey(process.env.LLM_STRATEGY_CODEGEN_API_KEY)) {
    throw new Error(`[#1364 AC-5] LLM_STRATEGY_CODEGEN_API_KEY 看起来是占位符，不是真实 key`)
  }
}
