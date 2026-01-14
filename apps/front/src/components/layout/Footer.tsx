'use client';

import { FileText, Github, Send, X as XIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';

export const Footer = () => {
  const pathname = usePathname();
  const { t } = useTranslation();

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
    <footer className="bg-[#0d1117] border-t border-[#30363d] py-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start gap-2">
          <Link href={withLng('/')} className="flex items-center gap-3 no-underline">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/20" />
            <span className="text-white font-bold text-lg md:text-xl leading-tight">Coinflux</span>
          </Link>
          <p className="text-[#8b949e] text-sm text-center md:text-left">
            {t('footer.tagline') || 'Your one-stop shop for crypto data aggregation.'}
          </p>
        </div>

        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={handleSocialClick}
            className="text-[#8b949e] hover:text-white transition-colors"
            aria-label="Telegram"
          >
            <Send className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleSocialClick}
            className="text-[#8b949e] hover:text-white transition-colors"
            aria-label="X"
          >
            <XIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleSocialClick}
            className="text-[#8b949e] hover:text-white transition-colors"
            aria-label="GitHub"
          >
            <Github className="w-5 h-5" />
          </button>
          <Link
            href={withLng('/docs')}
            className="text-[#8b949e] hover:text-white transition-colors text-sm font-medium no-underline flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4" />
            {t('nav.docs') || 'Doc'}
          </Link>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-[#30363d]/50 flex flex-col md:flex-row items-center justify-between gap-4 text-[#8b949e] text-xs">
        <p>© {new Date().getFullYear()} Coinflux. All rights reserved.</p>
      </div>
    </footer>
  );
};
