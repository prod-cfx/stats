import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:quantify_mobile/data/models/ticker_models.dart';
import 'package:quantify_mobile/data/repositories/ticker_repository.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/pages/market/market_home_controller.dart';
import 'package:quantify_mobile/pages/market/market_home_state.dart';

const Ticker _btc = Ticker(
  symbol: 'BTCUSDT',
  price: 100,
  changePercent: 1,
  volume24h: 10,
);

class _FakeTickerRepository implements TickerRepository {
  _FakeTickerRepository(this._completer);
  final Completer<List<Ticker>> _completer;

  @override
  Future<List<Ticker>> listTickers() => _completer.future;

  @override
  Stream<Ticker> watchTicker(String symbol) => const Stream<Ticker>.empty();
}

void main() {
  late Completer<List<Ticker>> completer;

  ProviderContainer makeContainer() {
    completer = Completer<List<Ticker>>();
    final ProviderContainer c = ProviderContainer(
      overrides: <Override>[
        tickerRepositoryProvider
            .overrideWithValue(_FakeTickerRepository(completer)),
      ],
    );
    // 保持 autoDispose provider 存活（无监听者会被销毁，吞掉异步回调）。
    c.listen(marketHomeControllerProvider, (_, _) {});
    addTearDown(c.dispose);
    return c;
  }

  MarketHomeController ctrl(ProviderContainer c) =>
      c.read(marketHomeControllerProvider.notifier);
  MarketHomeState read(ProviderContainer c) =>
      c.read(marketHomeControllerProvider);

  group('MarketHomeController', () {
    test('初始态 loading=true，默认 tab=watchlist', () {
      final ProviderContainer c = makeContainer();
      final MarketHomeState s = read(c);
      expect(s.loading, isTrue);
      expect(s.tab, MarketTab.watchlist);
      expect(s.tickers, isEmpty);
    });

    test('loading→data：tickers 填充、loading=false', () async {
      final ProviderContainer c = makeContainer();
      ctrl(c);
      await Future<void>.delayed(Duration.zero);
      completer.complete(<Ticker>[_btc]);
      await Future<void>.delayed(Duration.zero);
      final MarketHomeState s = read(c);
      expect(s.loading, isFalse);
      expect(s.tickers, hasLength(1));
      expect(s.error, isNull);
    });

    test('loading→error：异常经 ErrorRouter.normalize 填入 error', () async {
      final ProviderContainer c = makeContainer();
      ctrl(c);
      await Future<void>.delayed(Duration.zero);
      completer.completeError(Exception('boom'));
      await Future<void>.delayed(Duration.zero);
      final MarketHomeState s = read(c);
      expect(s.loading, isFalse);
      expect(s.error, isNotNull);
    });

    test('selectTab 切二级 tab', () {
      final ProviderContainer c = makeContainer();
      ctrl(c).selectTab(MarketTab.gainers);
      expect(read(c).tab, MarketTab.gainers);
    });

    test('setSearchHistory 回填历史', () {
      final ProviderContainer c = makeContainer();
      ctrl(c).setSearchHistory(<String>['DOGE']);
      expect(read(c).searchHistory, <String>['DOGE']);
    });
  });

  group('visibleTickers (#2192 派生上移)', () {
    const Ticker spot = Ticker(
      symbol: 'BTCUSDT',
      price: 100,
      changePercent: 2,
      volume24h: 10,
    );
    const Ticker perp = Ticker(
      symbol: 'ETHUSDT',
      price: 50,
      changePercent: -3,
      volume24h: 5,
      kind: MarketKind.perp,
    );
    const Ticker loser = Ticker(
      symbol: 'SOLUSDT',
      price: 20,
      changePercent: -1,
      volume24h: 3,
    );

    Future<MarketHomeController> loaded(ProviderContainer c) async {
      ctrl(c);
      await Future<void>.delayed(Duration.zero);
      completer.complete(<Ticker>[spot, perp, loser]);
      await Future<void>.delayed(Duration.zero);
      return ctrl(c);
    }

    test('spot/perp 按 kind 过滤', () async {
      final ProviderContainer c = makeContainer();
      final MarketHomeController k = await loaded(c);
      k.selectTab(MarketTab.spot);
      expect(
        k.visibleTickers(const <String>{}).map((Ticker t) => t.symbol).toList(),
        <String>['BTCUSDT', 'SOLUSDT'],
      );
      k.selectTab(MarketTab.perp);
      expect(
        k.visibleTickers(const <String>{}).single.symbol,
        'ETHUSDT',
      );
    });

    test('watchlist 仅命中收藏集合', () async {
      final ProviderContainer c = makeContainer();
      final MarketHomeController k = await loaded(c);
      k.selectTab(MarketTab.watchlist);
      expect(
        k.visibleTickers(const <String>{'ETHUSDT'}).single.symbol,
        'ETHUSDT',
      );
    });

    test('gainers 涨幅>0 降序；losers 跌幅<0 升序', () async {
      final ProviderContainer c = makeContainer();
      final MarketHomeController k = await loaded(c);
      k.selectTab(MarketTab.gainers);
      expect(
        k.visibleTickers(const <String>{}).map((Ticker t) => t.symbol).toList(),
        <String>['BTCUSDT'],
      );
      k.selectTab(MarketTab.losers);
      // perp(-3) 比 sol(-1) 更跌 → 升序在前
      expect(
        k.visibleTickers(const <String>{}).map((Ticker t) => t.symbol).toList(),
        <String>['ETHUSDT', 'SOLUSDT'],
      );
    });
  });
}
