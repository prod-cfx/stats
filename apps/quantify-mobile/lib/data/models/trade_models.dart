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

/// 把 `BTCUSDT` / `BTC/USDT` / `BTC-USDT` 形态的 symbol 拆成 `(base, quote)`。
///
/// mock 阶段够用：覆盖 USDT / USDC / BUSD / BTC / ETH 等常见 quote。
/// 真实接入后由后端 `MarketMeta` 直接给出，前端不再做字符串解析。
(String base, String quote) splitSymbolAssets(String symbol) {
  final String trimmed = symbol.trim();
  for (final String separator in <String>['/', '-']) {
    final int index = trimmed.indexOf(separator);
    if (index > 0 && index < trimmed.length - 1) {
      return (
        trimmed.substring(0, index).toUpperCase(),
        trimmed.substring(index + 1).toUpperCase(),
      );
    }
  }
  const List<String> quotes = <String>['USDT', 'USDC', 'BUSD', 'BTC', 'ETH'];
  for (final String q in quotes) {
    if (trimmed.endsWith(q) && trimmed.length > q.length) {
      return (trimmed.substring(0, trimmed.length - q.length), q);
    }
  }
  return (trimmed, '');
}
