import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:quantify_mobile/data/models/kline_models.dart';
import 'package:quantify_mobile/data/models/ticker_models.dart';
import 'package:quantify_mobile/data/repositories/kline_repository.dart';
import 'package:quantify_mobile/data/repositories/ticker_repository.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/pages/market/market_detail_controller.dart';
import 'package:quantify_mobile/pages/market/market_detail_state.dart';

const Ticker _btc = Ticker(
  symbol: 'BTCUSDT',
  price: 100,
  changePercent: 1,
  volume24h: 10,
);

Candle _candle(int min) => Candle(
      openTime: DateTime(2024, 1, 1, 0, min),
      open: 1,
      high: 2,
      low: 0,
      close: 1,
      volume: 1,
    );

class _FakeTickerRepository implements TickerRepository {
  _FakeTickerRepository(this.tickersFuture);
  final Future<List<Ticker>> tickersFuture;

  @override
  Future<List<Ticker>> listTickers() => tickersFuture;

  @override
  Stream<Ticker> watchTicker(String symbol) => const Stream<Ticker>.empty();
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
  }) =>
      const Stream<Candle>.empty();
}

void main() {
  late _FakeKlineRepository kline;

  ProviderContainer makeContainer(Future<List<Ticker>> tickersFuture) {
    kline = _FakeKlineRepository();
    final ProviderContainer c = ProviderContainer(
      overrides: <Override>[
        tickerRepositoryProvider
            .overrideWithValue(_FakeTickerRepository(tickersFuture)),
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
      final ProviderContainer c =
          makeContainer(Future<List<Ticker>>.value(<Ticker>[_btc]));
      expect(read(c).loading, isTrue);
    });

    test('loading→data：快照填充 + 构建 mock trades + 触发 K 线加载', () async {
      final ProviderContainer c =
          makeContainer(Future<List<Ticker>>.value(<Ticker>[_btc]));
      ctrl(c);
      await Future<void>.delayed(Duration.zero);
      final MarketDetailState s = read(c);
      expect(s.loading, isFalse);
      expect(s.priceSnapshot?.symbol, 'BTCUSDT');
      expect(s.trades, isNotNull);
      // K 线加载已发起。
      expect(kline.pending, hasLength(1));
    });

    test('symbol 未命中：priceSnapshot 为 null、loading=false', () async {
      final ProviderContainer c =
          makeContainer(Future<List<Ticker>>.value(const <Ticker>[]));
      ctrl(c);
      await Future<void>.delayed(Duration.zero);
      final MarketDetailState s = read(c);
      expect(s.loading, isFalse);
      expect(s.priceSnapshot, isNull);
    });

    test('loading→error：listTickers 抛错经 ErrorRouter.normalize', () async {
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

    test('K 线竞态：旧 interval 的 listCandles 响应不覆盖新 interval candles',
        () async {
      final ProviderContainer c =
          makeContainer(Future<List<Ticker>>.value(<Ticker>[_btc]));
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

    test('changeSource/changePanel 仅改展示态，不触发 K 线重载', () async {
      final ProviderContainer c =
          makeContainer(Future<List<Ticker>>.value(<Ticker>[_btc]));
      final MarketDetailController controller = ctrl(c);
      await Future<void>.delayed(Duration.zero);
      final int klineCallsBefore = kline.calledIntervals.length;
      controller.changePanel(DetailPanel.trades);
      expect(read(c).panel, DetailPanel.trades);
      expect(kline.calledIntervals.length, klineCallsBefore);
    });
  });
}
