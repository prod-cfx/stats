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
  driftReasons = [],
  lng,
  onSelectAccount,
  onConfirmDeploy,
  onClose,
}: DeployDialogProps) {
  const { t } = useTranslation()
  if (!open) return null
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

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-[520px] rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5"
        onClick={event => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.deployDialog.title')}</h3>
        <p className="mt-1 text-sm text-[color:var(--cf-muted)]">{t('aiQuant.deployDialog.desc')}</p>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
          <span className="text-sm text-[color:var(--cf-text)]">{t('aiQuant.deployDialog.apiStatus')}</span>
          <ApiKeyStatusBadge configured={apiConfigured} />
        </div>

        {!apiConfigured && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
            {t('aiQuant.deployDialog.apiKeyMissing')}
          </div>
        )}

        {!canDeploy && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
            {t('aiQuant.deployDialog.drawdownFail')}
          </div>
        )}

        <div className="mt-4 grid gap-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3 md:grid-cols-2">
          <div className="text-xs text-[color:var(--cf-muted)]">
            {t('aiQuant.exchange')}
            <div className="mt-1 flex h-9 items-center rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 text-sm text-[color:var(--cf-text)]">
              {exchange.toUpperCase()}
            </div>
          </div>

          <div className="text-xs text-[color:var(--cf-muted)]">
            {t('aiQuant.marketType', { defaultValue: '市场类型' })}
            <div className="mt-1 flex h-9 items-center rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 text-sm text-[color:var(--cf-text)]">
              {marketTypeLabel}
            </div>
          </div>

          <label className="text-xs text-[color:var(--cf-muted)]">
            {t('aiQuant.deployDialog.selectAccount')}
            <select
              value={selectedAccountId}
              onChange={event => onSelectAccount(event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)]"
            >
              <option value="">{t('aiQuant.deployDialog.selectAccount')}...</option>
              {availableAccounts.map(account => (
                <option key={account.accountId} value={account.accountId}>{account.accountName}</option>
              ))}
            </select>
          </label>

          {marketType === 'perp'
            ? (
                <label className="text-xs text-[color:var(--cf-muted)]">
                  部署杠杆
                  <select
                    name="deployment-leverage"
                    value={typeof selectedLeverage === 'number' ? String(selectedLeverage) : ''}
                    onChange={event => onSelectLeverage?.(Number(event.target.value))}
                    className="mt-1 h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)]"
                  >
                    <option value="">选择杠杆</option>
                    {leverageOptions.map(option => (
                      <option key={option} value={option}>{option}x</option>
                    ))}
                  </select>
                </label>
              )
            : (
                <div className="text-xs text-[color:var(--cf-muted)]">
                  部署杠杆
                  <div className="mt-1 flex h-9 items-center rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 text-sm text-[color:var(--cf-text)]">
                    1x
                  </div>
                </div>
              )}
        </div>

        {marketType === 'perp' && leverageOptions.length > 0 && (
          <div className="mt-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-3 text-sm text-[color:var(--cf-text)]">
            <p className="font-semibold text-[color:var(--cf-text-strong)]">允许杠杆范围</p>
            <p className="mt-1">{leverageRangeLabel}</p>
            {deploymentBaseline && (
              <p className="mt-2 text-xs text-[color:var(--cf-muted)]">
                策略部署默认: {deploymentBaseline.leverage ?? '--'}x / {deploymentBaseline.priceSource ?? '--'} / {deploymentBaseline.orderType ?? '--'} / {deploymentBaseline.timeInForce ?? '--'}
              </p>
            )}
            {leverageExplanation && (
              <p className="mt-2 text-xs text-[color:var(--cf-muted)]">{leverageExplanation}</p>
            )}
            {driftReasons.length > 0 && (
              <p className="mt-2 text-xs text-amber-300">{driftReasons.join(' / ')}</p>
            )}
          </div>
        )}

        {availableAccounts.length === 0 && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
            {t('aiQuant.deployDialog.noAccounts')}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {!apiConfigured && (
            <Link
              href={`/${lng}/account?tab=ai-quant#exchange-api`}
              className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
            >
              {t('aiQuant.deployDialog.goConfig')}
            </Link>
          )}
          <button
            type="button"
            onClick={onConfirmDeploy}
            disabled={!apiConfigured || !canDeploy || !marketTypeReady || !accountReady || !leverageReady || deploySubmitting}
            className="from-primary to-secondary rounded-xl bg-gradient-to-r px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('aiQuant.deployDialog.confirmDeploy')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
