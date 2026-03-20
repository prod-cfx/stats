import type { TFunction } from 'i18next'
import { getToken } from '@/lib/auth-storage'
import { toast } from '@/lib/toast'

export function ensureMonitorAuth(t: TFunction): boolean {
  const token = getToken()
  if (token) return true

  toast.warning({
    title: t('whaleTracking.notifications.toast.authRequiredTitle'),
    description: t('whaleTracking.notifications.toast.authRequiredDesc'),
  })

  return false
}
