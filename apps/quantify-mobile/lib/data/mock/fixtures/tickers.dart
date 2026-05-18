import '../../models/ticker_models.dart';

/// 静态行情列表，用于 `MockTickerRepository.listTickers`。
/// 真实 API 接入后应替换为 `GET /markets/tickers` 等聚合接口的响应。
const List<Ticker> mockTickers = <Ticker>[
  Ticker(
    symbol: 'BTCUSDT',
    price: 68250.42,
    changePercent: 1.82,
    volume24h: 2.13e10,
  ),
  Ticker(
    symbol: 'ETHUSDT',
    price: 3520.18,
    changePercent: -0.74,
    volume24h: 1.05e10,
  ),
  Ticker(
    symbol: 'SOLUSDT',
    price: 178.55,
    changePercent: 3.21,
    volume24h: 2.4e9,
  ),
  Ticker(
    symbol: 'BNBUSDT',
    price: 612.30,
    changePercent: 0.45,
    volume24h: 1.1e9,
  ),
  Ticker(
    symbol: 'XRPUSDT',
    price: 0.5234,
    changePercent: -1.12,
    volume24h: 8.7e8,
  ),
  Ticker(
    symbol: 'DOGEUSDT',
    price: 0.1582,
    changePercent: 4.66,
    volume24h: 1.5e9,
  ),
  Ticker(
    symbol: 'ADAUSDT',
    price: 0.4421,
    changePercent: 0.18,
    volume24h: 6.2e8,
  ),
  Ticker(
    symbol: 'AVAXUSDT',
    price: 38.72,
    changePercent: -2.05,
    volume24h: 5.1e8,
  ),
  Ticker(
    symbol: 'AAVEUSDT',
    price: 92.44,
    changePercent: 1.14,
    volume24h: 2.2e8,
  ),
  Ticker(
    symbol: 'ATOMUSDT',
    price: 8.31,
    changePercent: -0.38,
    volume24h: 1.8e8,
  ),
  Ticker(
    symbol: 'BCHUSDT',
    price: 446.10,
    changePercent: 2.08,
    volume24h: 4.9e8,
  ),
  Ticker(symbol: 'DOTUSDT', price: 6.74, changePercent: 0.91, volume24h: 2.7e8),
  Ticker(
    symbol: 'ETCUSDT',
    price: 27.88,
    changePercent: -1.33,
    volume24h: 2.1e8,
  ),
  Ticker(symbol: 'FILUSDT', price: 5.92, changePercent: 1.76, volume24h: 1.9e8),
  Ticker(
    symbol: 'LINKUSDT',
    price: 17.34,
    changePercent: 3.03,
    volume24h: 5.8e8,
  ),
  Ticker(
    symbol: 'LTCUSDT',
    price: 84.15,
    changePercent: -0.44,
    volume24h: 3.2e8,
  ),
  Ticker(
    symbol: 'MATICUSDT',
    price: 0.7132,
    changePercent: 0.67,
    volume24h: 2.6e8,
  ),
  Ticker(
    symbol: 'NEARUSDT',
    price: 7.18,
    changePercent: 4.22,
    volume24h: 4.1e8,
  ),
  Ticker(symbol: 'OPUSDT', price: 2.48, changePercent: -2.11, volume24h: 1.7e8),
  Ticker(
    symbol: 'PEPEUSDT',
    price: 0.000011,
    changePercent: 5.43,
    volume24h: 6.4e8,
  ),
  Ticker(
    symbol: 'SHIBUSDT',
    price: 0.000024,
    changePercent: -0.86,
    volume24h: 4.4e8,
  ),
  Ticker(symbol: 'SUIUSDT', price: 1.03, changePercent: 2.36, volume24h: 3.5e8),
  Ticker(
    symbol: 'TRXUSDT',
    price: 0.1187,
    changePercent: 0.23,
    volume24h: 2.8e8,
  ),
  Ticker(
    symbol: 'UNIUSDT',
    price: 10.96,
    changePercent: -1.57,
    volume24h: 2.0e8,
  ),
  Ticker(symbol: 'WLDUSDT', price: 5.06, changePercent: 1.02, volume24h: 1.6e8),
  Ticker(
    symbol: 'XLMUSDT',
    price: 0.1074,
    changePercent: -0.19,
    volume24h: 1.2e8,
  ),
];
