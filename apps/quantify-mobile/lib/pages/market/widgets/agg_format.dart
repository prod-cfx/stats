/// 聚合屏数字格式化（设计稿 `fmtOiQty`/`fmtOiUsd`/`fmtVolUsd`）。纯函数，可单测。
library;

String _trimZero(String s) {
  if (!s.contains('.')) return s;
  return s.replaceFirst(RegExp(r'\.?0+$'), '');
}

/// 持仓量（币本位）：亿 / 万 / 原值 + 币种后缀。
String fmtOiQty(double n, String coin) {
  if (n >= 1e8) return '${_trimZero((n / 1e8).toStringAsFixed(2))}亿 $coin';
  if (n >= 1e4) return '${_trimZero((n / 1e4).toStringAsFixed(2))}万 $coin';
  return '${n.toStringAsFixed(0)} $coin';
}

/// 持仓量（美元）：US$亿 / US$万 / 原值。
String fmtOiUsd(double n) {
  if (n >= 1e8) return 'US\$${_trimZero((n / 1e8).toStringAsFixed(2))}亿';
  if (n >= 1e4) return 'US\$${_trimZero((n / 1e4).toStringAsFixed(2))}万';
  return 'US\$${n.toStringAsFixed(0)}';
}

/// 带符号百分比（保留两位）。
String fmtSignedPct(double p) {
  final String sign = p > 0 ? '+' : '';
  return '$sign${p.toStringAsFixed(2)}%';
}

/// 成交量（单位十亿美元 B）。
String fmtVolUsd(double b) => '\$${b.toStringAsFixed(2)}B';
