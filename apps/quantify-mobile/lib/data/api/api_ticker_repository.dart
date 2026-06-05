import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';

import '../models/ticker_models.dart';
import '../repositories/ticker_repository.dart';
import '../services/api_client.dart';
import '../services/generated_backend_api.dart';

/// [TickerRepository] 真实现（issue #2250）。
///
/// 通过 generated [MarketsApi] 调用真实 backend `/markets/ticker`。backend 暂无
/// list endpoint，[listTickers] 先按固定 pilot symbols 逐个请求；
/// [watchTicker] 保留 [Stream.periodic] 周期轮询语义，仅把底层 fetch 换为
/// generated SDK。
class ApiTickerRepository implements TickerRepository {
  ApiTickerRepository(this._api);

  final GeneratedBackendApi _api;

  Ticker _map(TickerResponseDto dto) {
    return Ticker.fromBackendFields(
      symbol: dto.symbol,
      currentPrice: dto.currentPrice,
      priceChangePercent24h: dto.priceChangePercent24h,
      volumeUsd: dto.volumeUsd,
    );
  }

  @override
  Future<List<Ticker>> listTickers() async {
    const List<String> symbols = <String>['BTC', 'ETH', 'SOL'];
    final List<Ticker> result = <Ticker>[];
    for (final String symbol in symbols) {
      final Response<TickerResponseDto> response =
          await _api.client.getMarketsApi().marketsControllerGetTicker(
                symbol: symbol,
              );
      final TickerResponseDto? data = response.data;
      if (data != null) result.add(_map(data));
    }
    return result;
  }

  @override
  Stream<Ticker> watchTicker(String symbol) async* {
    Future<Ticker> fetchOne() async {
      final Response<TickerResponseDto> response =
          await _api.client.getMarketsApi().marketsControllerGetTicker(
                symbol: symbol,
              );
      final TickerResponseDto? data = response.data;
      if (data == null) {
        throw const ApiException(message: 'empty ticker response');
      }
      return _map(data);
    }

    yield await fetchOne();
    yield* Stream<void>.periodic(const Duration(seconds: 2))
        .asyncMap((_) => fetchOne());
  }
}
