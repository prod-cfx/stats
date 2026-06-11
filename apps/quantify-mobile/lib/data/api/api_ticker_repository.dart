import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';

import '../models/ticker_models.dart';
import '../repositories/ticker_repository.dart';
import '../services/api_client.dart';
import '../services/generated_backend_api.dart';
import '../services/market_symbol.dart';

/// [TickerRepository] 真实现（issue #2250）。
///
/// 通过 generated [MarketsApi] 调用真实 backend markets 契约。[listTickers]
/// 先用 `/markets/pairs` 获取启用交易对，再逐个请求 `/markets/ticker`；
/// pairs 不可用时保留小范围 fallback，避免行情页整体不可用。[watchTicker]
/// 保留 [Stream.periodic] 周期轮询语义。
class ApiTickerRepository implements TickerRepository {
  ApiTickerRepository(this._api);

  static const List<String> _fallbackSymbols = <String>[
    'BTC',
    'ETH',
    'SOL',
    'BNB',
    'XRP',
    'DOGE',
    'ADA',
    'AVAX',
    'LINK',
    'SUI',
    'TRX',
    'DOT',
    'BCH',
    'LTC',
    'UNI',
    'AAVE',
    'ATOM',
    'NEAR',
    'OP',
    'PEPE',
    'SHIB',
    'WLD',
    'XLM',
    'FIL',
    'ETC',
  ];
  static const int _maxCandidatesPerKind = 24;
  static const int _tickerFetchConcurrency = 8;
  static const Duration _freshKlineTolerance = Duration(minutes: 15);

  static const Map<String, int> _symbolPriority = <String, int>{
    'BTC': 0,
    'ETH': 1,
    'SOL': 2,
    'BNB': 3,
    'XRP': 4,
    'DOGE': 5,
    'ADA': 6,
    'AVAX': 7,
    'LINK': 8,
    'SUI': 9,
  };

  static const Map<String, int> _exchangePriority = <String, int>{
    'BINANCE': 0,
    'OKX': 1,
    'BYBIT': 2,
  };

  static const Map<String, String> _tickerExchangeNames = <String, String>{
    'BINANCE': 'Binance',
    'OKX': 'OKX',
    'BYBIT': 'Bybit',
  };

  final GeneratedBackendApi _api;

  Future<Ticker?> _fetchTicker({
    required String symbol,
    required MarketKind kind,
    String? exchange,
  }) async {
    final Map<String, dynamic> query = <String, dynamic>{'symbol': symbol};
    if (exchange != null) query['exchange'] = exchange;
    final Response<dynamic> response = await _api.dio.get<dynamic>(
      '/markets/ticker',
      queryParameters: query,
    );
    final Map<String, dynamic>? data = _unwrapTickerData(response.data);
    return _tickerFromMap(data, requestedSymbol: symbol, kind: kind);
  }

  Future<Ticker?> _tickerFromMap(
    Map<String, dynamic>? data, {
    required String requestedSymbol,
    required MarketKind kind,
  }) async {
    if (data == null) return null;
    final String responseSymbol =
        (data['symbol'] as String?) ?? requestedSymbol;
    final double? latestClose = await _fetchLatestKlineClose(responseSymbol);
    return Ticker.fromBackendFields(
      symbol: responseSymbol,
      currentPrice:
          latestClose?.toString() ?? data['currentPrice']?.toString() ?? '0',
      priceChangePercent24h: data['priceChangePercent24h']?.toString(),
      volumeUsd: data['volumeUsd']?.toString() ?? '0',
      kind: kind,
      high24h: data['high24h']?.toString(),
      low24h: data['low24h']?.toString(),
      openInterestUsd: data['openInterestUsd']?.toString(),
      indexPrice: data['indexPrice']?.toString(),
      fundingRate: data['fundingRate']?.toString(),
    );
  }

  Future<double?> _fetchLatestKlineClose(String symbol) async {
    final int now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final _KlineClose? oneMinute = await _fetchLatestKlineCloseForInterval(
      symbol: symbol,
      interval: '1m',
      from: now - const Duration(hours: 6).inSeconds,
      to: now,
    );
    if (_isFresh(oneMinute, now)) return oneMinute!.close;

    final _KlineClose? fiveMinute = await _fetchLatestKlineCloseForInterval(
      symbol: symbol,
      interval: '5m',
      from: now - const Duration(hours: 6).inSeconds,
      to: now,
    );
    final _KlineClose? latest = _newerKlineClose(oneMinute, fiveMinute);
    return latest?.close;
  }

