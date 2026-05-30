import 'package:flutter/material.dart';

/// 预测市场屏数据模型（issue #1855）。
///
/// 纯数据类，仅依赖 painting/widgets（[Color] / [IconData]）。移植设计稿
/// `m-screens-data.jsx` 的 `PRED_MARKETS`(:1493) / `PRED_ICON_SVG`(:1483) /
/// `fmtPredVol`(:1524)。
///
/// 设计稿用 SVG path 串描线 icon；app 无 SVG 解析依赖，按 topic 映射到等价
/// Material 线性图标（KISS），保留「彩色方块 + 线性 icon」的视觉意图。

/// 卡片 icon 类型（按 topic 选 SVG path）。
enum PredIcon { rocket, coin, shield, bank, globe, chip, dollar }

/// 单个预测市场。
class PredMarket {
  const PredMarket({
    required this.id,
    required this.icon,
    required this.color,
    required this.question,
    required this.yesPercent,
    required this.volume,
    required this.live,
    this.resolution,
    this.winStart,
    this.winEnd,
    this.created,
  });

  final String id;
  final PredIcon icon;
  final Color color;
  final String question;

  /// 「是」概率（0-100）。null 表示未开盘 / 无报价，卡片不渲染是/否块。
  final int? yesPercent;

  /// 交易量（美元）。0 视为无量。
  final double volume;

  /// 是否实时开放（LIVE 脉冲点 + 详情 OPEN/CLOSED）。
  final bool live;

  /// 详情字段：解析来源。null 时由 [resolutionSource] 派生。
  final String? resolution;
  final String? winStart;
  final String? winEnd;
  final String? created;

  /// 「否」概率，由 [yesPercent] 推导；null 时返回 null。
  int? get noPercent =>
      yesPercent == null ? null : (100 - yesPercent!).clamp(0, 100);

  /// 解析来源：无显式值时按 question 首个英文词生成 chainlink streams URL，
  /// 与设计稿 `PredMarketDetailSheet` 的派生逻辑一致。
  String get resolutionSource {
    if (resolution != null) return resolution!;
    final RegExpMatch? m = RegExp('[A-Za-z]+').firstMatch(question);
    final String slug = (m?.group(0) ?? 'market').toLowerCase();
    return 'https://data.chain.link/streams/$slug-usd';
  }

  String get eventStart => winStart ?? '2025-12-19 00:49';
  String get eventEnd => winEnd ?? '2025-12-20 00:40';
  String get createdAt => created ?? '2026-03-20 16:03';
}

/// 卡片 icon 背景调色板（设计稿 `PRED_ICON_PALETTE`:1477，按需循环取色）。
const List<Color> kPredIconPalette = <Color>[
  Color(0xFF7C5CFF),
  Color(0xFFF59E0B),
  Color(0xFF3B82F6),
  Color(0xFFA78BFA),
  Color(0xFF22D3EE),
  Color(0xFFEC4899),
  Color(0xFFF97316),
  Color(0xFF10B981),
  Color(0xFF6366F1),
  Color(0xFFE5484D),
];

/// topic → Material 线性图标（设计稿 SVG icon 的等价替代）。
IconData predIconData(PredIcon icon) {
  switch (icon) {
    case PredIcon.rocket:
      return Icons.rocket_launch_outlined;
    case PredIcon.coin:
      return Icons.monetization_on_outlined;
    case PredIcon.shield:
      return Icons.shield_outlined;
    case PredIcon.bank:
      return Icons.account_balance_outlined;
    case PredIcon.globe:
      return Icons.public_outlined;
    case PredIcon.chip:
      return Icons.memory_outlined;
    case PredIcon.dollar:
      return Icons.attach_money_outlined;
  }
}

/// 交易量格式化（设计稿 `fmtPredVol`:1524）：
/// - null / 0 → null（调用方回退 `$0 Vol.`）
/// - >=1000 → `$X.XXK Vol.`（去尾零）
/// - 其余 → `$<int> Vol.`
String? fmtPredVol(double volume) {
  if (volume == 0) return null;
  if (volume >= 1000) {
    final String k = (volume / 1000)
        .toStringAsFixed(2)
        .replaceAll(RegExp(r'\.?0+$'), '');
    return '\$${k}K Vol.';
  }
  return '\$${_trimInt(volume)} Vol.';
}

String _trimInt(double v) =>
    v == v.roundToDouble() ? v.toInt().toString() : v.toString();
