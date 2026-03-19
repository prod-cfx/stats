export type MockBaseAsset =
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

export function getMockVolatility(price: number): number {
  // Roughly scale: larger assets swing more in absolute terms
  if (price >= 10000) return 80;
  if (price >= 1000) return 8;
  if (price >= 100) return 0.8;
  if (price >= 1) return 0.02;
  return 0.005;
}


