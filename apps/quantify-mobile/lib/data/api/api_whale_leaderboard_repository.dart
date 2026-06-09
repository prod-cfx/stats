import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:flutter/foundation.dart';

import '../models/whale_profile_models.dart';
import '../../domain/models/whale_leader_models.dart';
import '../repositories/whale_leaderboard_repository.dart';
import '../services/generated_backend_api.dart';

/// [WhaleLeaderboardRepository] 真实现（issue #2189 / discover 契约接入）。
///
/// 走 generated [WhaleTrackingApi] 拉 `/whale-tracking/discover`，对齐 front 的
/// `fetchWhaleTrackingDiscover` 数据流：消费 [WhaleDiscoverResponseDto] 的
/// `recommended/details`，映射到移动端既有 [WhaleLeaderEntry] 展示模型。
class ApiWhaleLeaderboardRepository implements WhaleLeaderboardRepository {
  ApiWhaleLeaderboardRepository(this._api);

  final GeneratedBackendApi _api;

  @visibleForTesting
  static WhaleLeaderEntry mapDiscoverTrader(WhaleDiscoverTraderDto dto) {
    final bool recommended =
        dto.variant == WhaleDiscoverTraderDtoVariantEnum.recommended;
    return WhaleLeaderEntry(
      id: dto.address,
      aumDisplay: _formatUsdCompact(dto.totalValueUsd),
      aumValue: dto.totalValueUsd.toDouble(),
      pnlDisplay: _formatUsdCompact(dto.pnlUsd, signed: true),
      pnlValue: dto.pnlUsd.toDouble(),
      pnlPositive: dto.pnlUsd >= 0,
      trades: dto.trades?.round() ?? 0,
      positions: dto.positions?.round() ?? 0,
      winRate: dto.winRatePct.toDouble(),
      tags:
          dto.aiTags
              ?.map((WhaleDiscoverTraderAiTagDto tag) => _aiTagLabel(tag.key))
              .toList(growable: false) ??
          const <String>[],
      avatarText: recommended ? _avatarText(dto.address) : null,
      avatarBgHex: recommended ? _parseColorHex(dto.avatarColor) : null,
      avatarTextHex: recommended ? 0xFFFFFFFF : null,
      tier: recommended ? dto.tag : null,
    );
  }

  @override
  Future<List<WhaleLeaderEntry>> getLeaderboard() async {
    final Response<Object?> response = await _api.dio.get<Object?>(
      '/whale-tracking/discover',
    );
    final Object? raw = response.data;
    final Object? payload = raw is Map && raw['data'] != null
        ? raw['data']
        : raw;
    final WhaleDiscoverResponseDto? data = payload is WhaleDiscoverResponseDto
        ? payload
        : _api.client.serializers.deserializeWith(
            WhaleDiscoverResponseDto.serializer,
            payload,
          );
    if (data == null) return const <WhaleLeaderEntry>[];

    return <WhaleLeaderEntry>[
      ...data.recommended.map(mapDiscoverTrader),
      ...data.details.map(mapDiscoverTrader),
    ];
  }

  @override
  Future<WhaleTradeStats> getTradeStats(String address) async {
    final Response<Object?> response = await _api.dio.get<Object?>(
      '/whale-tracking/traders/${Uri.encodeComponent(address)}/performance',
    );
    final Object? raw = response.data;
    final Object? payload = raw is Map && raw['data'] != null
        ? raw['data']
        : raw;
    final WhaleAddressPerformanceResponseDto? data =
        payload is WhaleAddressPerformanceResponseDto
        ? payload
        : _api.client.serializers.deserializeWith(
            WhaleAddressPerformanceResponseDto.serializer,
            payload,
          );
    if (data == null) return _emptyTradeStats();
    return mapPerformance(data);
  }

  @visibleForTesting
  static WhaleTradeStats mapPerformance(
    WhaleAddressPerformanceResponseDto dto,
  ) {
    final WhaleTraderSummaryPerformanceDto summary = dto.summary;
    final int trades = summary.trades.round();
    final int longCount = summary.longCount.round();
    final int shortCount = summary.shortCount.round();
    final int directionalTotal = longCount + shortCount;
    final int longPct = directionalTotal == 0
        ? 0
        : ((longCount / directionalTotal) * 100).round();
    final int shortPct = directionalTotal == 0 ? 0 : 100 - longPct;
    final int wins = (trades * (summary.winRatePct.toDouble() / 100)).round();
    final String pnlDisplay = _formatUsdCompact(summary.pnlUsd, signed: true);

    return WhaleTradeStats(
      pnlDisplay: pnlDisplay,
      pnlTone: summary.pnlUsd >= 0 ? 'up' : 'dn',
      winRatePct: summary.winRatePct,
      realizedDisplay: pnlDisplay,
      unrealizedDisplay: '—',
      longPct: longPct,
      shortPct: shortPct,
      assetPerf: dto.byAsset.map(_mapAssetPerformance).toList(growable: false),
      positionPerf: dto.trades
          .map(_mapTradePerformance)
          .toList(growable: false),
      closedPnlDisplay: pnlDisplay,
      feeAdjustedPnlDisplay: _formatUsdCompact(
        summary.pnlUsd.toDouble() * 0.96,
        signed: true,
      ),
      tradesTotal: trades,
      wins: wins,
      losses: trades - wins,
      filledOrders: trades,
      closedCount: dto.trades
          .where(
            (WhaleTradeHistoryItemDto t) =>
                t.positionAction ==
                WhaleTradeHistoryItemDtoPositionActionEnum.n2,
          )
          .length,
    );
  }

