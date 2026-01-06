'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

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
    
    let lng = 'zh'; // 默认中文
    if (cookieLng) {
      lng = cookieLng.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    } else if (browserLng) {
      lng = browserLng.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    }

    // 重定向到对应语言的首页
    router.replace(`/${lng}`);
  }, [router]);

  // 显示加载提示
  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <div className="text-[#c9d1d9]">Loading...</div>
    </div>
  );
}
