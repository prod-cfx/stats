import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:quantify_mobile/data/models/kline_models.dart';
import 'package:quantify_mobile/data/models/ticker_models.dart';
import 'package:quantify_mobile/data/models/trade_models.dart';
import 'package:quantify_mobile/data/repositories/kline_repository.dart';
import 'package:quantify_mobile/data/repositories/ticker_repository.dart';
import 'package:quantify_mobile/data/repositories/trades_repository.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/pages/market/market_detail_controller.dart';
import 'package:quantify_mobile/pages/market/market_detail_state.dart';

const Ticker _btc = Ticker(
  symbol: 'BTCUSDT',
  price: 100,
  changePercent: 1,
  volume24h: 10,
);

Candle _candle(int min, {double close = 1}) => Candle(
  openTime: DateTime(2024, 1, 1, 0, min),
  open: 1,
  high: close + 1,
  low: 0,
  close: close,
  volume: 1,
);

class _FakeTickerRepository implements TickerRepository {
  _FakeTickerRepository(this.tickersFuture, {Stream<Ticker>? stream})
    : stream = stream ?? const Stream<Ticker>.empty();
  final Future<List<Ticker>> tickersFuture;
  final Stream<Ticker> stream;

  @override
  Future<List<Ticker>> listTickers() => tickersFuture;

  @override
  Future<Ticker?> getTicker({
    required String symbol,
    MarketKind kind = MarketKind.perp,
    String? exchange,
  }) async {
    final List<Ticker> tickers = await tickersFuture;
    for (final Ticker ticker in tickers) {
      if (_sameMarketSymbol(ticker.symbol, symbol)) return ticker;
    }
    return null;
  }

  @override
  Stream<Ticker> watchTicker(
    String symbol, {
    MarketKind kind = MarketKind.perp,
    String? exchange,
  }) => stream;

  bool _sameMarketSymbol(String left, String right) {
    return _canonicalSymbol(left) == _canonicalSymbol(right);
  }

  String _canonicalSymbol(String value) {
    final String normalized = value.trim().toUpperCase().replaceAll(
      RegExp(r'[/_\-\s]'),
      '',
    );
    for (final String quote in <String>['USDT', 'USDC', 'USD']) {
      if (normalized.endsWith(quote) && normalized.length > quote.length) {
        return normalized.substring(0, normalized.length - quote.length);
      }
    }
    return normalized;
  }
}

class _FakeTradesRepository implements TradesRepository {
  const _FakeTradesRepository(this.trades);

  final List<Trade> trades;

  @override
  Future<List<Trade>> listTrades({
    required String symbol,
    required double mid,
  }) async => trades;
}

/// 可控时序假 K 线仓库：listCandles 用 Completer 队列驱动竞态。
class _FakeKlineRepository implements KlineRepository {
  final List<Completer<List<Candle>>> pending = <Completer<List<Candle>>>[];
  final List<KlineInterval> calledIntervals = <KlineInterval>[];

  @override
  Future<List<Candle>> listCandles({
    required String symbol,
    required KlineInterval interval,
    required int limit,
  }) {
    calledIntervals.add(interval);
    final Completer<List<Candle>> c = Completer<List<Candle>>();
    pending.add(c);
    return c.future;
  }

  @override
  Stream<Candle> watchCandles({
    required String symbol,
    required KlineInterval interval,
  }) => const Stream<Candle>.empty();
}

