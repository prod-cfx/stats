'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * 同步 URL 路径中的语言到 i18n 实例
 * 注意：HTML lang 和 metadata 已在服务端正确设置，本组件仅负责同步 i18n.language
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
    }
  }, [pathname, i18n]);

  return null;
}
