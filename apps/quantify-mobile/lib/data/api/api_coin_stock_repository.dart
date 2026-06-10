import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:flutter/foundation.dart';

import '../models/coin_stock_models.dart';
import '../repositories/coin_stock_repository.dart';
import '../services/generated_backend_api.dart';

typedef CoinStockQuoteLoader =
    Future<List<CryptoStockQuoteResponseDto>> Function(String source);

/// [CoinStockRepository] 真实现（issue #2270，依赖 #2268 契约透明化）。
///
/// 经 generated [CryptoStockQuotesApi] 调真实 backend `/crypto-stock-quotes/latest`。
/// 与 front `/public-companies` 保持同一取数语义：并行读取 `BBX_SCRAPER`
/// 持仓扩展数据与 `BBX` 报价数据，按 symbol 合并；任一数据源失败时保留另一侧，
/// 两侧都失败才把首个错误抛给页面错误态。
/// 契约 DTO 的 price/marketCap/mNav/holdings* 等数值字段均为 `String?`，mobile
/// [CoinStock] 对应字段全为 `String`，映射统一 null→空串 fallback。
class ApiCoinStockRepository implements CoinStockRepository {
  ApiCoinStockRepository(this._api) : _loadQuotesOverride = null;

  @visibleForTesting
  ApiCoinStockRepository.test({required CoinStockQuoteLoader loadQuotes})
    : _api = null,
      _loadQuotesOverride = loadQuotes;

  final GeneratedBackendApi? _api;
  final CoinStockQuoteLoader? _loadQuotesOverride;

  @override
  Future<List<CoinStock>> listCoinStocks() async {
    final List<CryptoStockQuoteResponseDto> data = await _loadMergedQuotes();
    return data.map(mapCoinStock).toList(growable: false);
  }

  Future<List<CryptoStockQuoteResponseDto>> _loadMergedQuotes() async {
    final List<_QuoteLoadResult> results = await Future.wait(
      <Future<_QuoteLoadResult>>[
        _loadQuotes('BBX_SCRAPER'),
        _loadQuotes('BBX'),
      ],
    );
    final _QuoteLoadResult holdingsResult = results[0];
    final _QuoteLoadResult priceResult = results[1];
    if (holdingsResult.error != null && priceResult.error != null) {
      Error.throwWithStackTrace(
        holdingsResult.error!,
        holdingsResult.stackTrace ?? StackTrace.current,
      );
    }

    return mergeQuotesBySymbol(holdingsResult.quotes, priceResult.quotes);
  }

  Future<_QuoteLoadResult> _loadQuotes(String source) async {
    try {
      final CoinStockQuoteLoader? override = _loadQuotesOverride;
      if (override != null) {
        return _QuoteLoadResult(quotes: await override(source));
      }

      final GeneratedBackendApi api = _api!;
      final response = await api.client
          .getCryptoStockQuotesApi()
          .cryptoStockQuotesControllerGetLatest(source_: source);
      return _QuoteLoadResult(
        quotes:
            response.data?.data?.toList() ??
            const <CryptoStockQuoteResponseDto>[],
      );
    } catch (error, stackTrace) {
      return _QuoteLoadResult(error: error, stackTrace: stackTrace);
    }
  }

  @visibleForTesting
  static List<CryptoStockQuoteResponseDto> mergeQuotesBySymbol(
    List<CryptoStockQuoteResponseDto> holdingsQuotes,
    List<CryptoStockQuoteResponseDto> priceQuotes,
  ) {
    if (holdingsQuotes.isEmpty) return priceQuotes;
    if (priceQuotes.isEmpty) return holdingsQuotes;

    final Map<String, CryptoStockQuoteResponseDto> priceBySymbol =
        <String, CryptoStockQuoteResponseDto>{
          for (final CryptoStockQuoteResponseDto quote in priceQuotes)
            quote.symbol: quote,
        };

    return holdingsQuotes
        .map((CryptoStockQuoteResponseDto holdingQuote) {
          final CryptoStockQuoteResponseDto? priceQuote =
              priceBySymbol[holdingQuote.symbol];
          if (priceQuote == null) return holdingQuote;

          return holdingQuote.rebuild((b) {
            b
              ..price = _pickPreferred(priceQuote.price, holdingQuote.price)
              ..openPrice = _pickPreferred(
                priceQuote.openPrice,
                holdingQuote.openPrice,
              )
              ..highPrice = _pickPreferred(
                priceQuote.highPrice,
                holdingQuote.highPrice,
              )
              ..lowPrice = _pickPreferred(
                priceQuote.lowPrice,
                holdingQuote.lowPrice,
              )
              ..closePrice = _pickPreferred(
                priceQuote.closePrice,
                holdingQuote.closePrice,
              )
              ..priceChange = _pickPreferred(
                priceQuote.priceChange,
                holdingQuote.priceChange,
              )
              ..priceChangePercent = _pickPreferred(
                priceQuote.priceChangePercent,
                holdingQuote.priceChangePercent,
              )
              ..quoteTimestamp = priceQuote.quoteTimestamp
              ..updatedAt = priceQuote.updatedAt
              ..source_ = _pickPreferred(
                priceQuote.source_,
                holdingQuote.source_,
              );
          });
        })
        .toList(growable: false);
  }

  /// 契约 DTO → [CoinStock]，null→空串；ch 格式化为带符号百分比，up 据正负派生；
  /// 契约缺失字段（hq/listed）给空串。
  @visibleForTesting
  static CoinStock mapCoinStock(CryptoStockQuoteResponseDto dto) {
    final String asset = _normalizeAsset(dto.assetSymbol);
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

  static String _normalizeAsset(String? raw) {
    final String asset = raw?.trim().toUpperCase() ?? '';
    return asset.isEmpty ? 'OTHER' : asset;
  }

  static String _pickPreferred(String? primary, String? fallback) {
    final String p = primary?.trim() ?? '';
    if (p.isNotEmpty) return primary!;
    return fallback ?? '';
  }
}

class _QuoteLoadResult {
  const _QuoteLoadResult({
    this.quotes = const <CryptoStockQuoteResponseDto>[],
    this.error,
    this.stackTrace,
  });

  final List<CryptoStockQuoteResponseDto> quotes;
  final Object? error;
  final StackTrace? stackTrace;
}
