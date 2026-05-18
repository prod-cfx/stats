import '../../models/ticker_models.dart';

/// 静态行情列表，用于 `MockTickerRepository.listTickers`。
/// 真实 API 接入后应替换为 `GET /markets/tickers` 等聚合接口的响应。
const List<Ticker> mockTickers = <Ticker>[
  Ticker(symbol: 'BTCUSDT', price: 68250.42, changePercent: 1.82, volume24h: 2.13e10),
  Ticker(symbol: 'ETHUSDT', price: 3520.18, changePercent: -0.74, volume24h: 1.05e10),
  Ticker(symbol: 'SOLUSDT', price: 178.55, changePercent: 3.21, volume24h: 2.4e9),
  Ticker(symbol: 'BNBUSDT', price: 612.30, changePercent: 0.45, volume24h: 1.1e9),
  Ticker(symbol: 'XRPUSDT', price: 0.5234, changePercent: -1.12, volume24h: 8.7e8),
  Ticker(symbol: 'DOGEUSDT', price: 0.1582, changePercent: 4.66, volume24h: 1.5e9),
  Ticker(symbol: 'ADAUSDT', price: 0.4421, changePercent: 0.18, volume24h: 6.2e8),
  Ticker(symbol: 'AVAXUSDT', price: 38.72, changePercent: -2.05, volume24h: 5.1e8),
];