void main() {
  late _FakeKlineRepository kline;

  ProviderContainer makeContainer(
    Future<List<Ticker>> tickersFuture, {
    Stream<Ticker>? tickerStream,
    List<Trade> trades = const <Trade>[],
  }) {
    kline = _FakeKlineRepository();
    final ProviderContainer c = ProviderContainer(
      overrides: <Override>[
        tickerRepositoryProvider.overrideWithValue(
          _FakeTickerRepository(tickersFuture, stream: tickerStream),
        ),
        tradesRepositoryProvider.overrideWithValue(
          _FakeTradesRepository(trades),
        ),
        klineRepositoryProvider.overrideWithValue(kline),
      ],
    );
    // 保持 autoDispose family provider 存活（无监听者会被销毁，吞掉异步回调）。
    c.listen(marketDetailControllerProvider('BTCUSDT'), (_, _) {});
    addTearDown(c.dispose);
    return c;
  }

  MarketDetailController ctrl(ProviderContainer c) =>
      c.read(marketDetailControllerProvider('BTCUSDT').notifier);
  MarketDetailState read(ProviderContainer c) =>
      c.read(marketDetailControllerProvider('BTCUSDT'));

  group('MarketDetailController 异步加载', () {
    test('初始态 loading=true', () {
      final ProviderContainer c = makeContainer(
        Future<List<Ticker>>.value(<Ticker>[_btc]),
      );
      expect(read(c).loading, isTrue);
    });

    test('loading→data：快照填充 + 构建 mock trades + 触发 K 线加载', () async {
      final ProviderContainer c = makeContainer(
        Future<List<Ticker>>.value(<Ticker>[_btc]),
      );
      ctrl(c);
      await Future<void>.delayed(Duration.zero);
      final MarketDetailState s = read(c);
      expect(s.loading, isFalse);
      expect(s.priceSnapshot?.symbol, 'BTCUSDT');
      expect(s.trades, isNotNull);
      // K 线加载已发起。
      expect(kline.pending, hasLength(1));
    });

    test('route base symbol matches slash ticker symbol', () async {
      final ProviderContainer c = makeContainer(
        Future<List<Ticker>>.value(const <Ticker>[
          Ticker(
            symbol: 'BTC/USDT',
            price: 100,
            changePercent: 1,
            volume24h: 10,
          ),
        ]),
      );
      ctrl(c);
      await Future<void>.delayed(Duration.zero);
      final MarketDetailState s = read(c);
      expect(s.loading, isFalse);
      expect(s.priceSnapshot?.symbol, 'BTC/USDT');
    });

    test('symbol 未命中：priceSnapshot 为 null、loading=false', () async {
      final ProviderContainer c = makeContainer(
        Future<List<Ticker>>.value(const <Ticker>[]),
      );
      ctrl(c);
      await Future<void>.delayed(Duration.zero);
      final MarketDetailState s = read(c);
      expect(s.loading, isFalse);
      expect(s.priceSnapshot, isNull);
    });

    test('loading→error：getTicker 抛错经 ErrorRouter.normalize', () async {
      final Completer<List<Ticker>> completer = Completer<List<Ticker>>();
      final ProviderContainer c = makeContainer(completer.future);
      ctrl(c);
      await Future<void>.delayed(Duration.zero);
      completer.completeError(Exception('boom'));
      await Future<void>.delayed(Duration.zero);
      final MarketDetailState s = read(c);
      expect(s.loading, isFalse);
      expect(s.error, isNotNull);
    });

    test('K 线竞态：旧 interval 的 listCandles 响应不覆盖新 interval candles', () async {
      final ProviderContainer c = makeContainer(
        Future<List<Ticker>>.value(<Ticker>[_btc]),
      );
      final MarketDetailController controller = ctrl(c);
      await Future<void>.delayed(Duration.zero);
      // 初次 K 线加载（h1）pending[0]。
      expect(kline.pending, hasLength(1));
      // 切周期触发第二次加载 pending[1]。
      controller.changeInterval(KlineInterval.h4);
      await Future<void>.delayed(Duration.zero);
      expect(kline.pending, hasLength(2));
      // 新请求（h4）先返回 2 根。
      kline.pending[1].complete(<Candle>[_candle(0), _candle(1)]);
      await Future<void>.delayed(Duration.zero);
      expect(read(c).candles, hasLength(2));
      // 旧请求（h1）后返回 5 根——必须被丢弃，candles 仍为 h4 的 2 根。
      kline.pending[0].complete(<Candle>[
        _candle(0),
        _candle(1),
        _candle(2),
        _candle(3),
        _candle(4),
      ]);
      await Future<void>.delayed(Duration.zero);
      expect(read(c).candles, hasLength(2));
    });

    test('K 线最新 close 更新详情主价格', () async {
      final ProviderContainer c = makeContainer(
        Future<List<Ticker>>.value(<Ticker>[_btc]),
      );
      ctrl(c);
      await Future<void>.delayed(Duration.zero);
      expect(read(c).priceSnapshot?.price, 100);
      expect(kline.pending, hasLength(1));

      kline.pending[0].complete(<Candle>[_candle(0, close: 123.45)]);
      await Future<void>.delayed(Duration.zero);

      expect(read(c).priceSnapshot?.price, 123.45);
    });

    test('成交买卖额补齐累计净流入', () async {
      final DateTime now = DateTime(2026, 1, 1, 12);
      final ProviderContainer c = makeContainer(
        Future<List<Ticker>>.value(<Ticker>[_btc]),
        trades: <Trade>[
          Trade(time: now, price: 100, qty: 2, isBuy: true),
          Trade(time: now, price: 90, qty: 1, isBuy: false),
        ],
      );
      ctrl(c);
      await Future<void>.delayed(Duration.zero);

      expect(read(c).priceSnapshot?.netInflow24h, 110);
    });

    test('ticker 推流改价时保留已补齐累计净流入', () async {
      final StreamController<Ticker> tickerStream = StreamController<Ticker>();
      final DateTime now = DateTime(2026, 1, 1, 12);
      final ProviderContainer c = makeContainer(
        Future<List<Ticker>>.value(<Ticker>[_btc]),
        tickerStream: tickerStream.stream,
        trades: <Trade>[Trade(time: now, price: 100, qty: 2, isBuy: true)],
      );
      ctrl(c);
      await Future<void>.delayed(Duration.zero);
      expect(read(c).priceSnapshot?.netInflow24h, 200);

      tickerStream.add(
        const Ticker(
          symbol: 'BTCUSDT',
          price: 101,
          changePercent: 2,
          volume24h: 20,
        ),
      );
      await Future<void>.delayed(Duration.zero);

      expect(read(c).priceSnapshot?.price, 101);
      expect(read(c).priceSnapshot?.netInflow24h, 200);
    });

    test('changeSource/changePanel 仅改展示态，不触发 K 线重载', () async {
      final ProviderContainer c = makeContainer(
        Future<List<Ticker>>.value(<Ticker>[_btc]),
      );
      final MarketDetailController controller = ctrl(c);
      await Future<void>.delayed(Duration.zero);
      final int klineCallsBefore = kline.calledIntervals.length;
      controller.changePanel(DetailPanel.trades);
      expect(read(c).panel, DetailPanel.trades);
      expect(kline.calledIntervals.length, klineCallsBefore);
    });
  });
}
