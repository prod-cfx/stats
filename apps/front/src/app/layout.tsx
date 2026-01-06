import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AppProviders } from '@/components/providers/AppProviders'
import { getRequestLocale } from '@/lib/i18n/server'
import './globals.css'

export function generateMetadata(): Metadata {
  const locale = getRequestLocale()
  const isZh = locale === 'zh'
  return {
    title: isZh ? 'Coinflux - 高级加密数据聚合器' : 'Coinflux - Advanced Crypto Data Aggregator',
    description: isZh
      ? '专业的加密资产数据聚合与多维行情分析终端'
      : 'A professional crypto data aggregation and multi-dimensional market analysis terminal.',
  }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const locale = getRequestLocale()
  const htmlLang = locale === 'zh' ? 'zh-CN' : 'en'
  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // 拦截并忽略由插件引起的 ethereum 属性重定义错误
              window.addEventListener('error', (event) => {
                if (event.message && (
                  event.message.includes('Cannot redefine property: ethereum') ||
                  event.message.includes('inpage.js')
                )) {
                  event.stopImmediatePropagation();
                }
              }, true);
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-[#0d1117] text-white antialiased selection:bg-primary/30" suppressHydrationWarning>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  )
}
