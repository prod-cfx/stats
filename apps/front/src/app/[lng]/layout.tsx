import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation'
import { AppProviders } from '@/components/providers/AppProviders';

 

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
  const lng = (resolvedParams.lng === 'en' ? 'en' : 'zh') as AppLocale;
  
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
  const lngRaw = resolvedParams.lng
  if (lngRaw !== 'zh' && lngRaw !== 'en') {
    notFound()
  }
  const lng = lngRaw as AppLocale;

  return <AppProviders lng={lng}>{children}</AppProviders>
}
