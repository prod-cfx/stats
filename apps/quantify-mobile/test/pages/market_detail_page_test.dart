import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/mock/fixtures/candles.dart';
import 'package:quantify_mobile/data/mock/fixtures/orderbook.dart';
import 'package:quantify_mobile/data/mock/fixtures/tickers.dart';
import 'package:quantify_mobile/data/models/kline_models.dart';
import 'package:quantify_mobile/data/models/long_short_models.dart';
import 'package:quantify_mobile/data/models/orderbook_models.dart';
import 'package:quantify_mobile/data/models/ticker_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/kline_repository.dart';
import 'package:quantify_mobile/data/repositories/long_short_repository.dart';
import 'package:quantify_mobile/data/repositories/orderbook_repository.dart';
import 'package:quantify_mobile/data/repositories/ticker_repository.dart';
import 'package:quantify_mobile/pages/market/market_detail_page.dart';
import 'package:quantify_mobile/pages/market/widgets/orderbook_view.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/widgets/qz_kline_chart.dart';

class _FakeTickerRepository implements TickerRepository {
  @override
  Future<List<Ticker>> listTickers() async => mockTickers;

  @override
  Stream<Ticker> watchTicker(String symbol) => const Stream<Ticker>.empty();
}

class _FakeOrderbookRepository implements OrderbookRepository {
  final StreamController<OrderbookSnapshot> controller =
      StreamController<OrderbookSnapshot>.broadcast();

  @override
  Future<OrderbookSnapshot> getSnapshot(String symbol) async =>
      buildMockOrderbook(
        symbol: symbol,
        mid: 68250.42,
        timestamp: DateTime(2026),
      );

  @override
  Stream<OrderbookSnapshot> watchOrderbook(String symbol) => controller.stream;
}

class _FakeKlineRepository implements KlineRepository {
  _FakeKlineRepository({this.failHistory = false});

  static const int historyCount = 30;
  final StreamController<Candle> controller =
      StreamController<Candle>.broadcast();

  /// `true` 时 `listCandles` 抛错，用于覆盖 K 线加载失败路径。
  bool failHistory;

  /// 记录最近一次 `listCandles` 的 interval，用于竞态守卫测试断言。
  KlineInterval? lastListInterval;

  /// 每个 interval 注册一个 `Completer<List<Candle>>`，可在测试中手动
  /// `complete` 以编排"哪次 await 先 resolve"，真正测试 requestId 竞态。
  final Map<KlineInterval, Completer<List<Candle>>> pendingByInterval =
      <KlineInterval, Completer<List<Candle>>>{};

  /// `true` 时 `listCandles` 不立即返回，而是注册到 `pendingByInterval`，
  /// 等测试 `completePending(interval, candles)` 显式触发。
  bool manualPending = false;

  @override
  Future<List<Candle>> listCandles({
    required String symbol,
    required KlineInterval interval,
    required int limit,
  }) async {
    lastListInterval = interval;
    if (failHistory) throw StateError('mock listCandles failure');
    if (manualPending) {
      final Completer<List<Candle>> c = Completer<List<Candle>>();
      pendingByInterval[interval] = c;
      return c.future;
    }
    return generateSeededCandles(interval: interval, count: historyCount);
  }

  void completePending(KlineInterval interval, List<Candle> data) {
    final Completer<List<Candle>>? c = pendingByInterval.remove(interval);
    if (c == null) {
      throw StateError('no pending listCandles for $interval');
    }
    c.complete(data);
  }

  @override
  Stream<Candle> watchCandles({
    required String symbol,
    required KlineInterval interval,
  }) => controller.stream;

  Future<void> close() => controller.close();
}

class _FakeLongShortRepository implements LongShortRepository {
  @override
  Future<LongShortRatio> getRatio({
    required String symbol,
    required KlineInterval interval,
  }) async => LongShortRatio(
    symbol: symbol,
    longRatio: 0.58,
    shortRatio: 0.42,
    timestamp: DateTime(2026),
  );
}

