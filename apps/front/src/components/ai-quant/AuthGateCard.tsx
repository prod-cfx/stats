import Link from 'next/link'

export function AuthGateCard({ lng }: { lng: 'zh' | 'en' }) {
  return (
    <section className="mx-auto w-full max-w-[680px] rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-8 text-center">
      <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">登录后可使用 AI量化</h1>
      <p className="mt-2 text-sm text-[color:var(--cf-muted)]">
        为了保存你的策略、回测记录和部署状态，AI量化模块要求先登录。
      </p>
      <Link
        href={`/${lng}/auth/login`}
        className="from-primary to-secondary mt-6 inline-flex rounded-xl bg-gradient-to-r px-5 py-2 text-sm font-bold text-white"
      >
        立即登录
      </Link>
    </section>
  )
}