  Future<_KlineClose?> _fetchLatestKlineCloseForInterval({
    required String symbol,
    required String interval,
    required int from,
    required int to,
  }) async {
    try {
      final Response<dynamic> response = await _api.dio.get<dynamic>(
        '/kline',
        queryParameters: <String, dynamic>{
          'symbol': normalizeKlineSymbol(symbol),
          'interval': interval,
          'from': from,
          'to': to,
        },
      );
      final Object? raw = response.data;
      final Object? list = raw is Map ? raw['data'] : raw;
      if (list is! List || list.isEmpty) return null;
      final Object? last = list.last;
      if (last is! Map) return null;
      final double? close = _parseDouble(last['close']);
      final int? time = _parseKlineTimeSeconds(
        last['time'] ?? last['openTime'],
      );
      if (close == null || time == null) return null;
      return _KlineClose(close: close, timeSeconds: time);
    } catch (_) {
      return null;
    }
  }

  static bool _isFresh(_KlineClose? close, int nowSeconds) {
    if (close == null) return false;
    return nowSeconds - close.timeSeconds <= _freshKlineTolerance.inSeconds;
  }

  static _KlineClose? _newerKlineClose(_KlineClose? a, _KlineClose? b) {
    if (a == null) return b;
    if (b == null) return a;
    return b.timeSeconds >= a.timeSeconds ? b : a;
  }

