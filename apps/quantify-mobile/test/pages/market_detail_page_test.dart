import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:quantify_mobile/data/mock/fixtures/candles.dart';
import 'package:quantify_mobile/data/mock/fixtures/orderbook.dart';
import 'package:quantify_mobile/data/mock/fixtures/tickers.dart';
import 'package:quantify_mobile/data/models/exchange_long_short_models.dart';
import 'package:quantify_mobile/data/models/kline_models.dart';
import 'package:quantify_mobile/data/models/long_short_models.dart';
import 'package:quantify_mobile/data/models/orderbook_models.dart';
import 'package:quantify_mobile/data/models/ticker_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/kline_repository.dart';
import 'package:quantify_mobile/data/repositories/long_short_repository.dart';
import 'package:quantify_mobile/data/repositories/orderbook_repository.dart';
import 'package:quantify_mobile/data/repositories/ticker_repository.dart';
import 'package:quantify_mobile/data/storage/market_favorites_persistence.dart';
import 'package:quantify_mobile/pages/market/market_detail_page.dart';
import 'package:quantify_mobile/pages/market/widgets/orderbook_view.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_context.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/widgets/qz_kline_chart.dart';
import 'package:quantify_mobile/widgets/qz_top_bar.dart';

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

  @override
  Future<MarketLongShortSnapshot> getSnapshot({
    required String symbol,
  }) async => MarketLongShortSnapshot(
    symbol: symbol,
    baseAsset: 'BTC',
    assetGlyph: 'B',
    assetGradientStart: const Color(0xFFF7931A),
    assetGradientEnd: const Color(0xFFC16100),
    totalNotional: '\$0',
    longNotional: '\$0',
    shortNotional: '\$0',
    longPct: 50,
    shortPct: 50,
    exchanges: const <ExchangeLongShort>[],
    timestamp: DateTime(2026),
  );
}

