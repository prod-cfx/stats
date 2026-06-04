/// 巨鲸「发现」tab 排行榜领域模型（#2190，源自 #1789）。
///
/// domain 层：作为 UI 唯一消费来源。对齐设计稿 `WhaleDiscoverNew`
/// （`WHALE_PROFILES`）：展示串与排序数值并存——展示字段保持已格式化字符串
/// （沿用 mock fixture 约定），额外携带数值字段（[aumValue]/[pnlValue]/
/// [winRate]）供排序条即时重排。
///
/// 排序/top/统计派生纯函数已迁出至 `domain/use_cases/whale_leader_use_cases.dart`。
library;

/// 排行榜单条。top3（带 [avatarText]）渲染为轮播 hero 卡，其余为列表卡。
class WhaleLeaderEntry {
  const WhaleLeaderEntry({
    required this.id,
    required this.aumDisplay,
    required this.aumValue,
    required this.pnlDisplay,
    required this.pnlValue,
    required this.pnlPositive,
    required this.trades,
    required this.positions,
    required this.winRate,
    required this.tags,
    this.avatarText,
    this.avatarBgHex,
    this.avatarTextHex,
    this.tier,
  });

  final String id; // 缩写地址，如 '0x8ba1...ba72'
  final String? avatarText; // 头像徽章文字（仅 top3），null 表示非 top3
  final int? avatarBgHex; // 头像背景色（仅 top3）
  final int? avatarTextHex; // 头像文字色（仅 top3）
  final String? tier; // 如 '$100M+ HYPERUNIT WHALE'
  final String aumDisplay; // 如 '$1.29亿'
  final double aumValue; // 排序用数值
  final String pnlDisplay; // 如 '+$1028万'
  final double pnlValue; // 排序用数值（可负）
  final bool pnlPositive;
  final int trades;
  final int positions;
  final double winRate; // 如 73.81
  final List<String> tags; // AI 标签
}

/// 排序字段。
enum WhaleLeaderSortKey { winRate, aum, pnl }

/// 排序方向。
enum WhaleLeaderSortDir { desc, asc }

/// 排序态值对象。null（调用方持有）表示不排序、保持原序。
class WhaleLeaderSort {
  const WhaleLeaderSort({required this.key, required this.dir});

  final WhaleLeaderSortKey key;
  final WhaleLeaderSortDir dir;

  @override
  bool operator ==(Object other) =>
      other is WhaleLeaderSort && other.key == key && other.dir == dir;

  @override
  int get hashCode => Object.hash(key, dir);
}
