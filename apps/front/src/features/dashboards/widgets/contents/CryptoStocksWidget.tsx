'use client'

import React, { useMemo } from 'react'

interface CompanyData {
  asset: string;
  assetLogo: string;
  name: string;
  ticker: string;
  exchange: string;
  logo: string;
  mNav: string;
  marketCap: string;
  holdingsValue: string;
  holdingsAmount: string;
  sharePrice: string;
  change24h: string;
  change1d: string;
  change7d: string;
}

const initialCompanyData: CompanyData[] = [
  {
    asset: 'PYUSD',
    assetLogo: 'https://cryptologos.cc/logos/paypal-usd-pyusd-logo.png?v=040',
    name: 'PayPal Holdings, Inc.',
    ticker: 'PYPL',
    exchange: '美股-NASDAQ',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg',
    mNav: '-',
    marketCap: '$58.56B',
    holdingsValue: '-',
    holdingsAmount: '-',
    sharePrice: '$61.30',
    change24h: '+0.96%',
    change1d: '+1.25%',
    change7d: '-0.50%',
  },
  {
    asset: 'BTC',
    assetLogo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=040',
    name: 'MicroStrategy Incorporated',
    ticker: 'MSTR',
    exchange: '美股-NASDAQ',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/MicroStrategy_logo.svg/1200px-MicroStrategy_logo.svg.png',
    mNav: '0.83',
    marketCap: '$47.4B',
    holdingsValue: '$58.14B',
    holdingsAmount: '671.27K BTC',
    sharePrice: '$167.50',
    change24h: '+0.00%',
    change1d: '+0.10%',
    change7d: '+2.30%',
  },
  {
    asset: 'USDC',
    assetLogo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=040',
    name: 'Circle Internet Group',
    ticker: 'CRCL',
    exchange: '美股-NYSE',
    logo: 'https://www.circle.com/hubfs/logos/Circle_Logo_Green.svg',
    mNav: '0.27',
    marketCap: '$17.2B',
    holdingsValue: '$64.46B',
    holdingsAmount: '64.50B USDC',
    sharePrice: '$82.85',
    change24h: '+9.87%',
    change1d: '+10.5%',
    change7d: '+15.2%',
  },
  {
    asset: 'ETH',
    assetLogo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=040',
    name: 'BitMine Immersion',
    ticker: 'BMNR',
    exchange: '美股-NYSE',
    logo: 'https://bitmine.tech/wp-content/uploads/2021/06/BitMine-Logo-1.png',
    mNav: '0.73',
    marketCap: '$8.94B',
    holdingsValue: '$11.62B',
    holdingsAmount: '3.97M ETH',
    sharePrice: '$31.39',
    change24h: '+1.42%',
    change1d: '-0.88%',
    change7d: '+4.15%',
  }
];

function renderValueWithColor(val: string) {
  const isPositive = val.startsWith('+');
  const isNegative = val.startsWith('-');
  return (
    <span className={isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-[#e6edf3]'}>
      {val}
    </span>
  );
}

export function CryptoStocksWidget(props: { config: Record<string, any> }) {
  const size = (props.config?.size as string) || 'M'
  const isSmall = size === 'S'
  const isLarge = size === 'L' || size === 'XL'

  const textSize = isSmall ? 'text-[10px]' : isLarge ? 'text-sm' : 'text-xs'
  const paddingY = isSmall ? 'py-2' : isLarge ? 'py-4' : 'py-3'
  const paddingX = isSmall ? 'px-2' : isLarge ? 'px-4' : 'px-3'
  const iconSize = isSmall ? 'w-5 h-5' : isLarge ? 'w-8 h-8' : 'w-6 h-6'
  const logoSize = isSmall ? 'w-6 h-6' : isLarge ? 'w-10 h-10' : 'w-8 h-8'

  const rows = useMemo(() => initialCompanyData, [])

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex-1 min-h-0 rounded-xl border border-white/10 bg-[#0d1117]/60 flex flex-col overflow-hidden">
        {/* Scrollable Content (Both X and Y) */}
        <div className="flex-1 overflow-auto cf-scrollbar">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className={`text-[#8b949e] ${textSize} font-bold border-b border-white/10 bg-[#0d1117]/50 sticky top-0 z-10`}>
                <th className={`${paddingX} ${paddingY} text-left whitespace-nowrap`}>币种</th>
                <th className={`${paddingX} ${paddingY} text-left whitespace-nowrap`}>公司</th>
                <th className={`${paddingX} ${paddingY} text-center whitespace-nowrap`}>mNAV</th>
                <th className={`${paddingX} ${paddingY} text-center whitespace-nowrap`}>市值</th>
                <th className={`${paddingX} ${paddingY} text-center whitespace-nowrap`}>持币价值</th>
                <th className={`${paddingX} ${paddingY} text-center whitespace-nowrap`}>持币量</th>
                <th className={`${paddingX} ${paddingY} text-center whitespace-nowrap`}>股价</th>
                <th className={`${paddingX} ${paddingY} text-center whitespace-nowrap`}>24h涨跌</th>
                <th className={`${paddingX} ${paddingY} text-center whitespace-nowrap`}>1天增减</th>
              </tr>
            </thead>
            <tbody className={`text-white ${textSize} divide-y divide-white/10`}>
              {rows.map((row, index) => (
                <tr key={index} className="transition-colors hover:bg-white/5">
                  <td className={`${paddingX} ${paddingY}`}>
                    <div className="flex items-center gap-2">
                      <img src={row.assetLogo} alt={row.asset} className={`${iconSize} rounded-full object-contain bg-white rounded-full`} />
                      <span className="font-medium">{row.asset}</span>
                    </div>
                  </td>
                  <td className={`${paddingX} ${paddingY}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`${logoSize} rounded-full bg-white p-0.5 flex-none overflow-hidden`}>
                        <img src={row.logo} alt={row.name} className="w-full h-full object-contain" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold truncate">{row.name}</span>
                        <span className="text-[#8b949e] opacity-70 truncate">{row.ticker} {row.exchange}</span>
                      </div>
                    </div>
                  </td>
                  <td className={`${paddingX} ${paddingY} text-center`}>
                     <span className={row.mNav !== '-' && Number.parseFloat(row.mNav) < 1 ? 'text-red-400' : 'text-[#e6edf3]'}>
                      {row.mNav}
                    </span>
                  </td>
                  <td className={`${paddingX} ${paddingY} text-center font-mono`}>{row.marketCap}</td>
                  <td className={`${paddingX} ${paddingY} text-center font-mono`}>{row.holdingsValue}</td>
                  <td className={`${paddingX} ${paddingY} text-center font-mono whitespace-nowrap`}>{row.holdingsAmount}</td>
                  <td className={`${paddingX} ${paddingY} text-center font-mono`}>{row.sharePrice}</td>
                  <td className={`${paddingX} ${paddingY} text-center font-mono`}>{renderValueWithColor(row.change24h)}</td>
                  <td className={`${paddingX} ${paddingY} text-center font-mono`}>{renderValueWithColor(row.change1d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
