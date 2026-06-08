import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/serializer.dart';
import 'package:flutter/foundation.dart';

import '../models/pred_market_models.dart';
import '../repositories/pred_market_repository.dart';
import '../services/generated_backend_api.dart';

/// [PredMarketRepository] 真实现（issue #2270）。
///
/// 经 generated SDK 共享的 [Dio] 调真实 backend `/polymarket/markets`，再用
/// contract serializers 把响应 `data` 解成 [PredictionMarketCardDto]。
/// icon/color 契约不提供，沿用 mock 的 `kPredIconPalette` 按 index 派生。
class ApiPredMarketRepository implements PredMarketRepository {
  ApiPredMarketRepository(this._api);

  final GeneratedBackendApi _api;

  @override
  Future<List<PredMarket>> listPredMarkets({
    int limit = 48,
    bool onlyActive = true,
    String? locale,
  }) async {
    final response = await _api.dio.get<Object>(
      '/polymarket/markets',
      queryParameters: <String, Object?>{
        'page': 1,
        'limit': limit,
        'onlyActive': onlyActive,
        if (locale != null && locale.isNotEmpty) 'locale': locale,
      },
    );
    final List<PredictionMarketCardDto> data = _decodeMarkets(
      response.data,
    ).toList(growable: false);
    final List<PredMarket> result = <PredMarket>[];
    for (int i = 0; i < data.length; i++) {
      result.add(mapPredMarket(data[i], i));
    }
    return result;
  }

  /// 把契约 DTO 映射为 [PredMarket]。`index` 用于派生 icon/调色板。
  @visibleForTesting
  static PredMarket mapPredMarket(PredictionMarketCardDto dto, int index) {
    final int paletteLen = kPredIconPalette.length;
    final int iconLen = PredIcon.values.length;
    return PredMarket(
      id: dto.id,
      icon: PredIcon.values[index % iconLen],
      color: kPredIconPalette[index % paletteLen],
      question: dto.title,
      yesPercent: _yesPercent(dto),
      volume: double.tryParse(dto.volume24h ?? '') ?? 0,
      live: _isLiveStatus(dto.status),
      rules: dto.rules?.paragraphs.toList(growable: false) ?? const <String>[],
      created: dto.rules?.createdAt,
    );
  }

  static BuiltList<PredictionMarketCardDto> _decodeMarkets(Object? raw) {
    final Object? payload = raw is Map ? raw['data'] : raw;
    if (payload == null) return BuiltList<PredictionMarketCardDto>();
    return standardSerializers.deserialize(
          payload,
          specifiedType: const FullType(BuiltList, <FullType>[
            FullType(PredictionMarketCardDto),
          ]),
        )!
        as BuiltList<PredictionMarketCardDto>;
  }

  static bool _isLiveStatus(String? raw) {
    final String status = raw?.trim().toUpperCase() ?? '';
    return status == 'OPEN' || status == 'LIVE' || status == 'ACTIVE';
  }

  /// 解析「是」概率（0-100 int）：优先 options 中标签含 yes/是 的项，回退
  /// 顶层 probability；都缺省返回 null。比例值（≤1）归一为百分比。
  static int? _yesPercent(PredictionMarketCardDto dto) {
    String? raw;
    final options = dto.options;
    if (options != null) {
      for (final PredictionMarketOutcomeDto o in options) {
        final String label = o.label.toLowerCase();
        if (label.contains('yes') || label.contains('是')) {
          raw = o.probability;
          break;
        }
      }
    }
    raw ??= dto.probability;
    final double? parsed = double.tryParse(raw ?? '');
    if (parsed == null) return null;
    final double pct = parsed <= 1 ? parsed * 100 : parsed;
    return pct.round().clamp(0, 100);
  }
}
