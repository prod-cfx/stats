import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Scaffold 前台',
  description: '最小化邮箱登录/注册脚手架',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
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
      <body className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
