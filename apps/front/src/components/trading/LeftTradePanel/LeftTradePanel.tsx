'use client';

import type { DataSource } from '@/types/trading';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMockBasePrice, parseUsdtSymbol } from '@/lib/mock/market';

interface LeftTradePanelProps {
  symbol: string;
  isAggregated: boolean;
  selectedExchange: DataSource;
}

export const LeftTradePanel = ({ symbol, isAggregated, selectedExchange }: LeftTradePanelProps) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('open'); // 'open' | 'close'
  const [orderType, setOrderType] = useState('limit'); // 'limit' | 'market' | 'stop'
  const [leverage] = useState(50);
  const [price, setPrice] = useState('0');
  const [amount, setAmount] = useState('0.00');
  const [percent, setPercent] = useState(0);

  const percents = [0, 25, 50, 75, 100];

  const basePrice = useMemo(() => getMockBasePrice(symbol), [symbol]);
  const baseAsset = useMemo(() => parseUsdtSymbol(symbol).base, [symbol]);
  const priceOffset = isAggregated ? 0 : selectedExchange === 'binance' ? basePrice * 0.0001 : basePrice * -0.0001;

  // Keep the input price in sync with symbol/source changes unless user is actively editing
  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setPrice((basePrice + priceOffset).toFixed(basePrice >= 1000 ? 1 : 4));
  }, [basePrice, priceOffset]);

  // Mock raw values (keep numbers so locale switching works)
  const maxBuyPrice = basePrice * 1.005
  const minSellPrice = basePrice * 0.995
  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
  const priceFormatter = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale])

  return (
    <div className="w-full h-full bg-[color:var(--cf-surface)] flex flex-col p-4 text-[color:var(--cf-text)] overflow-y-auto no-scrollbar">
      {/* Open/Close Tabs */}
      <div className="flex bg-[color:var(--cf-surface-2)] rounded-md p-1 mb-4 flex-none">
        <button
          type="button"
          onClick={() => setActiveTab('open')}
          className={`flex-1 py-1.5 text-sm font-semibold rounded transition-all ${
            activeTab === 'open' ? 'bg-[#2ea043] text-white shadow-lg' : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)]'
          }`}
        >
          {t('tradePanel.openPosition')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('close')}
          className={`flex-1 py-1.5 text-sm font-semibold rounded transition-all ${
            activeTab === 'close' ? 'bg-[#374151] text-white shadow-lg' : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)]'
          }`}
        >
          {t('tradePanel.closePosition')}
        </button>
      </div>

      {/* Margin Mode & Leverage */}
      <div className="flex gap-2 mb-4 flex-none">
        <div className="flex-1 bg-[color:var(--cf-surface-2)] border border-[color:var(--cf-border)] rounded px-3 py-1.5 flex justify-between items-center cursor-pointer hover:bg-[color:var(--cf-surface-hover)] transition-colors">
          <span className="text-xs">{t('tradePanel.marginCross')}</span>
          <span className="text-[10px] text-[color:var(--cf-muted)]">▼</span>
        </div>
        <div className="flex-1 bg-[color:var(--cf-surface-2)] border border-[color:var(--cf-border)] rounded px-3 py-1.5 flex justify-between items-center cursor-pointer hover:bg-[color:var(--cf-surface-hover)] transition-colors">
          <span className="text-xs font-bold">{leverage}x</span>
          <span className="text-[10px] text-[color:var(--cf-muted)]">▼</span>
        </div>
      </div>

      {/* Order Type Tabs */}
      <div className="flex border-b border-[color:var(--cf-border)] mb-4 flex-none">
        {['limit', 'market', 'stop'].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setOrderType(type)}
            className={`flex-1 pb-2 text-xs transition-colors relative ${
              orderType === type
                ? 'text-orange-400 font-bold'
                : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)]'
            }`}
          >
            {type === 'limit'
              ? t('tradePanel.orderTypeLimit')
              : type === 'market'
                ? t('tradePanel.orderTypeMarket')
                : t('tradePanel.orderTypeStop')}
            {orderType === type && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400" />
            )}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="space-y-4 mb-6 flex-none">
        <div>
          <label className="text-xs text-[color:var(--cf-muted)] mb-1.5 block">{t('tradePanel.priceLabel')}</label>
          <div className="relative">
            <input
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded px-3 py-2 text-right text-sm focus:outline-none focus:border-orange-400 transition-colors"
            />
            <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] bg-[color:var(--cf-surface-hover)] px-1.5 py-0.5 rounded text-[color:var(--cf-text)] hover:opacity-90 transition-colors">
              {t('tradePanel.bestPrice')}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-[color:var(--cf-muted)] mb-1.5 block">{t('tradePanel.amountLabel')}</label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded px-3 py-2 text-right text-sm focus:outline-none focus:border-orange-400 transition-colors"
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Slider */}
      <div className="mb-6 px-1 flex-none">
        <input
          type="range"
          min="0"
          max="100"
          value={percent}
          onChange={(e) => setPercent(Number.parseInt(e.target.value, 10))}
          className="w-full h-1 bg-[color:var(--cf-border)] rounded-lg appearance-none cursor-pointer accent-orange-400 mb-3"
        />
        <div className="flex justify-between text-[10px] text-[color:var(--cf-muted)]">
          {percents.map((p) => (
            <span
              key={p}
              onClick={() => setPercent(p)}
              className={`cursor-pointer transition-colors ${percent >= p ? 'text-orange-400 font-bold' : 'hover:text-[color:var(--cf-text)]'}`}
            >
              {p}%
            </span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2 text-xs text-[color:var(--cf-muted)] mb-6 flex-none">
        <div className="flex justify-between items-center">
          <span>{t('tradePanel.available')}</span>
          <span className="text-[color:var(--cf-text)] font-medium">-- USDT</span>
        </div>
        <div className="flex justify-between items-center">
          <span>{t('tradePanel.maxLong')}</span>
          <span className="text-[color:var(--cf-text)] font-medium">{`-- ${baseAsset}`}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>{t('tradePanel.maxShort')}</span>
          <span className="text-[color:var(--cf-text)] font-medium">{`-- ${baseAsset}`}</span>
        </div>
      </div>

      {/* Buy/Sell Buttons */}
      <div className="flex gap-3 mb-6 flex-none">
        <button
          type="button"
          onClick={() => console.log('TODO: Open Long')}
          className="flex-1 bg-[#2ea043] hover:bg-[#3fb950] text-white font-bold py-2.5 rounded text-sm transition-all active:scale-[0.98] shadow-lg shadow-green-900/20"
        >
          {t('tradePanel.openLong')}
        </button>
        <button
          type="button"
          onClick={() => console.log('TODO: Open Short')}
          className="flex-1 bg-[#da3633] hover:bg-[#f85149] text-white font-bold py-2.5 rounded text-sm transition-all active:scale-[0.98] shadow-lg shadow-red-900/20"
        >
          {t('tradePanel.openShort')}
        </button>
      </div>

      {/* Cost Info - Fixed below buttons */}
      <div className="space-y-2 text-xs border-t border-[color:var(--cf-border)] pt-4 mt-4 flex-none">
        <div className="flex justify-between">
          <span className="text-[color:var(--cf-muted)]">{t('tradePanel.cost')}</span>
          <span className="text-[color:var(--cf-text)]">0.00 USDT</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[color:var(--cf-muted)]">{t('tradePanel.maxBuy')}</span>
          <span className="text-[color:var(--cf-text)]">{priceFormatter.format(maxBuyPrice)} USDT</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[color:var(--cf-muted)]">{t('tradePanel.minSell')}</span>
          <span className="text-[color:var(--cf-text)]">{priceFormatter.format(minSellPrice)} USDT</span>
        </div>
      </div>
    </div>
  );
};
