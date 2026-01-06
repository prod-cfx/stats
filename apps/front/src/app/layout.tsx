import type { Metadata } from 'next'
import { AppProviders } from '@/components/providers/AppProviders'
import './globals.css'

export const metadata: Metadata = {
  title: 'Coinflux - Advanced Crypto Data Aggregator',
  description: '专业的加密资产数据聚合与多维行情分析终端 / A professional crypto data aggregation and multi-dimensional market analysis terminal.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // 在 hydration 前立即设置语言，减少首屏"闪烁"
              (function() {
                try {
                  // 读取 i18next cookie
                  var match = document.cookie.match(/(?:^|;\\s*)i18next=([^;]*)/);
                  var cookieLng = match ? decodeURIComponent(match[1]) : null;
                  var lng = cookieLng || navigator.language || 'zh';
                  var htmlLang = lng.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
                  document.documentElement.lang = htmlLang;
                } catch(e) {}
              })();
              
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
        <noscript>
          <div style={{padding: '20px', textAlign: 'center', backgroundColor: '#161b22', color: '#c9d1d9'}}>
            本应用需要启用 JavaScript 才能正常使用 / This application requires JavaScript to be enabled.
          </div>
        </noscript>
      </head>
      <body className="min-h-screen bg-[#0d1117] text-white antialiased selection:bg-primary/30" suppressHydrationWarning>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  )
}
