import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import Script from 'next/script'
import { ROOT_LAYOUT_BOOTSTRAP_SCRIPT } from './layout-bootstrap-script'
import './globals.css'

const ROUTE_LOCALE_HEADER = 'x-coinflux-locale'

async function inferHtmlLang() {
  const headerStore = await headers()

  const routeLng = headerStore.get(ROUTE_LOCALE_HEADER)?.toLowerCase()
  if (routeLng === 'zh') return 'zh-CN'
  if (routeLng === 'en') return 'en'

  return 'en'
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const htmlLang = await inferHtmlLang()

  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <head>
        <Script id="root-layout-bootstrap" strategy="beforeInteractive">
          {ROOT_LAYOUT_BOOTSTRAP_SCRIPT}
        </Script>
      </head>
      <body
        className="selection:bg-primary/30 min-h-screen bg-[color:var(--cf-bg)] text-[color:var(--cf-text)] antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  )
}
