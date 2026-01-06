import type { Metadata } from 'next';
import type { ReactNode } from 'react';

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
  
  return {
    title: 'Coinflux - Advanced Crypto Data Aggregator',
    description: lng === 'zh'
      ? '专业的加密资产数据聚合与多维行情分析终端'
      : 'A professional crypto data aggregation and multi-dimensional market analysis terminal.',
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
  
  // 注意：这个 layout 不需要 <html> 和 <body>，因为它们已经在根 layout.tsx 中
  // 这里只是一个嵌套 layout，确保语言参数透传给子页面
  return <>{children}</>;
}