Future<_FakeKlineRepository> _pump(
  WidgetTester tester,
  _FakeOrderbookRepository orderbookRepo, {
  QzTheme theme = QzTheme.fallback,
  _FakeKlineRepository? klineRepo,
}) async {
  final _FakeKlineRepository repo = klineRepo ?? _FakeKlineRepository();
  // 注册 teardown 关闭 broadcast controller，避免 flutter_test 警告资源泄漏。
  addTearDown(() => repo.controller.isClosed ? null : repo.close());
  await tester.binding.setSurfaceSize(const Size(420, 1600));
  final GoRouter router = GoRouter(
    initialLocation: '/market/BTCUSDT',
    routes: <RouteBase>[
      GoRoute(
        path: r'/market/:symbol([A-Z0-9-]{2,})',
        builder: (BuildContext context, GoRouterState s) =>
            MarketDetailPage(symbol: s.pathParameters['symbol']!),
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        tickerRepositoryProvider.overrideWithValue(_FakeTickerRepository()),
        orderbookRepositoryProvider.overrideWithValue(orderbookRepo),
        longShortRepositoryProvider.overrideWithValue(
          _FakeLongShortRepository(),
        ),
        klineRepositoryProvider.overrideWithValue(repo),
      ],
      child: MaterialApp.router(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(theme),
        routerConfig: router,
      ),
    ),
  );
  // Resolve futures: tickerRepo / longShortRepo are sync mocks (no delay),
  // klineRepo's listCandles awaits 0ms in this fake, orderbookRepo similar.
  // Three pumps cover: initial frame -> async loaded -> kline post-init.
  await tester.pump();
  await tester.pump();
  await tester.pump();
  return repo;
}

