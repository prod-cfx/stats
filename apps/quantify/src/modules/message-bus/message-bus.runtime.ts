import { defaultEnvAccessor } from '@/common/env/env.accessor'

export function isMessageBusRuntimeEnabled(): boolean {
  if (defaultEnvAccessor.bool('SKIP_PRISMA_CONNECT', false)) {
    return false
  }

  return defaultEnvAccessor.bool('MESSAGEBUS_RUNTIME_ENABLED', true)
}
