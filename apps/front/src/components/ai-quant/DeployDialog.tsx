import type { ExchangeAccount } from '@/components/account/exchange-account-store'
import Link from 'next/link'
import { ApiKeyStatusBadge } from './ApiKeyStatusBadge'

interface DeployDialogProps {
  open: boolean
  canDeploy: boolean
  apiConfigured: boolean
  exchange: 'binance' | 'okx'
  accounts: ExchangeAccount[]
  selectedAccountId: string
  lng: 'zh' | 'en'
  onSelectExchange: (exchange: 'binance' | 'okx') => void
  onSelectAccount: (accountId: string) => void
  onConfirmDeploy: () => void
  onClose: () => void
}

export function DeployDialog({
  open,
  canDeploy,
  apiConfigured,
  exchange,
  accounts,
  selectedAccountId,
  lng,
  onSelectExchange,
  onSelectAccount,
  onConfirmDeploy,
  onClose,
}: DeployDialogProps) {
  if (!open) return null
  const availableAccounts = accounts.filter(item => item.exchange === exchange && item.status === 'available')
  const accountReady = Boolean(selectedAccountId)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-[520px] rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5"
        onClick={event => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">部署确认</h3>
        <p className="mt-1 text-sm text-[color:var(--cf-muted)]">部署前需要满足 API 和回测门槛校验。</p>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
          <span className="text-sm text-[color:var(--cf-text)]">交易所 API 状态</span>
          <ApiKeyStatusBadge configured={apiConfigured} />
        </div>

        {!apiConfigured && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
            当前未配置 API Key，请先完成配置。
          </div>
        )}

        {!canDeploy && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
            回测最大回撤未达标（需 {'<='} 20%），当前禁止部署。
          </div>
        )}

        <div className="mt-4 grid gap-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3 md:grid-cols-2">
          <label className="text-xs text-[color:var(--cf-muted)]">
            交易所
            <select
              value={exchange}
              onChange={event => onSelectExchange(event.target.value as 'binance' | 'okx')}
              className="mt-1 h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)]"
            >
              <option value="binance">Binance</option>
              <option value="okx">OKX</option>
            </select>
          </label>

          <label className="text-xs text-[color:var(--cf-muted)]">
            API 账户
            <select
              value={selectedAccountId}
              onChange={event => onSelectAccount(event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)]"
            >
              <option value="">请选择账户</option>
              {availableAccounts.map(account => (
                <option key={account.accountId} value={account.accountId}>{account.accountName}</option>
              ))}
            </select>
          </label>
        </div>

        {availableAccounts.length === 0 && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
            当前交易所没有可用 API 账户，请先在个人中心配置。
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {!apiConfigured && (
            <Link
              href={`/${lng}/account?tab=ai-quant#exchange-api`}
              className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
            >
              去配置
            </Link>
          )}
          <button
            type="button"
            onClick={onConfirmDeploy}
            disabled={!apiConfigured || !canDeploy || !accountReady}
            className="from-primary to-secondary rounded-xl bg-gradient-to-r px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            确认部署
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
