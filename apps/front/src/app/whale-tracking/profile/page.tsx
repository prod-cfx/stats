'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const DEFAULT_LNG = 'zh';
const TARGET_PATH = '/whale-tracking/profile';

export default function WhaleTrackingProfileRedirect() {
  const router = useRouter();

  useEffect(() => {
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

    const search = window.location.search;
    const hash = window.location.hash;
    router.replace(`/${lng}${TARGET_PATH}${search}${hash}`);
  }, [router]);

  return (
    <>
      <noscript>
        <meta httpEquiv="refresh" content={`0; url=/${DEFAULT_LNG}${TARGET_PATH}`} />
      </noscript>
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-[#c9d1d9]">Loading...</div>
      </div>
    </>
  );
}
