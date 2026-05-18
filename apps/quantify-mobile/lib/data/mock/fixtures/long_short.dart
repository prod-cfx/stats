/// 多空比静态映射：`symbol` -> (longRatio, shortRatio)，和为 1。
const Map<String, List<double>> mockLongShortBySymbol = <String, List<double>>{
  'BTCUSDT': <double>[0.58, 0.42],
  'ETHUSDT': <double>[0.52, 0.48],
  'SOLUSDT': <double>[0.61, 0.39],
  'BNBUSDT': <double>[0.49, 0.51],
  'XRPUSDT': <double>[0.46, 0.54],
  'DOGEUSDT': <double>[0.66, 0.34],
  'ADAUSDT': <double>[0.50, 0.50],
  'AVAXUSDT': <double>[0.44, 0.56],
};
