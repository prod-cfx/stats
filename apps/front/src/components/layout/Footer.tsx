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
    <footer className="w-full border-t border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-4 py-8 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex flex-col items-center md:items-start gap-2">
          <Link href={withLng('/')} className="flex flex-col items-center md:items-start no-underline">
            <div className="flex items-center">
              <CoinfluxMark className="w-7 h-7 md:w-10 md:h-10" />
              <span className="text-[color:var(--cf-text-strong)] font-bold text-xl md:text-2xl leading-none tracking-tight -ml-1.5">oinflux</span>
            </div>
          </Link>
          <p className="text-[color:var(--cf-muted)] text-sm text-center md:text-left">
            {t('footer.tagline') || 'Your one-stop shop for crypto data aggregation.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 md:justify-end md:gap-6">
          <button
            type="button"
            onClick={handleSocialClick}
            className="flex min-h-10 min-w-10 items-center justify-center rounded-md text-[color:var(--cf-muted)] transition-colors hover:text-[color:var(--cf-text-strong)]"
            aria-label="Telegram"
          >
            <Send className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleSocialClick}
            className="flex min-h-10 min-w-10 items-center justify-center rounded-md text-[color:var(--cf-muted)] transition-colors hover:text-[color:var(--cf-text-strong)]"
            aria-label="X"
          >
            <XIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleSocialClick}
            className="flex min-h-10 min-w-10 items-center justify-center rounded-md text-[color:var(--cf-muted)] transition-colors hover:text-[color:var(--cf-text-strong)]"
            aria-label="GitHub"
          >
            <Github className="w-5 h-5" />
          </button>
          <Link
            href={withLng('/docs')}
            className="flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-[color:var(--cf-muted)] no-underline transition-colors hover:text-[color:var(--cf-text-strong)]"
          >
            <FileText className="w-4 h-4" />
            {t('nav.docs') || 'Doc'}
          </Link>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-[color:var(--cf-border)]/50 flex flex-col md:flex-row items-center justify-center gap-4 text-[color:var(--cf-muted)] text-xs">
        <p className="text-center">
          {t('footer.copyrightLine', { year })}
          <br />
          {t('footer.ownership')}
        </p>
      </div>
    </footer>
  );
};
