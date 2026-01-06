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
export async function generateMetadata({ params }: { params: { lng: string } }): Promise<Metadata> {
  const lng = params.lng as AppLocale;
  
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

export default function LngLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { lng: string };
}) {
  const lng = params.lng as AppLocale;
  const htmlLang = lng === 'zh' ? 'zh-CN' : 'en';
  
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
        <noscript>
          <div style={{padding: '20px', textAlign: 'center', backgroundColor: '#161b22', color: '#c9d1d9'}}>
            {lng === 'zh' 
              ? '本应用需要启用 JavaScript 才能正常使用'
              : 'This application requires JavaScript to be enabled'}
          </div>
        </noscript>
      </head>
      <body className="min-h-screen bg-[#0d1117] text-white antialiased selection:bg-primary/30" suppressHydrationWarning>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
