import Link from 'next/link'
import { AiQuantStrategyList } from './AiQuantStrategyList'

export function AiQuantSection({ lng }: { lng: 'zh' | 'en' }) {
  return (
    <section className="space-y-4">
      <section className="space-y-4 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
        <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">AI量化</h2>
        <p className="text-sm text-[color:var(--cf-muted)]">
          这里可以查看策略详情（收益、回撤、胜率、交易次数）、参数快照与运行时间线。
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${lng}/ai-quant`}
            className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
          >
            进入 AI量化
          </Link>
          <Link
            href={`/${lng}/account?tab=ai-quant#exchange-api`}
            className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
          >
            交易所 API 配置
          </Link>
        </div>
      </section>

      <AiQuantStrategyList lng={lng} />
    </section>
  )
}
