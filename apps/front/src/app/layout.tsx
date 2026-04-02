import type { ReactNode } from 'react'
import { cookies, headers } from 'next/headers'
import './globals.css'

async function inferHtmlLang() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])

  const cookieLng = cookieStore.get('i18next')?.value?.toLowerCase()
  if (cookieLng?.startsWith('zh')) return 'zh-CN'
  if (cookieLng?.startsWith('en')) return 'en'

  const accept = headerStore.get('accept-language')?.toLowerCase() ?? ''
  return accept.startsWith('zh') ? 'zh-CN' : 'en'
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
                  const preferred =
                    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
                      ? 'dark'
                      : 'light'
                  const theme = stored === 'light' || stored === 'dark' ? stored : preferred
                  document.documentElement.dataset.theme = theme
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