  static WhaleAssetPerf _mapAssetPerformance(WhaleAssetPerformanceDto dto) {
    return WhaleAssetPerf(
      symbol: dto.symbol,
      pctDisplay: _assetDirectionPct(dto),
      tone: dto.longCount >= dto.shortCount ? 'up' : 'dn',
      glyph: _glyph(dto.symbol),
      colorHex: _symbolColor(dto.symbol),
      tradeCount: dto.trades.round(),
      positive: dto.longCount >= dto.shortCount,
      pnlDisplay: _formatCompactNumber(dto.totalValueUsd),
      feeDisplay: _formatCompactNumber(dto.totalValueUsd.toDouble() * 0.0025),
    );
  }

  static WhalePositionPerf _mapTradePerformance(WhaleTradeHistoryItemDto dto) {
    final bool isLong = dto.side == WhaleTradeHistoryItemDtoSideEnum.LONG;
    return WhalePositionPerf(
      sym: dto.symbol,
      label: dto.symbol,
      glyph: _glyph(dto.symbol),
      colorHex: _symbolColor(dto.symbol),
      side: isLong ? '做多' : '做空',
      timeDisplay: _timeAgo(dto.createTime),
      positive: isLong,
      pnlDisplay: _formatCompactNumber(dto.positionValueUsd),
      sizeDisplay:
          '${dto.positionSize.toDouble().abs().toStringAsFixed(4)} ${dto.symbol}',
      feeDisplay: _formatCompactNumber(
        dto.positionValueUsd.toDouble() * 0.0025,
      ),
    );
  }

  static WhaleTradeStats _emptyTradeStats() {
    return const WhaleTradeStats(
      pnlDisplay: r'$0.00',
      pnlTone: 'flat',
      winRatePct: 0,
      realizedDisplay: r'$0.00',
      unrealizedDisplay: '—',
      longPct: 0,
      shortPct: 0,
      assetPerf: <WhaleAssetPerf>[],
      positionPerf: <WhalePositionPerf>[],
      tradesTotal: 0,
      wins: 0,
      losses: 0,
    );
  }

  static String _avatarText(String address) {
    final String trimmed = address.startsWith('0x')
        ? address.substring(2)
        : address;
    if (trimmed.isEmpty) return 'WH';
    return trimmed.substring(0, trimmed.length >= 2 ? 2 : 1).toUpperCase();
  }

  static int? _parseColorHex(String value) {
    final String hex = value.trim().replaceFirst('#', '');
    if (hex.length != 6) return null;
    final int? rgb = int.tryParse(hex, radix: 16);
    if (rgb == null) return null;
    return 0xFF000000 | rgb;
  }

  static String _aiTagLabel(WhaleDiscoverTraderAiTagDtoKeyEnum key) {
    if (key == WhaleDiscoverTraderAiTagDtoKeyEnum.bullWarGod) {
      return '多头战神';
    }
    if (key == WhaleDiscoverTraderAiTagDtoKeyEnum.swingKing) {
      return '波段之王';
    }
    if (key == WhaleDiscoverTraderAiTagDtoKeyEnum.smartTrader) {
      return '聪明交易者';
    }
    if (key == WhaleDiscoverTraderAiTagDtoKeyEnum.treasuryKeeper) {
      return '金库管家';
    }
    if (key == WhaleDiscoverTraderAiTagDtoKeyEnum.twitterKol) {
      return '推特 KOL';
    }
    return key.name;
  }

  static String _formatUsdCompact(num value, {bool signed = false}) {
    final double amount = value.toDouble();
    final double abs = amount.abs();
    final String sign = signed && amount >= 0
        ? '+'
        : amount < 0
        ? '-'
        : '';
    final ({double divisor, String suffix}) unit = switch (abs) {
      >= 1000000000 => (divisor: 1000000000, suffix: 'B'),
      >= 1000000 => (divisor: 1000000, suffix: 'M'),
      >= 1000 => (divisor: 1000, suffix: 'K'),
      _ => (divisor: 1, suffix: ''),
    };
    return '$sign\$${(abs / unit.divisor).toStringAsFixed(2)}${unit.suffix}';
  }

  static String _formatCompactNumber(num value) {
    final double amount = value.toDouble().abs();
    final ({double divisor, String suffix}) unit = switch (amount) {
      >= 1000000000 => (divisor: 1000000000, suffix: 'B'),
      >= 1000000 => (divisor: 1000000, suffix: 'M'),
      >= 1000 => (divisor: 1000, suffix: 'K'),
      _ => (divisor: 1, suffix: ''),
    };
    return (amount / unit.divisor).toStringAsFixed(2) + unit.suffix;
  }

  static String _assetDirectionPct(WhaleAssetPerformanceDto dto) {
    final double total = dto.trades.toDouble();
    if (total <= 0) return '0.00%';
    final double dominant = dto.longCount >= dto.shortCount
        ? dto.longCount.toDouble()
        : dto.shortCount.toDouble();
    return '${(dominant / total * 100).toStringAsFixed(2)}%';
  }

  static String _glyph(String symbol) => symbol.isEmpty ? '?' : symbol[0];

  static int _symbolColor(String symbol) {
    return switch (symbol.toUpperCase()) {
      'BTC' => 0xFFF7931A,
      'ETH' => 0xFF627EEA,
      'SOL' => 0xFF14F195,
      'HYPE' => 0xFF50D5C8,
      _ => 0xFF888888,
    };
  }

  static String _timeAgo(String iso) {
    final DateTime? at = DateTime.tryParse(iso);
    if (at == null) return '刚刚';
    final Duration diff = DateTime.now().toUtc().difference(at.toUtc());
    if (diff.isNegative || diff.inMinutes < 1) return '刚刚';
    if (diff.inHours < 1) return '${diff.inMinutes} 分钟前';
    if (diff.inDays < 1) return '${diff.inHours} 小时前';
    return '${diff.inDays} 天前';
  }
}
