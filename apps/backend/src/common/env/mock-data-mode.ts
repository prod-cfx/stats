import type { EnvAccessor } from './env.accessor'
import { defaultEnvAccessor } from './env.accessor'

const MOCK_ALLOWED_ENVS = new Set(['development', 'dev', 'e2e', 'mock'])

export function isMockDataAllowed(env: EnvAccessor = defaultEnvAccessor): boolean {
  if (!env.bool('USE_MOCK_DATA')) {
    return false
  }

  const explicitEnv = env.raw('APP_ENV')?.trim().toLowerCase()
    || env.raw('NODE_ENV')?.trim().toLowerCase()

  if (explicitEnv) {
    return MOCK_ALLOWED_ENVS.has(explicitEnv)
  }

  return MOCK_ALLOWED_ENVS.has(env.appEnv())
}