  static double? _parseDouble(Object? value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  static int? _parseKlineTimeSeconds(Object? value) {
    final double? parsed = _parseDouble(value);
    if (parsed == null) return null;
    final int millisOrSeconds = parsed.toInt();
    if (millisOrSeconds > 9999999999) return millisOrSeconds ~/ 1000;
    return millisOrSeconds;
  }

  static Map<String, dynamic>? _unwrapTickerData(Object? body) {
    if (body is! Map) return null;
    if (body.containsKey('data')) {
      final Object? nested = body['data'];
      if (nested == null) return null;
      if (nested is! Map) return null;
      return Map<String, dynamic>.from(nested);
    }
    return Map<String, dynamic>.from(body);
  }

  Future<List<_TickerCandidate>> _loadCandidatesFromPairs() async {
    final response = await _api.client
        .getMarketsApi()
        .marketsControllerGetTradingPairs(venueType: 'CEX');
    final List<TradingPairConfigResponseDto> pairs =
        response.data?.toList() ?? const <TradingPairConfigResponseDto>[];
    if (pairs.isEmpty) return const <_TickerCandidate>[];

    pairs.sort(_comparePairs);
    final Map<String, _TickerCandidate> spot = <String, _TickerCandidate>{};
    final Map<String, _TickerCandidate> perp = <String, _TickerCandidate>{};
    for (final TradingPairConfigResponseDto pair in pairs) {
      if (!pair.enabled || pair.quoteAsset.toUpperCase() != 'USDT') continue;
      final String base = pair.baseAsset.trim().toUpperCase();
      if (base.isEmpty) continue;

      if (pair.instrumentType ==
          TradingPairConfigResponseDtoInstrumentTypeEnum.SPOT) {
        spot.putIfAbsent(
          base,
          () => _TickerCandidate(symbol: base, kind: MarketKind.spot),
        );
        continue;
      }

      if (pair.instrumentType ==
          TradingPairConfigResponseDtoInstrumentTypeEnum.PERPETUAL) {
        final String? exchange = _tickerExchangeName(pair.exchange?.name);
        perp.putIfAbsent(
          base,
          () => _TickerCandidate(
            symbol: base,
            kind: MarketKind.perp,
            exchange: exchange,
          ),
        );
      }
    }

    return <_TickerCandidate>[
      ...spot.values.take(_maxCandidatesPerKind),
      ...perp.values.take(_maxCandidatesPerKind),
    ];
  }

  List<_TickerCandidate> _fallbackCandidates() {
    return <_TickerCandidate>[
      for (final String symbol in _fallbackSymbols)
        _TickerCandidate(symbol: symbol, kind: MarketKind.spot),
      for (final String symbol in _fallbackSymbols)
        _TickerCandidate(
          symbol: symbol,
          kind: MarketKind.perp,
          exchange: _tickerExchangeNames['BINANCE'],
        ),
    ];
  }

  static int _comparePairs(
    TradingPairConfigResponseDto a,
    TradingPairConfigResponseDto b,
  ) {
    final int bySymbol = _priorityOf(
      a.baseAsset,
    ).compareTo(_priorityOf(b.baseAsset));
    if (bySymbol != 0) return bySymbol;
    final int byBase = a.baseAsset.compareTo(b.baseAsset);
    if (byBase != 0) return byBase;
    final int byKind = a.instrumentType.name.compareTo(b.instrumentType.name);
    if (byKind != 0) return byKind;
    return _exchangeRank(
      a.exchange?.name,
    ).compareTo(_exchangeRank(b.exchange?.name));
  }

  static int _priorityOf(String symbol) {
    return _symbolPriority[symbol.toUpperCase()] ?? 1000;
  }

  static int _exchangeRank(String? exchange) {
    if (exchange == null) return 999;
    return _exchangePriority[exchange.toUpperCase()] ?? 999;
  }

  static String? _tickerExchangeName(String? exchange) {
    if (exchange == null) return null;
    return _tickerExchangeNames[exchange.toUpperCase()] ?? exchange;
  }

  @override
  Future<List<Ticker>> listTickers() async {
    List<_TickerCandidate> candidates;
    try {
      candidates = await _loadCandidatesFromPairs();
    } catch (_) {
      candidates = const <_TickerCandidate>[];
    }
    if (candidates.isEmpty) candidates = _fallbackCandidates();

    final List<Ticker> result = <Ticker>[];
    for (int i = 0; i < candidates.length; i += _tickerFetchConcurrency) {
      final List<_TickerCandidate> batch = candidates
          .skip(i)
          .take(_tickerFetchConcurrency)
          .toList(growable: false);
      final List<Ticker?> tickers = await Future.wait<Ticker?>(
        batch.map(_fetchTickerSafely),
      );
      result.addAll(tickers.whereType<Ticker>());
    }
    return result;
  }

  Future<Ticker?> _fetchTickerSafely(_TickerCandidate candidate) async {
    try {
      return await _fetchTicker(
        symbol: candidate.symbol,
        kind: candidate.kind,
        exchange: candidate.exchange,
      );
    } catch (_) {
      return null;
    }
  }

  @override
  Future<Ticker?> getTicker({
    required String symbol,
    MarketKind kind = MarketKind.perp,
    String? exchange,
  }) {
    return _fetchTicker(symbol: symbol, kind: kind, exchange: exchange);
  }

  @override
  Stream<Ticker> watchTicker(
    String symbol, {
    MarketKind kind = MarketKind.perp,
    String? exchange,
  }) async* {
    Future<Ticker> fetchOne() async {
      final Map<String, dynamic> query = <String, dynamic>{'symbol': symbol};
      if (exchange != null) query['exchange'] = exchange;
      final Response<dynamic> response = await _api.dio.get<dynamic>(
        '/markets/ticker',
        queryParameters: query,
      );
      final Map<String, dynamic>? data = _unwrapTickerData(response.data);
      if (data == null) {
        throw const ApiException(message: 'empty ticker response');
      }
      return (await _tickerFromMap(data, requestedSymbol: symbol, kind: kind))!;
    }

    Future<Ticker?> fetchOneSafely() async {
      try {
        return await fetchOne();
      } catch (_) {
        return null;
      }
    }

    final Ticker? first = await fetchOneSafely();
    if (first != null) yield first;
    yield* Stream<void>.periodic(const Duration(seconds: 2))
        .asyncMap((_) => fetchOneSafely())
        .where((Ticker? t) => t != null)
        .cast<Ticker>();
  }
}

class _KlineClose {
  const _KlineClose({required this.close, required this.timeSeconds});

  final double close;
  final int timeSeconds;
}

class _TickerCandidate {
  const _TickerCandidate({
    required this.symbol,
    required this.kind,
    this.exchange,
  });

  final String symbol;
  final MarketKind kind;
  final String? exchange;
}
