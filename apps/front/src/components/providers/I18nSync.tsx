'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * 同步 i18n 语言到 HTML 标签和页面元数据
 * 解决静态导出模式下服务端无法读取 cookie 导致的语言不一致问题
 */
export function I18nSync() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const currentLang = i18n.language;
    const htmlLang = currentLang === 'zh' ? 'zh-CN' : 'en';
    
    // 更新 HTML lang 属性，确保屏幕阅读器使用正确的语言
    if (document.documentElement.lang !== htmlLang) {
      document.documentElement.lang = htmlLang;
    }

    // 更新页面标题
    const title = 'Coinflux - Advanced Crypto Data Aggregator';
    if (document.title !== title) {
      document.title = title;
    }

    // 更新 meta description
    const description = currentLang === 'zh'
      ? '专业的加密资产数据聚合与多维行情分析终端'
      : 'A professional crypto data aggregation and multi-dimensional market analysis terminal.';
    
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', description);
  }, [i18n.language]);

  return null;
}