void main() {
  testWidgets('MarketDetailPage 渲染价格、K 线占位，盘口推流刷新', (
    WidgetTester tester,
  ) async {
    final _FakeOrderbookRepository orderbookRepo = _FakeOrderbookRepository();
    await _pump(tester, orderbookRepo);

    expect(find.byType(QzKlineChart), findsOneWidget);
    expect(find.text('68250.42'), findsOneWidget);
    expect(find.byType(OrderbookView), findsOneWidget);

    orderbookRepo.controller.add(
      OrderbookSnapshot(
        symbol: 'BTCUSDT',
        bids: const <OrderbookLevel>[
          OrderbookLevel(price: 68249.00, quantity: 9.999),
        ],
        asks: const <OrderbookLevel>[
          OrderbookLevel(price: 68251.00, quantity: 8.888),
        ],
        timestamp: DateTime(2026),
      ),
    );
    // broadcast stream needs an extra microtask + frame to propagate
    await tester.pump();
    await tester.pump();
    expect(find.text('9.999'), findsOneWidget);
    expect(find.text('8.888'), findsOneWidget);
  });

  testWidgets('MarketDetailPage K 线推流 controller.add 触发 candles 追加', (
    WidgetTester tester,
  ) async {
    final _FakeOrderbookRepository orderbookRepo = _FakeOrderbookRepository();
    final _FakeKlineRepository klineRepo = _FakeKlineRepository();
    await _pump(tester, orderbookRepo, klineRepo: klineRepo);

    // 初始历史已加载，KChartWidget 渲染（非 spinner）
    final QzKlineChart initial = tester.widget<QzKlineChart>(
      find.byType(QzKlineChart),
    );
    final int initialCount = initial.candles.length;
    expect(initialCount, greaterThan(0));

    // 推流注入一根新蜡烛
    final Candle next = generateSeededCandles(
      interval: KlineInterval.h1,
      count: 1,
    ).last;
    klineRepo.controller.add(next);
    await tester.pump();
    await tester.pump();

    final QzKlineChart updated = tester.widget<QzKlineChart>(
      find.byType(QzKlineChart),
    );
    expect(updated.candles.length, initialCount + 1);
  });

  testWidgets('MarketDetailPage listCandles 抛错时 QzKlineChart 进入 hasError 态', (
    WidgetTester tester,
  ) async {
    final _FakeOrderbookRepository orderbookRepo = _FakeOrderbookRepository();
    final _FakeKlineRepository klineRepo = _FakeKlineRepository(
      failHistory: true,
    );
    await _pump(tester, orderbookRepo, klineRepo: klineRepo);

    final QzKlineChart chart = tester.widget<QzKlineChart>(
      find.byType(QzKlineChart),
    );
    expect(chart.hasError, isTrue);
    expect(chart.candles, isEmpty);
    expect(chart.onRetry, isNotNull);
    expect(find.text('K 线加载失败'), findsOneWidget);
    expect(find.text('重试'), findsOneWidget);
  });

  testWidgets('MarketDetailPage 周期切换：旧 m5 请求 late-resolve 不应覆盖 h4 视图', (
    WidgetTester tester,
  ) async {
    // 通过 tab 点击触发周期切换，并用 manualPending 显式编排两个 listCandles
    // 完成顺序，证明 requestId 守卫真的丢弃旧请求。
    final _FakeOrderbookRepository orderbookRepo = _FakeOrderbookRepository();
    final _FakeKlineRepository klineRepo = _FakeKlineRepository();
    await _pump(tester, orderbookRepo, klineRepo: klineRepo);

    // 进入 manualPending：后续 listCandles 都进 pending map
    klineRepo.manualPending = true;

    // 触发周期切换 h1 → m5（直接调用 widget 的 onIntervalChanged 回调，
    // 等价于点击 tab，但不依赖手势命中测试）
    tester
        .widget<QzKlineChart>(find.byType(QzKlineChart))
        .onIntervalChanged(KlineInterval.m5);
    // 让 await oldSub.cancel() 在真实事件循环里 resolve（fake clock
    // 不会自动推进 broadcast stream 的 cancel 微任务），再 pump 一次
    // 把 setState 应用到 widget tree。
    await tester.runAsync(() async => await Future<void>.delayed(Duration.zero));
    await tester.pump();
    expect(
      klineRepo.pendingByInterval.containsKey(KlineInterval.m5),
      isTrue,
      reason: 'm5 pending 未注册；当前 pending=${klineRepo.pendingByInterval.keys.toList()} lastList=${klineRepo.lastListInterval}',
    );

    // 触发周期切换 m5 → h4
    tester
        .widget<QzKlineChart>(find.byType(QzKlineChart))
        .onIntervalChanged(KlineInterval.h4);
    await tester.runAsync(() async => await Future<void>.delayed(Duration.zero));
    await tester.pump();
    expect(klineRepo.pendingByInterval.containsKey(KlineInterval.h4), isTrue);

    // 先 complete h4 —— 最新 requestId，candles 应当渲染 h4 数据
    final List<Candle> h4Data = generateSeededCandles(
      interval: KlineInterval.h4,
      count: 30,
    );
    klineRepo.completePending(KlineInterval.h4, h4Data);
    for (int i = 0; i < 3; i++) {
      await tester.pump();
    }
    final QzKlineChart afterH4 = tester.widget<QzKlineChart>(
      find.byType(QzKlineChart),
    );
    expect(afterH4.candles, h4Data);
    expect(afterH4.interval, KlineInterval.h4);

    // 再 complete m5 —— 旧 requestId，守卫应丢弃，不覆盖 h4 视图
    final List<Candle> m5Data = generateSeededCandles(
      interval: KlineInterval.m5,
      count: 30,
    );
    klineRepo.completePending(KlineInterval.m5, m5Data);
    for (int i = 0; i < 3; i++) {
      await tester.pump();
    }
    final QzKlineChart afterM5Late = tester.widget<QzKlineChart>(
      find.byType(QzKlineChart),
    );
    expect(
      afterM5Late.candles,
      h4Data,
      reason: '旧 m5 请求 late-resolve 不应覆盖 h4 当前视图（requestId 守卫）',
    );
  });

  testWidgets('MarketDetailPage 9 主题循环 pump 不抛异常', (WidgetTester tester) async {
    for (final QzBg bg in QzBg.values) {
      for (final QzAccent accent in QzAccent.values) {
        await _pump(
          tester,
          _FakeOrderbookRepository(),
          theme: QzTheme(bg: bg, accent: accent),
        );
        expect(find.byType(QzKlineChart), findsOneWidget);
        expect(tester.takeException(), isNull);
      }
    }
  });
}
