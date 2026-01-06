'use client';

import { ChevronDown, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';

export const Navbar = () => {
  const pathname = usePathname();
  const { t } = useTranslation();
  
  // 从 pathname 提取当前语言
  const currentLng = useMemo(() => {
    const pathLng = pathname?.split('/')[1];
    return (pathLng === 'zh' || pathLng === 'en') ? pathLng : 'zh';
  }, [pathname]);
  
  // 辅助函数：为路径添加语言前缀
  const withLng = (path: string) => `/${currentLng}${path}`;

  const navLinks = [
    { name: t('nav.home'), href: withLng('/') },
    { 
      name: t('nav.data'), 
      href: withLng('/liquidation-map'),
      children: [
        { name: t('nav.liquidation_map'), href: withLng('/liquidation-map') },
        { name: t('nav.long_short_ratio'), href: withLng('/long-short-ratio') },
        { name: t('nav.aggregated_orderbook'), href: withLng('/aggregated-orderbook') },
        { name: t('nav.liquidation_data'), href: withLng('/liquidation-data') },
        { name: t('nav.prediction_market'), href: withLng('/prediction-market') },
        { name: t('nav.public_companies'), href: withLng('/public-companies') },
      ]
    },
    { 
      name: t('nav.whales'), 
      href: withLng('/whale-tracking/discover'),
      children: [
        { name: t('nav.discover'), href: withLng('/whale-tracking/discover') },
        { name: t('nav.realtime_whales'), href: withLng('/whale-tracking/realtime') },
        { name: t('nav.whale_holdings'), href: withLng('/whale-tracking/holdings') },
      ]
    },
    { name: t('nav.dashboard'), href: withLng('/dashboard') },
  ];

  return (
    <nav className="h-20 bg-[#0d1117] border-b border-[#30363d] px-8 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-12">
        <Link href={withLng('/')} className="flex items-center gap-3 no-underline">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/20" />
          <div className="flex flex-col">
            <span className="text-white font-bold text-xl leading-tight">Coinflux</span>
            <span className="text-[#8b949e] text-xs">Crypto Data Aggregation</span>
          </div>
        </Link>
        
        <div className="hidden md:flex items-center gap-8 h-full">
            {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.children && link.children.some(child => pathname === child.href));
            
            if (link.children) {
              return (
                <div key={link.name} className="relative group h-full flex items-center">
                  <Link 
                    href={link.href}
                    className={`font-medium transition-colors flex items-center gap-1 h-full transition-all cursor-pointer no-underline relative ${
                      isActive 
                        ? 'text-[#e6edf3]' 
                        : 'text-[#8b949e] hover:text-[#e6edf3]'
                    } text-body`}
                  >
                    {link.name}
                    <ChevronDown className="w-4 h-4 transition-transform group-hover:rotate-180" />
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary to-secondary" />
                    )}
                  </Link>
                  
                  {/* Dropdown Menu */}
                  <div className="absolute top-[95%] left-0 w-48 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 overflow-hidden z-50">
                    <div className="py-1">
                      {link.children.map((child) => (
                        <Link 
                          key={child.name} 
                          href={child.href}
                          className={`block px-4 py-2.5 text-caption transition-colors ${
                            pathname === child.href 
                              ? 'bg-gradient-to-r from-primary to-secondary text-white' 
                              : 'text-[#c9d1d9] hover:bg-primary/10 hover:text-primary'
                          }`}
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <Link 
                key={link.name} 
                href={link.href} 
                className={`font-medium transition-colors no-underline flex items-center h-full transition-all relative ${
                  isActive 
                    ? 'text-[#e6edf3]' 
                    : 'text-[#8b949e] hover:text-[#e6edf3]'
                } text-body`}
              >
                {link.name}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary to-secondary" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative group">
          <svg width="0" height="0" className="absolute">
            <defs>
              <linearGradient id="search_icon_gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--color-primary)" />
                <stop offset="100%" stopColor="var(--color-secondary)" />
              </linearGradient>
            </defs>
          </svg>
          <Search 
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b949e] group-focus-within:text-primary transition-colors z-10" 
            style={{ 
              stroke: 'url(#search_icon_gradient)'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-md opacity-0 group-focus-within:opacity-100 transition-opacity p-[1.5px]">
            <div className="w-full h-full bg-[#0d1117] rounded-[5px]" />
          </div>
          <input 
            type="text" 
            placeholder={t('nav.search')} 
            className="bg-[#21262d] border border-[#30363d] rounded-md pl-10 pr-4 py-2 text-caption text-[#e6edf3] focus:outline-none focus:bg-[#0d1117] transition-all w-64 relative z-0 group-focus-within:border-transparent"
          />
        </div>
        <button type="button" className="px-4 py-2 text-label font-medium text-[#e6edf3] hover:text-white transition-colors">{t('nav.login')}</button>
        <button type="button" className="px-6 py-2 text-label font-medium bg-gradient-to-r from-primary to-secondary rounded-md text-white shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95">
          {t('nav.register')}
        </button>
        <LanguageSwitcher />
      </div>
    </nav>
  );
};
