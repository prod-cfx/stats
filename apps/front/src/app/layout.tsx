import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import './globals.css'

async function inferHtmlLang() {
  const cookieStore = await cookies()

  const cookieLng = cookieStore.get('i18next')?.value?.toLowerCase()
  if (cookieLng?.startsWith('zh')) return 'zh-CN'
  if (cookieLng?.startsWith('en')) return 'en'

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
