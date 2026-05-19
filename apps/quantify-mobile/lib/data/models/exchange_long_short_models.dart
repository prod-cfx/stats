import 'package:flutter/material.dart';

/// 单家交易所的多空持仓快照。
@immutable
class ExchangeLongShort {
  const ExchangeLongShort({
    required this.exchange,
    required this.color,
    required this.glyph,
    required this.longAmount,
    required this.shortAmount,
    required this.longPct,
    required this.shortPct,
  });

  /// 交易所名称（Binance / OKX / Bybit / Bitget / HTX / HyperLiquid）。
  final String exchange;

  /// 列表色标圆点颜色。
  final Color color;

  /// 色块字符（通常是交易所首字母）。
  final String glyph;

  /// 多头持仓金额格式化字符串（如 `$1.82B`）。
  final String longAmount;

  /// 空头持仓金额格式化字符串。
  final String shortAmount;

  /// 多头百分比（0..100）。
  final double longPct;

  /// 空头百分比（0..100）。
  final double shortPct;
}

/// 多空比页 hero 卡 + 交易所列表的整体快照。
@immutable
class MarketLongShortSnapshot {
  const MarketLongShortSnapshot({
    required this.symbol,
    required this.baseAsset,
    required this.assetGlyph,
    required this.assetGradientStart,
    required this.assetGradientEnd,
    required this.totalNotional,
    required this.longNotional,
    required this.shortNotional,
    required this.longPct,
    required this.shortPct,
    required this.exchanges,
    required this.timestamp,
  });

  final String symbol;
  final String baseAsset;
  final String assetGlyph;

  /// Hero 卡 asset glyph 圆形容器的渐变起始色。
  final Color assetGradientStart;

  /// Hero 卡 asset glyph 圆形容器的渐变终止色。
  final Color assetGradientEnd;

  final String totalNotional;
  final String longNotional;
  final String shortNotional;
  final double longPct;
  final double shortPct;
  final List<ExchangeLongShort> exchanges;
  final DateTime timestamp;
}
