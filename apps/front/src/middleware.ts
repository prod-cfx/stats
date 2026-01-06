import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// 支持的语言列表
const locales = ['zh', 'en'];
const defaultLocale = 'zh';

// 不需要语言前缀的路径（静态资源等）
const publicPaths = [
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 跳过静态资源
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 检查路径是否已包含语言前缀
  const pathnameHasLocale = locales.some(
    locale => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    return NextResponse.next();
  }

  // 根路径特殊处理（已有客户端重定向）
  if (pathname === '/') {
    return NextResponse.next();
  }

  // 从 cookie 或 Accept-Language 获取语言偏好
  let locale = defaultLocale;
  
  const cookieLocale = request.cookies.get('i18next')?.value;
  if (cookieLocale && locales.includes(cookieLocale)) {
    locale = cookieLocale;
  } else {
    const acceptLanguage = request.headers.get('accept-language');
    if (acceptLanguage) {
      const preferredLocale = acceptLanguage.split(',')[0]?.split('-')[0];
      if (preferredLocale && locales.includes(preferredLocale)) {
        locale = preferredLocale;
      }
    }
  }

  // 重定向到带语言前缀的路径，保留 query params
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;
  
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // 匹配所有路径，除了以下开头的：
    // - api (API routes)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