Future<_FakeKlineRepository> _pump(
  WidgetTester tester,
  _FakeOrderbookRepository orderbookRepo, {
  QzTheme theme = QzTheme.fallback,
  _FakeKlineRepository? klineRepo,
  Map<String, Object>? prefsSeed,
  String symbol = 'BTCUSDT',
}) async {
  final _FakeKlineRepository repo = klineRepo ?? _FakeKlineRepository();
  // 注册 teardown 关闭 broadcast controller，避免 flutter_test 警告资源泄漏。
  addTearDown(() => repo.controller.isClosed ? null : repo.close());
  SharedPreferences.setMockInitialValues(prefsSeed ?? <String, Object>{});
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  await tester.binding.setSurfaceSize(const Size(420, 1600));
  final GoRouter router = GoRouter(
    initialLocation: '/market/$symbol',
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
        sharedPreferencesProvider.overrideWithValue(prefs),
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
    // 头部价格 + 盘口 mid 行均渲染该价格。
    expect(find.text('68250.42'), findsWidgets);
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

  // 验证底部 buy/sell 按钮渲染主文案 + 副文案两行（issue #1667）。
  testWidgets('MarketDetailPage 底部按钮渲染主+副文案', (WidgetTester tester) async {
    await _pump(tester, _FakeOrderbookRepository());

    expect(find.byKey(const Key('market-detail-buy')), findsOneWidget);
    expect(find.byKey(const Key('market-detail-sell')), findsOneWidget);
    expect(find.text('买入 / 做多'), findsOneWidget);
    expect(find.text('卖出 / 做空'), findsOneWidget);
    expect(find.text('开多 · 10x'), findsOneWidget);
    expect(find.text('开空 · 10x'), findsOneWidget);
  });

  // #1755 收藏：默认未收藏（prefs 含其它 symbol），点击切换为已收藏并提示。
  testWidgets('MarketDetailPage 收藏按钮点击：未收藏 → 已收藏 + toast + 写盘', (
    WidgetTester tester,
  ) async {
    await _pump(
      tester,
      _FakeOrderbookRepository(),
      prefsSeed: <String, Object>{
        MarketFavoritesPersistence.kKey: <String>['ETHUSDT'],
      },
    );

    // 初始为 star_border（未收藏）
    Icon icon = tester.widget<Icon>(
      find.descendant(
        of: find.byKey(const Key('market-detail-favorite')),
        matching: find.byType(Icon),
      ),
    );
    expect(icon.icon, Icons.star_border);

    await tester.tap(find.byKey(const Key('market-detail-favorite')));
    await tester.pump();
    await tester.pump();

    icon = tester.widget<Icon>(
      find.descendant(
        of: find.byKey(const Key('market-detail-favorite')),
        matching: find.byType(Icon),
      ),
    );
    expect(icon.icon, Icons.star, reason: '点击后图标应变为实心星');
    expect(find.text('已加入自选'), findsOneWidget);

    final SharedPreferences prefs = await SharedPreferences.getInstance();
    expect(
      prefs.getStringList(MarketFavoritesPersistence.kKey),
      containsAll(<String>['ETHUSDT', 'BTCUSDT']),
      reason: '收藏应持久化到 SharedPreferences',
    );
  });

  // #1755 取消收藏：默认已收藏（prefs 含当前 symbol），点击切回未收藏。
  testWidgets('MarketDetailPage 收藏按钮点击：已收藏 → 取消 + toast', (
    WidgetTester tester,
  ) async {
    await _pump(
      tester,
      _FakeOrderbookRepository(),
      prefsSeed: <String, Object>{
        MarketFavoritesPersistence.kKey: <String>['BTCUSDT'],
      },
    );

    Icon icon = tester.widget<Icon>(
      find.descendant(
        of: find.byKey(const Key('market-detail-favorite')),
        matching: find.byType(Icon),
      ),
    );
    expect(icon.icon, Icons.star);

    await tester.tap(find.byKey(const Key('market-detail-favorite')));
    await tester.pump();
    await tester.pump();

    icon = tester.widget<Icon>(
      find.descendant(
        of: find.byKey(const Key('market-detail-favorite')),
        matching: find.byType(Icon),
      ),
    );
    expect(icon.icon, Icons.star_border);
    expect(find.text('已移出自选'), findsOneWidget);
  });

  // #1755 更多菜单：打开后含可用「复制交易对」与禁用项「即将上线」。
  testWidgets('MarketDetailPage 更多按钮打开菜单：复制可用 + 三项禁用', (
    WidgetTester tester,
  ) async {
    await _pump(tester, _FakeOrderbookRepository());

    await tester.tap(find.byKey(const Key('market-detail-more')));
    await tester.pumpAndSettle();

    expect(find.text('更多操作'), findsOneWidget);
    expect(find.byKey(const Key('market-more-copy-symbol')), findsOneWidget);
    expect(find.byKey(const Key('market-more-share')), findsOneWidget);
    expect(find.byKey(const Key('market-more-alert')), findsOneWidget);
    expect(
      find.byKey(const Key('market-more-switch-exchange')),
      findsOneWidget,
    );

    // 三个禁用项都展示「即将上线」，且 ListTile.enabled == false
    expect(find.text('即将上线'), findsNWidgets(3));
    for (final Key key in <Key>[
      const Key('market-more-share'),
      const Key('market-more-alert'),
      const Key('market-more-switch-exchange'),
    ]) {
      final ListTile tile = tester.widget<ListTile>(
        find.descendant(
          of: find.byKey(key),
          matching: find.byType(ListTile),
        ),
      );
      expect(tile.enabled, isFalse, reason: '$key 应禁用');
    }
  });

  // #1755 复制交易对：点击关闭菜单并写入剪贴板 + 提示。
  testWidgets('MarketDetailPage 更多菜单复制交易对：写剪贴板 + toast', (
    WidgetTester tester,
  ) async {
    final List<MethodCall> clipboardCalls = <MethodCall>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (MethodCall call) async {
        if (call.method == 'Clipboard.setData') {
          clipboardCalls.add(call);
        }
        return null;
      },
    );
    addTearDown(() {
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      );
    });

    await _pump(tester, _FakeOrderbookRepository());
    await tester.tap(find.byKey(const Key('market-detail-more')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('market-more-copy-symbol')));
    await tester.pumpAndSettle();

    expect(find.text('更多操作'), findsNothing, reason: '复制后菜单应关闭');
    expect(clipboardCalls, isNotEmpty);
    expect(
      (clipboardCalls.first.arguments as Map<Object?, Object?>)['text'],
      'BTCUSDT',
    );
    expect(find.text('已复制交易对'), findsOneWidget);
  });

  // #2101 K 线下方 4 格累计统计行：4 个标签齐全。
  testWidgets('MarketDetailPage 渲染累计统计行 4 格标签', (WidgetTester tester) async {
    await _pump(tester, _FakeOrderbookRepository());

    expect(find.text('累计成交额(\$)'), findsOneWidget);
    expect(find.text('累计净流入(\$)'), findsOneWidget);
    expect(find.text('最高'), findsOneWidget);
    expect(find.text('最低'), findsOneWidget);
  });

  // #2101 净流入为正（BTCUSDT changePercent +1.82）使用涨色，且带 + 号。
  testWidgets('MarketDetailPage 累计净流入正值用涨色', (WidgetTester tester) async {
    await _pump(tester, _FakeOrderbookRepository(), symbol: 'BTCUSDT');

    final BuildContext ctx = tester.element(find.text('累计净流入(\$)'));
    final Text inflow = tester.widget<Text>(
      find.textContaining(RegExp(r'^\+.*[BMK]$')),
    );
    expect(
      inflow.style?.color,
      ctx.qzScheme.marketUp,
      reason: '正净流入应使用涨色',
    );
  });

  // #2101 净流入为负（ETHUSDT changePercent -0.74）使用跌色，且带 - 号。
  testWidgets('MarketDetailPage 累计净流入负值用跌色', (WidgetTester tester) async {
    await _pump(tester, _FakeOrderbookRepository(), symbol: 'ETHUSDT');

    final BuildContext ctx = tester.element(find.text('累计净流入(\$)'));
    final Text inflow = tester.widget<Text>(
      find.textContaining(RegExp(r'^-.*[BMK]$')),
    );
    expect(
      inflow.style?.color,
      ctx.qzScheme.marketDown,
      reason: '负净流入应使用跌色',
    );
  });

  // #2105 TopBar 标题：标准交易对展示 BASE / QUOTE 分隔格式。
  testWidgets('MarketDetailPage TopBar 标题展示 BTC / USDT 分隔格式', (
    WidgetTester tester,
  ) async {
    await _pump(tester, _FakeOrderbookRepository());

    expect(find.text('BTC / USDT'), findsOneWidget);
    expect(find.text('BTCUSDT'), findsNothing);
  });

  // #2105 TopBar 标题：非标准交易对（无法解析 quote）回退展示原 symbol，不崩溃。
  testWidgets('MarketDetailPage TopBar 非标准 symbol 回退展示原文', (
    WidgetTester tester,
  ) async {
    await _pump(tester, _FakeOrderbookRepository(), symbol: 'FOOBAR');

    expect(tester.takeException(), isNull);
    // TopBar 标题回退展示原 symbol（FOOBAR 也出现在 not-found 空态，故用
    // QzTopBar 内 descendant 精确定位标题，避免 findsOneWidget 误判）。
    expect(
      find.descendant(
        of: find.byType(QzTopBar),
        matching: find.text('FOOBAR'),
      ),
      findsOneWidget,
    );
  });
}
