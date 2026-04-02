import { resolve } from 'node:path'
import {
  createEnvAccessor,
  ensureProcessEnvDefaults,
  restoreProcessEnv,
  setProcessEnvValue,
  snapshotProcessEnv,
} from '@/common/env/env.accessor'

const getE2eEnv = () => createEnvAccessor(process.env)

/**
 * 确保 E2E 测试运行在 APP_ENV=e2e 环境下。
 *
 * - 非 strict 模式：仅在 APP_ENV 未设置时注入 'e2e'，容忍其他值（适用于可选/门控测试）
 * - strict 模式：注入 'e2e' 后拒绝非 'e2e' 值（适用于涉及真实数据库的测试，fail-fast 优于静默覆盖）
 * - 自动 chdir 到 monorepo 根目录，使 ConfigModule/Prisma 能正确加载 .env.e2e
 */
export function ensureE2eEnv(
  options: { strict?: boolean; label?: string } = {},
): void {
  const { strict = false, label = 'E2E' } = options
  const env = getE2eEnv()

  if (!env.raw('APP_ENV')) {
    setProcessEnvValue('APP_ENV', 'e2e')
  }

  const appEnv = env.raw('APP_ENV')
  if (strict && appEnv !== 'e2e') {
    throw new Error(
      `${label} must run with APP_ENV="e2e" to avoid touching non-test databases, current: ${appEnv}`,
    )
  }

  // helpers/ 在 apps/quantify/e2e/helpers/，需上溯 4 级到 monorepo 根目录
  process.chdir(resolve(__dirname, '../../../..'))
}

/**
 * 为 E2E 测试提供环境变量默认值（仅在未设置时注入）。
 *
 * 受控例外：测试环境注入，非业务运行期读取。
 */
export function ensureE2eDefaults(
  defaults: Record<string, string>,
): void {
  ensureProcessEnvDefaults(defaults)
}

export function getE2eEnvValue(key: string): string | undefined {
  return getE2eEnv().raw(key)
}

export function snapshotE2eEnv(keys: readonly string[]) {
  return snapshotProcessEnv(keys)
}

export function restoreE2eEnv(snapshot: Record<string, string | undefined>): void {
  restoreProcessEnv(snapshot)
}

export function setE2eEnvValue(key: string, value: string | undefined): void {
  setProcessEnvValue(key, value)
}
