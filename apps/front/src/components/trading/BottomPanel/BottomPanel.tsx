'use client';

import { FileSearch } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMockBasePrice } from '@/lib/mock/market';

export const BottomPanel = ({ symbol }: { symbol: string }) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'orders' | 'history' | 'positions' | 'pos_history' | 'assets'>('orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [posSideFilter, setPosSideFilter] = useState<'all' | 'long' | 'short'>('all');
  const [assetHideSmall, setAssetHideSmall] = useState(false);
  
  const tabs = [
    { id: 'orders', label: `${t('bottomPanel.currentOrders')} (2)` },
    { id: 'history', label: t('bottomPanel.orderHistory') },
    { id: 'positions', label: `${t('bottomPanel.currentPositions')} (1)` },
    { id: 'pos_history', label: t('bottomPanel.positionHistory') },
    { id: 'assets', label: t('bottomPanel.assets') }
  ];

  const baseAsset = useMemo(() => {
    if (symbol?.endsWith('USDT')) return symbol.slice(0, -4);
    return symbol ?? '';
  }, [symbol]);

  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US';

  const basePrice = useMemo(() => getMockBasePrice(symbol), [symbol]);

  const priceDigits = useMemo(() => {
    if (basePrice >= 1000) return 1;
    if (basePrice >= 1) return 2;
    return 6;
  }, [basePrice]);

  const priceFormatter = useMemo(() => {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: priceDigits, maximumFractionDigits: priceDigits });
  }, [locale, priceDigits]);

  const moneyFormatter = useMemo(() => {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [locale]);

  const stableSeed = useMemo(() => {
    // simple stable hash by symbol
    let h = 0;
    const s = symbol || 'BTCUSDT'; // 默认值
    for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h || 1;
  }, [symbol]);

  const seeded = useCallback((n: number) => {
    // deterministic pseudo-random in [0,1)
    const x = Math.sin((stableSeed + n) * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }, [stableSeed]);

  // Mock Data
  type OrderTypeKey = 'limit' | 'market'
  type OrderStatusKey = 'open' | 'filled' | 'cancelled'

  const mockOrders = useMemo(() => {
    const buyPrice = basePrice * 0.995;
    const sellPrice = basePrice * 1.01;
    const fmt = (n: number) => priceFormatter.format(n);
    return [
      { id: 1, time: '14:20:33', symbol, type: 'limit' as OrderTypeKey, side: 'buy', price: fmt(buyPrice), amount: '0.050', filled: '0.000', total: fmt(buyPrice * 0.05), status: 'open' as OrderStatusKey },
      { id: 2, time: '14:25:12', symbol, type: 'limit' as OrderTypeKey, side: 'sell', price: fmt(sellPrice), amount: '0.100', filled: '0.000', total: fmt(sellPrice * 0.1), status: 'open' as OrderStatusKey },
    ];
  }, [basePrice, priceFormatter, symbol]);

  const mockHistory = useMemo(() => {
    const today = '10:15:22';
    const yesterday = t('common.yesterday', { defaultValue: t('nav.yesterday') });
    const p1 = basePrice * (1 + (seeded(1) - 0.5) * 0.01);
    const p2 = basePrice * (1 + (seeded(2) - 0.5) * 0.02);
    const p3 = basePrice * (1 + (seeded(3) - 0.5) * 0.03);
    const fmt = (n: number) => priceFormatter.format(n);
    return [
      { id: 101, time: today, symbol, type: 'market' as OrderTypeKey, side: 'buy', price: fmt(p1), amount: '0.010', filled: '0.010', total: fmt(p1 * 0.01), status: 'filled' as OrderStatusKey },
      { id: 102, time: '09:05:11', symbol, type: 'limit' as OrderTypeKey, side: 'sell', price: fmt(p2), amount: '0.050', filled: '0.050', total: fmt(p2 * 0.05), status: 'filled' as OrderStatusKey },
      { id: 103, time: yesterday, symbol, type: 'limit' as OrderTypeKey, side: 'buy', price: fmt(p3), amount: '0.100', filled: '0.00', total: fmt(p3 * 0.1), status: 'cancelled' as OrderStatusKey },
    ];
  }, [basePrice, priceFormatter, seeded, symbol, t]);

  const mockPositions = useMemo(() => {
    const leverage = 50;
    const side: 'long' | 'short' = seeded(4) > 0.25 ? 'long' : 'short';
    const size = basePrice >= 1000 ? 0.5 : basePrice >= 100 ? 5 : 1200; // in baseAsset
    const entry = basePrice * (side === 'long' ? 0.998 : 1.002);
    const mark = basePrice * (side === 'long' ? 1.0002 : 0.9992);
    const liq = basePrice * (side === 'long' ? 0.978 : 1.022);
    const positionValue = mark * size;
    const margin = positionValue / leverage;
    const pnl = (side === 'long' ? (mark - entry) : (entry - mark)) * size;
    const roe = margin > 0 ? (pnl / margin) * 100 : 0;

    return [
      {
        id: 'p1',
        symbol,
        side,
        size,
        positionValue,
        entry,
        mark,
        liq,
        margin,
        leverage,
        pnl,
        roe,
      }
    ];
  }, [basePrice, seeded, symbol]);

  type PositionSide = 'long' | 'short'

  const filteredPositions = useMemo(() => {
    if (posSideFilter === 'all') return mockPositions;
    return mockPositions.filter(p => p.side === posSideFilter);
  }, [mockPositions, posSideFilter]);

  const mockPositionHistory = useMemo(() => {
    const mk = (idx: number, side: PositionSide) => {
      const size = basePrice >= 1000 ? 0.2 + seeded(idx) * 0.8 : basePrice >= 100 ? 1 + seeded(idx) * 8 : 300 + seeded(idx) * 2500;
      const entry = basePrice * (1 + (seeded(idx + 10) - 0.5) * 0.015);
      const exit = basePrice * (1 + (seeded(idx + 11) - 0.5) * 0.02);
      const pnl = (side === 'long' ? (exit - entry) : (entry - exit)) * size;
      const roe = pnl / Math.max(1, (entry * size) / 30) * 100;
      return {
        id: `ph-${idx}`,
        symbol,
        side,
        size,
        entry,
        exit,
        pnl,
        roe,
        openTime: `2026-01-0${(idx % 5) + 1} 09:${10 + idx}:2${idx}`,
        closeTime: `2026-01-0${(idx % 5) + 1} 12:${20 + idx}:1${idx}`,
      };
    };
    return [mk(1, 'long'), mk(2, 'short'), mk(3, 'long'), mk(4, 'long')];
  }, [basePrice, seeded, symbol]);

  const filteredPositionHistory = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    return mockPositionHistory.filter((p) => {
      const passSide = posSideFilter === 'all' || p.side === posSideFilter;
      const passQuery = !q || p.symbol.toUpperCase().includes(q) || baseAsset.toUpperCase().includes(q);
      return passSide && passQuery;
    });
  }, [baseAsset, mockPositionHistory, posSideFilter, searchQuery]);

  const mockAssets = useMemo(() => {
    const usdtEquity = 12_850 + seeded(20) * 2_500;
    const baseEquity = (basePrice >= 1000 ? 0.35 : basePrice >= 100 ? 8 : 3500) * (0.7 + seeded(21) * 0.4);
    const baseValue = baseEquity * basePrice;
    const totalEquity = usdtEquity + baseValue;
    const available = usdtEquity * (0.55 + seeded(22) * 0.25);
    const usedMargin = totalEquity * (0.12 + seeded(23) * 0.08);
    const unrealizedPnl = (seeded(24) - 0.5) * 350;
    const assets = [
      { asset: 'USDT', balance: usdtEquity, available, valueUsd: usdtEquity, change24h: (seeded(25) - 0.5) * 0.2 },
      { asset: baseAsset || 'BTC', balance: baseEquity, available: baseEquity * 0.8, valueUsd: baseValue, change24h: (seeded(26) - 0.5) * 6 },
      { asset: 'BTC', balance: 0.012 + seeded(27) * 0.02, available: 0.01, valueUsd: (0.012 + seeded(27) * 0.02) * getMockBasePrice('BTCUSDT'), change24h: (seeded(28) - 0.5) * 2 },
    ];
    return {
      summary: { totalEquity, available, usedMargin, unrealizedPnl },
      assets,
    };
  }, [baseAsset, basePrice, seeded]);

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    return mockAssets.assets.filter((a) => {
      const passQuery = !q || a.asset.toUpperCase().includes(q);
      const passSmall = !assetHideSmall || a.valueUsd >= 10;
      return passQuery && passSmall;
    });
  }, [assetHideSmall, mockAssets.assets, searchQuery]);

  const renderOrderType = (key: OrderTypeKey) => t(`bottomPanel.orderTypes.${key}`)
  const renderOrderStatus = (key: OrderStatusKey) => t(`bottomPanel.statuses.${key}`)
  const renderPositionSide = (side: PositionSide) => (side === 'long' ? t('bottomPanel.long') : t('bottomPanel.short'))

  const renderContent = () => {
    switch (activeTab) {
      case 'orders':
        return (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] text-[color:var(--cf-muted)] border-b border-[color:var(--cf-border)]">
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.time')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.contract')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.type')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.side')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.price')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.amount')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.filled')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.total')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.status')}</th>
                  <th className="py-2 px-4 font-normal text-right">{t('bottomPanel.actions')}</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {mockOrders.map(order => (
                  <tr key={order.id} className="border-b border-[color:var(--cf-border)] hover:bg-[color:var(--cf-surface-hover)]">
                    <td className="py-2.5 px-4 text-[color:var(--cf-muted)]">{order.time}</td>
                    <td className="py-2.5 px-4 font-medium">{order.symbol}</td>
                    <td className="py-2.5 px-4">{renderOrderType(order.type)}</td>
                    <td className={`py-2.5 px-4 font-bold ${order.side === 'buy' ? 'text-[#2ea043]' : 'text-[#da3633]'}`}>
                      {order.side === 'buy' ? t('bottomPanel.buyOpenLong') : t('bottomPanel.sellOpenShort')}
                    </td>
                    <td className="py-2.5 px-4">{order.price}</td>
                    <td className="py-2.5 px-4">{order.amount}</td>
                    <td className="py-2.5 px-4">{order.filled}</td>
                    <td className="py-2.5 px-4">{order.total}</td>
                    <td className="py-2.5 px-4">{renderOrderStatus(order.status)}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button type="button" className="text-primary hover:opacity-80">{t('bottomPanel.cancel')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      
      case 'history':
        return (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] text-[color:var(--cf-muted)] border-b border-[color:var(--cf-border)]">
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.time')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.contract')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.type')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.side')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.price')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.volume')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.turnover')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.status')}</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {mockHistory.map(item => (
                  <tr key={item.id} className="border-b border-[color:var(--cf-border)] hover:bg-[color:var(--cf-surface-hover)]">
                    <td className="py-2.5 px-4 text-[color:var(--cf-muted)]">{item.time}</td>
                    <td className="py-2.5 px-4 font-medium">{item.symbol}</td>
                    <td className="py-2.5 px-4">{renderOrderType(item.type)}</td>
                    <td className={`py-2.5 px-4 font-bold ${item.side === 'buy' ? 'text-[#2ea043]' : 'text-[#da3633]'}`}>
                      {item.side === 'buy' ? t('bottomPanel.buy') : t('bottomPanel.sell')}
                    </td>
                    <td className="py-2.5 px-4">{item.price}</td>
                    <td className="py-2.5 px-4">{item.filled}</td>
                    <td className="py-2.5 px-4">{item.total}</td>
                    <td className="py-2.5 px-4 text-[color:var(--cf-muted)]">{renderOrderStatus(item.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'positions':
        return (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] text-[color:var(--cf-muted)] border-b border-[color:var(--cf-border)]">
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.contract')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.positionSize')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.positionValue')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.entryPrice')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.markPrice')}</th>
                  <th className="py-2 px-4 font-normal text-orange-400">{t('bottomPanel.liqPrice')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.marginLeverage')}</th>
                  <th className="py-2 px-4 font-normal">{t('bottomPanel.unrealizedPnl')}</th>
                  <th className="py-2 px-4 font-normal text-right">{t('bottomPanel.actions')}</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {filteredPositions.map(pos => {
                  const pnlColor = pos.pnl >= 0 ? 'text-[#2ea043]' : 'text-[#da3633]';
                  const sideColor = pos.side === 'long' ? 'text-[#2ea043]' : 'text-[#da3633]';
                  const sideBar = pos.side === 'long' ? 'bg-[#2ea043]' : 'bg-[#da3633]';
                  const pnlText = `${pos.pnl >= 0 ? '+' : ''}${moneyFormatter.format(pos.pnl)} (${pos.roe >= 0 ? '+' : ''}${pos.roe.toFixed(2)}%)`;
                  return (
                  <tr key={pos.id} className="border-b border-[color:var(--cf-border)] hover:bg-[color:var(--cf-surface-hover)]">
                    <td className="py-2.5 px-4 font-medium flex items-center gap-1">
                      <div className={`w-1 h-4 rounded-sm ${sideBar}`} />
                      <span className="whitespace-nowrap">{pos.symbol}</span>
                    </td>
                    <td className={`py-2.5 px-4 font-bold ${sideColor} whitespace-nowrap`}>
                      {moneyFormatter.format(pos.size)} {baseAsset}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">{moneyFormatter.format(pos.positionValue)}</td>
                    <td className="py-2.5 px-4 whitespace-nowrap">{priceFormatter.format(pos.entry)}</td>
                    <td className="py-2.5 px-4 whitespace-nowrap">{priceFormatter.format(pos.mark)}</td>
                    <td className="py-2.5 px-4 text-orange-400 whitespace-nowrap">{priceFormatter.format(pos.liq)}</td>
                    <td className="py-2.5 px-4 whitespace-nowrap">{moneyFormatter.format(pos.margin)} ({pos.leverage}x)</td>
                    <td className={`py-2.5 px-4 font-medium whitespace-nowrap ${pnlColor}`}>{pnlText}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button type="button" className="bg-[color:var(--cf-surface-2)] hover:bg-[color:var(--cf-surface-hover)] px-2 py-1 rounded text-[10px] border border-[color:var(--cf-border)] whitespace-nowrap">
                        {t('bottomPanel.close')}
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      
      case 'pos_history':
        return (
          <div className="w-full">
            {/* Toolbar */}
            <div className="px-4 py-3 border-b border-[color:var(--cf-border)] flex items-center gap-3 flex-wrap bg-[color:var(--cf-bg)] sticky top-[48px] z-[5]">
              <div className="flex items-center gap-2 bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('bottomPanel.searchPlaceholder')}
                  className="bg-transparent text-xs text-[color:var(--cf-text)] placeholder-[color:var(--cf-muted)] outline-none w-[220px]"
                />
              </div>
              <div className="flex items-center gap-2">
                {(['all', 'long', 'short'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPosSideFilter(k)}
                    className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                      posSideFilter === k
                        ? 'bg-[color:var(--cf-surface-2)] border-[#58a6ff] text-[color:var(--cf-text)]'
                        : 'bg-[color:var(--cf-bg)] border-[color:var(--cf-border)] text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)]'
                    }`}
                  >
                    {k === 'all' ? t('common.all') : k === 'long' ? t('bottomPanel.long') : t('bottomPanel.short')}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[11px] text-[color:var(--cf-muted)] border-b border-[color:var(--cf-border)]">
                    <th className="py-2 px-4 font-normal">{t('bottomPanel.contract')}</th>
                    <th className="py-2 px-4 font-normal">{t('bottomPanel.side')}</th>
                    <th className="py-2 px-4 font-normal">{t('bottomPanel.positionSize')}</th>
                    <th className="py-2 px-4 font-normal">{t('bottomPanel.entryPrice')}</th>
                    <th className="py-2 px-4 font-normal">{t('bottomPanel.exitPrice')}</th>
                    <th className="py-2 px-4 font-normal">{t('bottomPanel.realizedPnl')}</th>
                    <th className="py-2 px-4 font-normal">{t('bottomPanel.openTime')}</th>
                    <th className="py-2 px-4 font-normal">{t('bottomPanel.closeTime')}</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {filteredPositionHistory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10">
                        <div className="flex flex-col items-center justify-center text-[color:var(--cf-muted)]">
                          <FileSearch className="w-10 h-10 opacity-50" />
                          <span className="text-xs mt-2">{t('bottomPanel.noData')}</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPositionHistory.map((p) => {
                      const pnlColor = p.pnl >= 0 ? 'text-[#2ea043]' : 'text-[#da3633]';
                      const sideColor = p.side === 'long' ? 'text-[#2ea043]' : 'text-[#da3633]';
                      const pnlText = `${p.pnl >= 0 ? '+' : ''}${moneyFormatter.format(p.pnl)} (${p.roe >= 0 ? '+' : ''}${p.roe.toFixed(2)}%)`;
                      return (
                        <tr key={p.id} className="border-b border-[color:var(--cf-border)] hover:bg-[color:var(--cf-surface-hover)]">
                          <td className="py-2.5 px-4 font-medium whitespace-nowrap">{p.symbol}</td>
                          <td className={`py-2.5 px-4 font-bold whitespace-nowrap ${sideColor}`}>{renderPositionSide(p.side)}</td>
                          <td className="py-2.5 px-4 whitespace-nowrap">{moneyFormatter.format(p.size)} {baseAsset}</td>
                          <td className="py-2.5 px-4 whitespace-nowrap">{priceFormatter.format(p.entry)}</td>
                          <td className="py-2.5 px-4 whitespace-nowrap">{priceFormatter.format(p.exit)}</td>
                          <td className={`py-2.5 px-4 font-medium whitespace-nowrap ${pnlColor}`}>{pnlText}</td>
                          <td className="py-2.5 px-4 text-[color:var(--cf-muted)] whitespace-nowrap">{p.openTime}</td>
                          <td className="py-2.5 px-4 text-[color:var(--cf-muted)] whitespace-nowrap">{p.closeTime}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'assets':
        return (
          <div className="w-full">
            {/* Toolbar */}
            <div className="px-4 py-3 border-b border-[color:var(--cf-border)] flex items-center justify-between gap-3 flex-wrap bg-[color:var(--cf-bg)] sticky top-[48px] z-[5]">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded px-3 py-1.5">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('bottomPanel.searchAssetPlaceholder')}
                    className="bg-transparent text-xs text-[color:var(--cf-text)] placeholder-[color:var(--cf-muted)] outline-none w-[220px]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setAssetHideSmall(v => !v)}
                  className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                    assetHideSmall
                      ? 'bg-[color:var(--cf-surface-2)] border-[#58a6ff] text-[color:var(--cf-text)]'
                      : 'bg-[color:var(--cf-bg)] border-[color:var(--cf-border)] text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)]'
                  }`}
                >
                  {t('bottomPanel.hideSmallBalances')}
                </button>
              </div>
              <div className="flex items-center gap-2">
                {['deposit', 'withdraw', 'transfer'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => console.log(`TODO: ${k}`)}
                    className="px-3 py-1.5 text-xs rounded bg-[color:var(--cf-surface-2)] border border-[color:var(--cf-border)] text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)] transition-colors"
                  >
                    {t(`bottomPanel.actions_${k}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
              {[
                { k: 'totalEquity', v: mockAssets.summary.totalEquity, color: 'text-[#c9d1d9]' },
                { k: 'available', v: mockAssets.summary.available, color: 'text-[#c9d1d9]' },
                { k: 'usedMargin', v: mockAssets.summary.usedMargin, color: 'text-orange-400' },
                { k: 'unrealizedPnl', v: mockAssets.summary.unrealizedPnl, color: mockAssets.summary.unrealizedPnl >= 0 ? 'text-[#2ea043]' : 'text-[#da3633]' },
              ].map((it) => (
                <div key={it.k} className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-lg p-3">
                  <div className="text-[11px] text-[color:var(--cf-muted)]">{t(`bottomPanel.assetSummary.${it.k}`)}</div>
                  <div className={`mt-1 text-sm font-semibold ${it.color}`}>
                    {it.k === 'unrealizedPnl'
                      ? `${it.v >= 0 ? '+' : ''}${moneyFormatter.format(it.v)}`
                      : `$${moneyFormatter.format(it.v)}`}
                  </div>
                </div>
              ))}
            </div>

            {/* Assets table */}
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[11px] text-[color:var(--cf-muted)] border-b border-[color:var(--cf-border)]">
                    <th className="py-2 px-4 font-normal">{t('bottomPanel.asset')}</th>
                    <th className="py-2 px-4 font-normal text-right">{t('bottomPanel.balance')}</th>
                    <th className="py-2 px-4 font-normal text-right">{t('bottomPanel.availableBalance')}</th>
                    <th className="py-2 px-4 font-normal text-right">{t('bottomPanel.valueUsd')}</th>
                    <th className="py-2 px-4 font-normal text-right">{t('bottomPanel.change24h')}</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10">
                        <div className="flex flex-col items-center justify-center text-[color:var(--cf-muted)]">
                          <FileSearch className="w-10 h-10 opacity-50" />
                          <span className="text-xs mt-2">{t('bottomPanel.noData')}</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAssets.map((a) => {
                      const chColor = a.change24h >= 0 ? 'text-[#2ea043]' : 'text-[#da3633]';
                      return (
                        <tr key={a.asset} className="border-b border-[color:var(--cf-border)] hover:bg-[color:var(--cf-surface-hover)]">
                          <td className="py-2.5 px-4 font-medium whitespace-nowrap">{a.asset}</td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">{moneyFormatter.format(a.balance)}</td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">{moneyFormatter.format(a.available)}</td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">${moneyFormatter.format(a.valueUsd)}</td>
                          <td className={`py-2.5 px-4 text-right whitespace-nowrap ${chColor}`}>{`${a.change24h >= 0 ? '+' : ''}${a.change24h.toFixed(2)}%`}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-[color:var(--cf-muted)] min-h-[150px]">
            <div className="flex flex-col items-center gap-2 opacity-50">
              <FileSearch className="w-10 h-10" />
              <span className="text-xs">{t('bottomPanel.noData')}</span>
            </div>
          </div>
        );
    }
  };

  return (
    <div
      suppressHydrationWarning
      className="w-full bg-[color:var(--cf-surface)] border-t border-[color:var(--cf-border)] flex flex-col text-[color:var(--cf-text)] min-h-full"
    >
      {/* Tabs */}
      <div className="flex border-b border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] sticky top-0 z-10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-3 text-sm font-medium transition-colors border-t-2 ${
              activeTab === tab.id
                ? 'bg-[color:var(--cf-surface-2)] border-orange-400 text-[color:var(--cf-text)]'
                : 'border-transparent text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-[color:var(--cf-surface)]">
        {renderContent()}
      </div>
    </div>
  );
};
