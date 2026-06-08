import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';

import '../models/ticker_models.dart';
import '../repositories/ticker_repository.dart';
import '../services/api_client.dart';
import '../services/generated_backend_api.dart';

/// [TickerRepository] 真实现（issue #2250）。
///
/// 通过 generated [MarketsApi] 调用真实 backend `/markets/ticker`。backend 暂无
/// list endpoint，[listTickers] 先按固定 pilot symbols 逐个请求 spot/perp；
/// [watchTicker] 保留 [Stream.periodic] 周期轮询语义，仅把底层 fetch 换为
/// generated SDK。
class ApiTickerRepository implements TickerRepository {
  ApiTickerRepository(this._api);

  static const List<String> _pilotSymbols = <String>['BTC', 'ETH', 'SOL'];
  static const String _perpExchange = 'Binance';

  final GeneratedBackendApi _api;

  Ticker _map(TickerResponseDto dto, {MarketKind kind = MarketKind.spot}) {
    return Ticker.fromBackendFields(
      symbol: dto.symbol,
      currentPrice: dto.currentPrice,
      priceChangePercent24h: dto.priceChangePercent24h,
      volumeUsd: dto.volumeUsd,
      kind: kind,
      high24h: dto.high24h,
      low24h: dto.low24h,
      openInterestUsd: dto.openInterestUsd,
      indexPrice: dto.indexPrice,
      fundingRate: dto.fundingRate,
    );
  }

  Future<Ticker?> _fetchTicker({
    required String symbol,
    required MarketKind kind,
    String? exchange,
  }) async {
    final Response<TickerResponseDto> response = await _api.client
        .getMarketsApi()
        .marketsControllerGetTicker(symbol: symbol, exchange: exchange);
    final TickerResponseDto? data = response.data;
    if (data == null) return null;
    return _map(data, kind: kind);
  }

  @override
  Future<List<Ticker>> listTickers() async {
    final List<Ticker> result = <Ticker>[];
    for (final String symbol in _pilotSymbols) {
      final Ticker? spot = await _fetchTicker(
        symbol: symbol,
        kind: MarketKind.spot,
      );
      if (spot != null) result.add(spot);

      final Ticker? perp = await _fetchTicker(
        symbol: symbol,
        kind: MarketKind.perp,
        exchange: _perpExchange,
      );
      if (perp != null) result.add(perp);
    }
    return result;
  }

  @override
  Stream<Ticker> watchTicker(String symbol) async* {
    Future<Ticker> fetchOne() async {
      final Response<TickerResponseDto> response = await _api.client
          .getMarketsApi()
          .marketsControllerGetTicker(symbol: symbol);
      final TickerResponseDto? data = response.data;
      if (data == null) {
        throw const ApiException(message: 'empty ticker response');
      }
      final MarketKind kind =
          data.openInterestUsd != null ||
              data.fundingRate != null ||
              data.indexPrice != null
          ? MarketKind.perp
          : MarketKind.spot;
      return _map(data, kind: kind);
    }

    yield await fetchOne();
    yield* Stream<void>.periodic(
      const Duration(seconds: 2),
    ).asyncMap((_) => fetchOne());
  }
}
