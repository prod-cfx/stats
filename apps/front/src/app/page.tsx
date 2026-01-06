'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const DEFAULT_LNG = 'zh';

// 根路径重定向到默认语言
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // 读取 cookie 或浏览器语言
    const getCookie = (name: string) => {
      const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
      return match ? decodeURIComponent(match[2]) : null;
    };

    const cookieLng = getCookie('i18next');
    const browserLng = navigator.language;
    
    let lng = DEFAULT_LNG;
    if (cookieLng) {
      lng = cookieLng.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    } else if (browserLng) {
      lng = browserLng.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    }

    // 保留 query params 和 hash
    const search = window.location.search;
    const hash = window.location.hash;
    router.replace(`/${lng}${search}${hash}`);
  }, [router]);

  return (
    <>
      {/* 无 JS 环境下的静态重定向到默认语言首页 */}
      <noscript>
        <meta httpEquiv="refresh" content={`0; url=/${DEFAULT_LNG}/`} />
      </noscript>
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-[#c9d1d9]">Loading...</div>
      </div>
    </>
  );
}
