import { useTranslation } from 'react-i18next'

export function ApiKeyStatusBadge({ configured }: { configured: boolean }) {
  const { t } = useTranslation()

  if (configured) {
    return (
      <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-500">
        {t('aiQuant.apiKeyStatus.configured')}
      </span>
    )
  }

  return (
    <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-500">
      {t('aiQuant.apiKeyStatus.notConfigured')}
    </span>
  )
}
