/// 单笔成交记录（#1563 交易详情「成交」面板）。
///
/// 仅用于 UI 展示；接入真实 WS 时由后端 `aggTrade` 流映射。
class Trade {
  final DateTime time;
  final double price;
  final double qty;
  final bool isBuy;

  const Trade({
    required this.time,
    required this.price,
    required this.qty,
    required this.isBuy,
  });
}

/// 把 `BTCUSDT` 形态的 symbol 拆成 `(base, quote)`。
///
/// mock 阶段够用：覆盖 USDT / USDC / BUSD / BTC / ETH 等常见 quote。
/// 真实接入后由后端 `MarketMeta` 直接给出，前端不再做字符串解析。
(String base, String quote) splitSymbolAssets(String symbol) {
  const List<String> quotes = <String>['USDT', 'USDC', 'BUSD', 'BTC', 'ETH'];
  for (final String q in quotes) {
    if (symbol.endsWith(q) && symbol.length > q.length) {
      return (symbol.substring(0, symbol.length - q.length), q);
    }
  }
  return (symbol, '');
}
