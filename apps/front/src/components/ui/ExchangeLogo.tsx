'use client';

import React from 'react';

export const BinanceIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 201 201" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M100.517 200.483C155.745 200.483 200.517 155.712 200.517 100.483C200.517 45.2549 155.745 0.483337 100.517 0.483337C45.2882 0.483337 0.516663 45.2549 0.516663 100.483C0.516663 155.712 45.2882 200.483 100.517 200.483Z" fill="black"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M126.452 111.118L141.537 126.159L100.531 167.121L59.5688 126.159L74.6533 111.118L100.531 136.995L126.452 111.118ZM100.531 85.1965L115.832 100.498L100.531 115.799L85.2732 100.541V100.498L87.9607 97.8103L89.2611 96.5099L100.531 85.1965ZM48.949 85.4133L64.0335 100.498L48.949 115.539L33.8644 100.454L48.949 85.4133ZM152.113 85.4133L167.198 100.498L152.113 115.539L137.029 100.454L152.113 85.4133ZM100.531 33.8311L141.493 74.7934L126.409 89.8779L100.531 63.9568L74.6533 89.8346L59.5688 74.7934L100.531 33.8311Z" fill="#F3BA2F"/>
  </svg>
);

export const DexIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="12" fill="url(#dex_gradient_common)" />
    <path d="M7 7L17 17M17 7L7 17" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="12" cy="12" r="3" fill="white" />
    <defs>
      <linearGradient id="dex_gradient_common" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#396bff" />
        <stop offset="1" stopColor="#8b5cff" />
      </linearGradient>
    </defs>
  </svg>
);

interface ExchangeLogoProps {
  name?: string;
  logoUrl?: string;
  size?: number;
  className?: string;
}

export const ExchangeLogo = ({ name, logoUrl, size = 24, className = "" }: ExchangeLogoProps) => {
  // Identify exchange by name or URL
  const isBinance = name?.toLowerCase().includes('binance');
  const isKuCoin = name?.toLowerCase().includes('kucoin') || logoUrl?.includes('311.png') || logoUrl?.includes('16.png');
  const isDex = name?.toLowerCase().includes('dex');

  if (isBinance) return <div className={className}><BinanceIcon size={size} /></div>;
  
  if (isKuCoin) {
    const finalUrl = logoUrl || 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/311.png';
    return (
      <div className={`flex items-center justify-center overflow-hidden ${className}`} style={{ width: size, height: size }}>
        <img src={finalUrl} alt="KuCoin" className="w-full h-full object-cover rounded-full" />
      </div>
    );
  }

  if (isDex) return <div className={className}><DexIcon size={size} /></div>;

  if (logoUrl) {
    return (
      <div className={`rounded bg-[#21262d] border border-[#30363d] flex items-center justify-center overflow-hidden ${className}`} style={{ width: size, height: size }}>
        <img src={logoUrl} alt={name || 'exchange'} className="w-full h-full object-contain p-0.5" />
      </div>
    );
  }

  return (
    <div className={`rounded bg-primary/20 flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <span className="text-[10px] text-primary font-bold">{name?.charAt(0) || 'E'}</span>
    </div>
  );
};

