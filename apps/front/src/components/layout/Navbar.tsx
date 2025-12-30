'use client';

import { ChevronDown, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

export const Navbar = () => {
  const pathname = usePathname();

  const navLinks = [
    { name: '行情', href: '/' },
    { 
      name: '数据', 
      href: '/liquidation-map/',
      children: [
        { name: '清算地图', href: '/liquidation-map/' },
        { name: '交易所多空比', href: '/long-short-ratio/' },
        { name: '聚合挂单', href: '/aggregated-orderbook/' },
        { name: '爆仓数据', href: '/liquidation-data/' },
        { name: '预测市场', href: '/prediction-market/' },
        { name: '币股', href: '/public-companies/' },
      ]
    },
    { 
      name: '鲸鱼', 
      href: '/whale-tracking/discover/',
      children: [
        { name: '发现', href: '/whale-tracking/discover/' },
        { name: '实时巨鲸', href: '/whale-tracking/realtime/' },
        { name: '鲸鱼持仓', href: '/whale-tracking/holdings/' },
      ]
    },
    { name: '看板', href: '/dashboard/' },
  ];

  return (
    <nav className="h-20 bg-[#0d1117] border-b border-[#30363d] px-8 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-12">
        <Link href="/" className="flex items-center gap-3 no-underline">
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b949e] group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="搜索" 
            className="bg-[#21262d] border border-[#30363d] rounded-md pl-10 pr-4 py-2 text-caption text-[#e6edf3] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all w-64"
          />
        </div>
        <button type="button" className="px-4 py-2 text-label font-medium text-[#e6edf3] hover:text-white transition-colors">登录</button>
        <button type="button" className="px-6 py-2 text-label font-medium bg-gradient-to-r from-primary to-secondary rounded-md text-white shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95">
          注册
        </button>
      </div>
    </nav>
  );
};
