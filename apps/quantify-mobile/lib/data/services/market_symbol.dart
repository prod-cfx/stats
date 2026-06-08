const List<String> kMarketQuoteAssets = <String>['USDT', 'USDC', 'BUSD', 'USD'];

/// Normalize user-facing symbols to backend kline pair format.
///
/// Front sends `BTCUSDT` to `/kline`; backend returns empty data for bare `BTC`.
String normalizeKlineSymbol(String symbol) {
  final String normalized = symbol.trim().toUpperCase().replaceAll(
    RegExp(r'[/_\-\s]'),
    '',
  );
  if (normalized.isEmpty) return normalized;
  for (final String quote in kMarketQuoteAssets) {
    if (normalized.endsWith(quote) && normalized.length > quote.length) {
      return normalized;
    }
  }
  return '${normalized}USDT';
}
