'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePathname } from 'next/navigation';

/**
 * 同步 URL 路径中的语言到 i18n 实例
 * 支持 /[lng]/... 路由结构
 */
export function I18nSync() {
  const { i18n } = useTranslation();
  const pathname = usePathname();

  useEffect(() => {
    // 从 URL 路径中提取语言
    const pathLng = pathname?.split('/')[1];
    if (pathLng && (pathLng === 'zh' || pathLng === 'en')) {
      if (i18n.language !== pathLng) {
        i18n.changeLanguage(pathLng);
      }
      
      const htmlLang = pathLng === 'zh' ? 'zh-CN' : 'en';
      if (document.documentElement.lang !== htmlLang) {
        document.documentElement.lang = htmlLang;
      }
    }

    // 更新页面标题和 meta（基于当前语言）
    const currentLang = i18n.language;
    const title = 'Coinflux - Advanced Crypto Data Aggregator';
    if (document.title !== title) {
      document.title = title;
    }

    const description = currentLang.toLowerCase().startsWith('zh')
      ? '专业的加密资产数据聚合与多维行情分析终端'
      : 'A professional crypto data aggregation and multi-dimensional market analysis terminal.';
    
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    if (metaDescription.getAttribute('content') !== description) {
      metaDescription.setAttribute('content', description);
    }

    // 更新 Open Graph meta tags
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription && ogDescription.getAttribute('content') !== description) {
      ogDescription.setAttribute('content', description);
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.getAttribute('content') !== title) {
      ogTitle.setAttribute('content', title);
    }
  }, [pathname, i18n]);

  return null;
}
