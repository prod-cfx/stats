type MockBaseAsset =
  | 'BTC'
  | 'ETH'
  | 'SOL'
  | 'XRP'
  | 'BNB'
  | 'DOGE'
  | 'ADA'
  | 'AVAX'
  | 'LINK'
  | 'DOT';

const BASE_PRICE_USDT: Record<MockBaseAsset, number> = {
  BTC: 87010.0,
  ETH: 4850.2,
  SOL: 145.8,
  XRP: 1.12,
  BNB: 620.5,
  DOGE: 0.38,
  ADA: 0.75,
  AVAX: 42.6,
  LINK: 18.9,
  DOT: 8.4,
};

export function parseUsdtSymbol(symbol: string | undefined | null): { base: string; quote: 'USDT' } {
  if (!symbol) {
    return { base: 'BTC', quote: 'USDT' }; // 默认值
  }
  if (symbol.endsWith('USDT')) {
    return { base: symbol.slice(0, -4), quote: 'USDT' };
  }
  // fallback
  return { base: symbol, quote: 'USDT' };
}

export function getMockBasePrice(symbol: string | undefined | null): number {
  const { base } = parseUsdtSymbol(symbol);
  return BASE_PRICE_USDT[(base as MockBaseAsset)] ?? 100;
}

export function getMockTickSize(price: number): number {
  if (price >= 10000) return 0.5;
  if (price >= 1000) return 0.1;
  if (price >= 100) return 0.01;
  if (price >= 1) return 0.0001;
  return 0.00001;
}


