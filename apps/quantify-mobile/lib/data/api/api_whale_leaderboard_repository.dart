import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:flutter/foundation.dart';

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
    final Response<WhaleDiscoverResponseDto> response = await _api.client
        .getWhaleTrackingApi()
        .whaleTrackingControllerGetDiscover();
    final WhaleDiscoverResponseDto? data = response.data;
    if (data == null) return const <WhaleLeaderEntry>[];

    return <WhaleLeaderEntry>[
      ...data.recommended.map(mapDiscoverTrader),
      ...data.details.map(mapDiscoverTrader),
    ];
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
}
