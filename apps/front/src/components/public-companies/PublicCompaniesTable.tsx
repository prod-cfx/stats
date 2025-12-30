'use client';

import { ArrowUpDown } from 'lucide-react';
import React from 'react';

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

const mockCompanyData: CompanyData[] = [
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
  },
  {
    asset: 'BCH',
    assetLogo: 'https://cryptologos.cc/logos/bitcoin-cash-bch-logo.png?v=040',
    name: 'Bitdeer Technologies Group',
    ticker: 'BTDR',
    exchange: '美股-NASDAQ',
    logo: 'https://www.bitdeer.com/favicon.ico',
    mNav: '-',
    marketCap: '$1.53B',
    holdingsValue: '-',
    holdingsAmount: '-',
    sharePrice: '$10.01',
    change24h: '+0.00%',
    change1d: '+0.05%',
    change7d: '-1.99%',
  },
];

export const PublicCompaniesTable = () => {
  const renderValueWithColor = (val: string) => {
    const isPositive = val.startsWith('+');
    const isNegative = val.startsWith('-');
    return (
      <span className={isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-[#e6edf3]'}>
        {val}
      </span>
    );
  };

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[1200px]">
          <thead>
            <tr className="text-[#8b949e] text-xs font-bold border-b border-[#30363d]">
              <th className="px-6 py-6 text-left">币种</th>
              <th className="px-6 py-6 text-left">公司</th>
              <th className="px-4 py-6">
                <div className="flex items-center justify-center gap-1">
                  mNAV <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-4 py-6">
                <div className="flex items-center justify-center gap-1">
                  市值 <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-4 py-6">
                <div className="flex items-center justify-center gap-1">
                  持币价值 <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-4 py-6">
                <div className="flex items-center justify-center gap-1">
                  持币量 <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-4 py-6">
                <div className="flex items-center justify-center gap-1">
                  股价 <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-4 py-6">
                <div className="flex items-center justify-center gap-1">
                  24h涨跌 <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-4 py-6">
                <div className="flex items-center justify-center gap-1 text-center">
                  增减比例<br/>(1天) <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-4 py-6">
                <div className="flex items-center justify-center gap-1 text-center">
                  增减比例<br/>(7天) <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {mockCompanyData.map((row, index) => (
              <tr 
                key={index} 
                className="border-b border-[#30363d] transition-colors hover:bg-[#1f2937]/30"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center justify-start gap-3">
                    <div className="w-6 h-6 flex-none">
                      <img src={row.assetLogo} alt={row.asset} className="w-full h-full rounded-full object-contain" />
                    </div>
                    <span className="text-white font-medium min-w-[50px]">{row.asset}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-white p-1 flex-none overflow-hidden">
                      <img src={row.logo} alt={row.name} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-white font-semibold">{row.name}</span>
                      <span className="text-[#8b949e] text-xs">{row.ticker} {row.exchange}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <span className={row.mNav !== '-' && Number.parseFloat(row.mNav) < 1 ? 'text-red-400' : 'text-[#e6edf3]'}>
                    {row.mNav}
                  </span>
                </td>
                <td className="px-4 py-4 text-center text-white">{row.marketCap}</td>
                <td className="px-4 py-4 text-center text-white">{row.holdingsValue}</td>
                <td className="px-4 py-4 text-center text-white">{row.holdingsAmount}</td>
                <td className="px-4 py-4 text-center text-white">{row.sharePrice}</td>
                <td className="px-4 py-4 text-center">{renderValueWithColor(row.change24h)}</td>
                <td className="px-4 py-4 text-center">{renderValueWithColor(row.change1d)}</td>
                <td className="px-4 py-4 text-center">{renderValueWithColor(row.change7d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

