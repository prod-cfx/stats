import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ApiKeyStatusBadge } from './ApiKeyStatusBadge'

export interface DeployExchangeAccount {
  accountId: string
  exchange: 'binance' | 'okx' | 'hyperliquid'
  accountName: string
  apiKeyMask: string
  status: 'available' | 'invalid'
}

interface DeployDialogProps {
  open: boolean
  canDeploy: boolean
  deploySubmitting: boolean
  apiConfigured: boolean
  exchange: 'binance' | 'okx' | 'hyperliquid'
  marketType: 'spot' | 'perp' | null
  accounts: DeployExchangeAccount[]
  selectedAccountId: string
  leverageOptions?: number[]
  selectedLeverage?: number
  onSelectLeverage?: (leverage: number) => void
  leverageExplanation?: string | null
  deploymentBaseline?: {
    leverage?: number | null
    priceSource?: string | null
    orderType?: string | null
    timeInForce?: string | null
  } | null
  mode?: 'deploy' | 'redeploy'
  driftReasons?: string[]
  lng: 'zh' | 'en'
  onSelectAccount: (accountId: string) => void
  onConfirmDeploy: () => Promise<void> | void
  onClose: () => void
}

export function DeployDialog({
  open,
  canDeploy,
  deploySubmitting,
  apiConfigured,
  exchange,
  marketType,
  accounts,
  selectedAccountId,
  leverageOptions = [],
  selectedLeverage,
  onSelectLeverage,
  leverageExplanation = null,
  deploymentBaseline = null,
  mode = 'deploy',
  driftReasons = [],
  lng,
  onSelectAccount,
  onConfirmDeploy,
  onClose,
}: DeployDialogProps) {
  const { t } = useTranslation()
  if (!open) return null
  const isEn = lng === 'en'
  const availableAccounts = accounts.filter(item => item.exchange === exchange && item.status === 'available')
  const accountReady = Boolean(selectedAccountId)
  const marketTypeReady = marketType === 'spot' || marketType === 'perp'
  const leverageRequired = marketType === 'perp'
  const leverageReady = !leverageRequired || leverageOptions.length === 0 || typeof selectedLeverage === 'number'
  const leverageRangeLabel = leverageOptions.length > 0
    ? `${Math.min(...leverageOptions)}x - ${Math.max(...leverageOptions)}x`
    : '--'
  const marketTypeLabel = marketType === 'spot'
    ? t('trade.market_type_spot', { defaultValue: '现货' })
    : marketType === 'perp'
      ? t('trade.perpTag', { defaultValue: '合约' })
      : '--'
  const isRedeploy = mode === 'redeploy'
  const title = isRedeploy
    ? t('aiQuant.deployDialog.redeployTitle', { defaultValue: isEn ? 'Redeploy strategy?' : '重新部署策略？' })
    : t('aiQuant.deployDialog.title')
  const description = isRedeploy
    ? t('aiQuant.deployDialog.redeployDesc', {
        defaultValue: isEn
          ? 'The system will redeploy the current published version and start running it.'
          : '系统将按当前已发布版本重新部署策略，并开始运行。',
      })
    : t('aiQuant.deployDialog.desc')
  const confirmLabel = isRedeploy
    ? t('aiQuant.deployDialog.confirmRedeploy', { defaultValue: isEn ? 'Confirm Redeploy' : '确认重新部署' })
    : t('aiQuant.deployDialog.confirmDeploy')
  const submittingLabel = t('aiQuant.deployDialog.deploying', { defaultValue: '部署中' })
  const handleDialogClose = () => {
    if (!deploySubmitting) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4 py-4" onClick={handleDialogClose}>
      <div
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[480px] overflow-y-auto rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 shadow-2xl sm:p-5"
        onClick={event => event.stopPropagation()}
      >
        <h3 className="!text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">{title}</h3>
        <p className="mt-1 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">{description}</p>

        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface-muted)] p-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="!text-sm !font-normal !leading-[22px] text-[color:var(--cf-text)]">{t('aiQuant.deployDialog.apiStatus')}</span>
          <ApiKeyStatusBadge configured={apiConfigured} />
        </div>

        {!apiConfigured && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 !text-sm !leading-[22px] text-amber-500">
            {t('aiQuant.deployDialog.apiKeyMissing')}
          </div>
        )}

        {!canDeploy && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 !text-sm !leading-[22px] text-amber-500">
            {t('aiQuant.deployDialog.drawdownFail')}
          </div>
        )}

        <div className="mt-4 grid gap-3 rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface-muted)] p-3 md:grid-cols-2">
          <div className="!text-xs !font-semibold !leading-5 text-[color:var(--cf-muted)]">
            {t('aiQuant.exchange')}
            <div className="mt-1 flex h-9 items-center rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-text)]">
              {exchange.toUpperCase()}
            </div>
          </div>

          <div className="!text-xs !font-semibold !leading-5 text-[color:var(--cf-muted)]">
            {t('aiQuant.marketType', { defaultValue: '市场类型' })}
            <div className="mt-1 flex h-9 items-center rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-text)]">
              {marketTypeLabel}
            </div>
          </div>

          <label className="!text-xs !font-semibold !leading-5 text-[color:var(--cf-muted)]">
            {t('aiQuant.deployDialog.selectAccount')}
            <select
              value={selectedAccountId}
              onChange={event => onSelectAccount(event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 !text-base !font-normal !leading-[22px] text-[color:var(--cf-text)] md:!text-sm"
            >
              <option value="">{t('aiQuant.deployDialog.selectAccount')}...</option>
              {availableAccounts.map(account => (
                <option key={account.accountId} value={account.accountId}>{account.accountName}</option>
              ))}
            </select>
          </label>

          {marketType === 'perp' && (
            <label className="!text-xs !font-semibold !leading-5 text-[color:var(--cf-muted)]">
              {isEn ? 'Deployment Leverage' : '部署杠杆'}
              <select
                name="deployment-leverage"
                value={typeof selectedLeverage === 'number' ? String(selectedLeverage) : ''}
                onChange={event => onSelectLeverage?.(Number(event.target.value))}
                className="mt-1 h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 !text-base !font-normal !leading-[22px] text-[color:var(--cf-text)] md:!text-sm"
              >
                <option value="">{isEn ? 'Select leverage' : '选择杠杆'}</option>
                {leverageOptions.map(option => (
                  <option key={option} value={option}>{option}x</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {marketType === 'perp' && leverageOptions.length > 0 && (
          <div className="mt-3 rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface-muted)] px-3 py-3 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-text)]">
            <p className="!font-semibold text-[color:var(--cf-text-strong)]">{isEn ? 'Allowed Leverage Range' : '允许杠杆范围'}</p>
            <p className="mt-1">{leverageRangeLabel}</p>
            {deploymentBaseline && (
              <p className="mt-2 !text-xs !leading-5 text-[color:var(--cf-muted)]">
                {isEn ? 'Strategy deployment default' : '策略部署默认'}: {deploymentBaseline.leverage ?? '--'}x / {deploymentBaseline.priceSource ?? '--'} / {deploymentBaseline.orderType ?? '--'} / {deploymentBaseline.timeInForce ?? '--'}
              </p>
            )}
            {leverageExplanation && (
              <p className="mt-2 !text-xs !leading-5 text-[color:var(--cf-muted)]">{leverageExplanation}</p>
            )}
            {driftReasons.length > 0 && (
              <p className="mt-2 !text-xs !leading-5 text-amber-300">{driftReasons.join(' / ')}</p>
            )}
          </div>
        )}

        {availableAccounts.length === 0 && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 !text-sm !leading-[22px] text-amber-500">
            {t('aiQuant.deployDialog.noAccounts')}
          </div>
        )}

        <div data-testid="deploy-dialog-actions" className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
          {!apiConfigured && (
            <Link
              href={`/${lng}/account?tab=settings#exchange-api`}
            className="inline-flex min-h-9 items-center justify-center rounded-full border border-[color:var(--cf-border)] px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-[color:var(--cf-text-strong)]"
            >
              {t('aiQuant.deployDialog.goConfig')}
            </Link>
          )}
          <button
            type="button"
            onClick={onConfirmDeploy}
            disabled={!apiConfigured || !canDeploy || !marketTypeReady || !accountReady || !leverageReady || deploySubmitting}
            aria-busy={deploySubmitting}
            className="from-primary to-secondary inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-gradient-to-r px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deploySubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {deploySubmitting ? submittingLabel : confirmLabel}
          </button>
          <button
            type="button"
            onClick={handleDialogClose}
            disabled={deploySubmitting}
            className="inline-flex min-h-9 items-center justify-center rounded-full border border-[color:var(--cf-border)] px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-[color:var(--cf-text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
