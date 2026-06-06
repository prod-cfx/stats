import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:flutter/foundation.dart';

import '../models/coin_stock_models.dart';
import '../repositories/coin_stock_repository.dart';
import '../services/generated_backend_api.dart';

/// [CoinStockRepository] 真实现（issue #2270，依赖 #2268 契约透明化）。
///
/// 经 generated [CryptoStockQuotesApi] 调真实 backend `/crypto-stock-quotes/latest`。
/// 契约 DTO 的 price/marketCap/mNav/holdings* 等数值字段均为 `String?`，mobile
/// [CoinStock] 对应字段全为 `String`，映射统一 null→空串 fallback。
class ApiCoinStockRepository implements CoinStockRepository {
  ApiCoinStockRepository(this._api);

  final GeneratedBackendApi _api;

  @override
  Future<List<CoinStock>> listCoinStocks() async {
    final response = await _api.client
        .getCryptoStockQuotesApi()
        .cryptoStockQuotesControllerGetLatest();
    final List<CryptoStockQuoteResponseDto> data =
        response.data?.data?.toList() ??
            const <CryptoStockQuoteResponseDto>[];
    return data.map(mapCoinStock).toList(growable: false);
  }

  /// 契约 DTO → [CoinStock]，null→空串；ch 格式化为带符号百分比，up 据正负派生；
  /// 契约缺失字段（hq/listed）给空串。
  @visibleForTesting
  static CoinStock mapCoinStock(CryptoStockQuoteResponseDto dto) {
    final String asset = dto.assetSymbol ?? '';
    final double? changePct = double.tryParse(dto.priceChangePercent ?? '');
    return CoinStock(
      coin: asset,
      sym: dto.symbol,
      cn: dto.name ?? '',
      ex: dto.exchange ?? '',
      mnav: dto.mNav ?? '',
      mcap: dto.marketCap ?? '',
      holdV: dto.holdingsValue ?? dto.holdingValue ?? '',
      holdQ: dto.holdingsAmount ?? dto.holdingQuantity ?? '',
      hold: asset,
      px: dto.price,
      ch: _fmtChange(changePct),
      up: (changePct ?? 0) >= 0,
      biz: dto.companyType ?? '',
      hq: '',
      listed: '',
      intro: dto.infoParagraphs?.join('\n') ?? '',
    );
  }

  static String _fmtChange(double? pct) {
    if (pct == null) return '';
    final String sign = pct >= 0 ? '+' : '';
    return '$sign${pct.toStringAsFixed(2)}%';
  }
}
