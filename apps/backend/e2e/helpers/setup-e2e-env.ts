import { resolve } from 'node:path'

/**
 * 确保 E2E 测试运行在 APP_ENV=e2e 环境下。
 *
 * - 若 APP_ENV 未设置，自动注入 'e2e'
 * - 若 strict=true 且 APP_ENV 不为 'e2e'，抛出错误阻止误连非测试库
 * - 自动 chdir 到 monorepo 根目录，使 ConfigModule/Prisma 能正确加载 .env.e2e
 */
export function ensureE2eEnv(
  options: { strict?: boolean; label?: string } = {},
): void {
  const { strict = false, label = 'E2E' } = options

  if (!process.env.APP_ENV) {
    process.env.APP_ENV = 'e2e'
  }

  if (strict && process.env.APP_ENV !== 'e2e') {
    throw new Error(
      `${label} must run with APP_ENV="e2e" to avoid touching non-test databases, current: ${process.env.APP_ENV}`,
    )
  }

  // helpers/ 在 apps/backend/e2e/helpers/，需上溯 4 级到 monorepo 根目录
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
  for (const [key, value] of Object.entries(defaults)) {
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}
