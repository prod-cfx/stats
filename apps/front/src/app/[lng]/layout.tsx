import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppProviders } from '@/components/providers/AppProviders';
import '../globals.css';

 

export type AppLocale = 'zh' | 'en';

// 生成静态参数，为每种语言生成独立的静态页面
export async function generateStaticParams() {
  return [
    { lng: 'zh' },
    { lng: 'en' },
  ];
}

// 根据语言生成元数据
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }> | { lng: string }
}): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params)
  const lng = resolvedParams.lng as AppLocale;
  
  const title = 'Coinflux - Advanced Crypto Data Aggregator';
  const description = lng === 'zh'
    ? '专业的加密资产数据聚合与多维行情分析终端'
    : 'A professional crypto data aggregation and multi-dimensional market analysis terminal.';
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      locale: lng === 'zh' ? 'zh_CN' : 'en_US',
    },
    twitter: {
      title,
      description,
    },
  };
}

export default async function LngLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lng: string }> | { lng: string };
}) {
  const resolvedParams = await Promise.resolve(params)
  const lng = resolvedParams.lng as AppLocale;
  const htmlLang = lng === 'zh' ? 'zh-CN' : 'en';
  
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
          <div style={{padding: '20px', textAlign: 'center', backgroundColor: 'var(--cf-surface)', color: 'var(--cf-text)'}}>
            {lng === 'zh' 
              ? '本应用需要启用 JavaScript 才能正常使用'
              : 'This application requires JavaScript to be enabled'}
          </div>
        </noscript>
      </head>
      <body className="min-h-screen bg-[color:var(--cf-bg)] text-[color:var(--cf-text)] antialiased selection:bg-primary/30" suppressHydrationWarning>
        <AppProviders lng={lng}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
