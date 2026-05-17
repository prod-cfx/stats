'use client';

import { FileText, Github, Send, X as XIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CoinfluxMark } from '@/components/ui/CoinfluxMark';
import { toast } from '@/lib/toast';

export const Footer = () => {
  const pathname = usePathname();
  const { t } = useTranslation();
  const year = new Date().getFullYear()

  // 从 pathname 提取当前语言
  const currentLng = useMemo(() => {
    const pathLng = pathname?.split('/')[1];
    return (pathLng === 'zh' || pathLng === 'en') ? pathLng : 'zh';
  }, [pathname]);

  // 辅助函数：为路径添加语言前缀
  const withLng = (path: string) => `/${currentLng}${path}`;

  const handleSocialClick = () => {
    toast.info({
      title: t('common.comingSoonTitle') || 'Coming Soon',
      description: t('common.comingSoonDesc') || 'This link will be available soon.',
      duration: 2500,
    })
  }

  return (
    <footer className="w-full border-t border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-4 py-6 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex flex-col items-center gap-1.5 md:items-start">
          <Link href={withLng('/')} className="flex flex-col items-center md:items-start no-underline">
            <div className="flex items-center">
              <CoinfluxMark className="h-7 w-7" />
              <span className="-ml-1.5 !text-base !font-semibold !leading-6 tracking-tight text-[color:var(--cf-text-strong)]">oinflux</span>
            </div>
          </Link>
          <p className="text-center !text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)] md:text-left">
            {t('footer.tagline') || 'Your one-stop shop for crypto data aggregation.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 md:justify-end">
          <button
            type="button"
            onClick={handleSocialClick}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--cf-muted)] transition-colors hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]"
            aria-label="Telegram"
          >
            <Send className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleSocialClick}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--cf-muted)] transition-colors hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]"
            aria-label="X"
          >
            <XIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleSocialClick}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--cf-muted)] transition-colors hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]"
            aria-label="GitHub"
          >
            <Github className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleSocialClick}
            className="flex h-8 items-center gap-1.5 rounded-full px-2.5 !text-xs !font-semibold !leading-5 text-[color:var(--cf-muted)] no-underline transition-colors hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]"
          >
            <FileText className="h-4 w-4" />
            {t('nav.docs') || 'Doc'}
          </button>
        </div>
      </div>
      
      <div className="mx-auto mt-5 flex max-w-7xl flex-col items-center justify-center gap-2 border-t border-[color:var(--cf-border)]/50 pt-5 !text-xs !font-normal !leading-5 text-[color:var(--cf-muted)] md:flex-row">
        <p className="text-center !text-xs !font-normal !leading-5">
          {t('footer.copyrightLine', { year })}
          <br />
          {t('footer.ownership')}
        </p>
      </div>
    </footer>
  );
};
