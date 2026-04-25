import type { ReactNode } from 'react'
import { headers } from 'next/headers'
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
        <script
          // eslint-disable-next-line react-dom/no-dangerously-set-innerhtml
          dangerouslySetInnerHTML={{
            __html: `
              // Theme init: apply before paint to avoid flicker
              ;(() => {
                try {
                  const key = 'cf-theme'
                  const stored = localStorage.getItem(key)
                  const theme = stored === 'light' || stored === 'dark' ? stored : 'dark'
                  document.documentElement.dataset.theme = theme
                  document.documentElement.classList.toggle('dark', theme === 'dark')
                  document.documentElement.style.colorScheme = theme
                } catch {}
              })()

              // Ignore extension-injected ethereum redefinition errors
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
      <body
        className="selection:bg-primary/30 min-h-screen bg-[color:var(--cf-bg)] text-[color:var(--cf-text)] antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  )
}
