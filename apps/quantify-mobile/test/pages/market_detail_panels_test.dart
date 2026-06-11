import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../fixtures/mock/fixtures/candles.dart';
import '../fixtures/mock/fixtures/orderbook.dart';
import '../fixtures/mock/fixtures/tickers.dart';
import 'package:quantify_mobile/data/models/kline_models.dart';
import 'package:quantify_mobile/data/models/orderbook_models.dart';
import 'package:quantify_mobile/data/models/ticker_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/kline_repository.dart';
import 'package:quantify_mobile/data/repositories/orderbook_repository.dart';
import 'package:quantify_mobile/data/repositories/ticker_repository.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/market/market_detail_page.dart';
import 'package:quantify_mobile/pages/market/widgets/depth_panel.dart';
import 'package:quantify_mobile/pages/market/widgets/market_detail_stats.dart';
import 'package:quantify_mobile/pages/market/widgets/orderbook_view.dart';
import 'package:quantify_mobile/pages/market/widgets/trades_panel.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import '../helpers/test_overrides.dart';

class _StubTickerRepository implements TickerRepository {
  static const Ticker btc = Ticker(
    symbol: 'BTCUSDT',
    price: 100,
    changePercent: 2,
    volume24h: 1000,
    high24h: 110,
    low24h: 90,
    openInterest: 2500,
    indexPrice: 99.5,
    markPrice: 100.5,
    fundingRate: 0.0123,
    turnover24h: 1000,
  );

  @override
  Future<List<Ticker>> listTickers() async => <Ticker>[btc, ...mockTickers];

  @override
  Future<Ticker?> getTicker({
    required String symbol,
    MarketKind kind = MarketKind.perp,
    String? exchange,
  }) async => btc;

  @override
  Stream<Ticker> watchTicker(
    String symbol, {
    MarketKind kind = MarketKind.perp,
    String? exchange,
  }) => Stream<Ticker>.value(btc);
}

Future<void> _pumpStats(WidgetTester tester, Ticker ticker) async {
  await tester.binding.setSurfaceSize(const Size(420, 600));
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('zh'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: buildQzThemeData(QzTheme.fallback),
      home: Scaffold(
        body: MarketDetailStats(displaySymbol: 'BTCUSDT', ticker: ticker),
      ),
    ),
  );
}

class _StubOrderbookRepository implements OrderbookRepository {
  @override
  Future<OrderbookSnapshot> getSnapshot(String symbol) async =>
      buildMockOrderbook(
        symbol: symbol,
        mid: 68250.42,
        timestamp: DateTime(2026),
      );

  @override
  Stream<OrderbookSnapshot> watchOrderbook(String symbol) =>
      const Stream<OrderbookSnapshot>.empty();
}

class _StubKlineRepository implements KlineRepository {
  @override
  Future<List<Candle>> listCandles({
    required String symbol,
    required KlineInterval interval,
    required int limit,
  }) async => generateSeededCandles(interval: interval, count: 30);

  @override
  Stream<Candle> watchCandles({
    required String symbol,
    required KlineInterval interval,
  }) => const Stream<Candle>.empty();
}

Future<void> _pump(WidgetTester tester) async {
  SharedPreferences.setMockInitialValues(<String, Object>{});
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  await tester.binding.setSurfaceSize(const Size(420, 1800));
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
        ...testRepositoryOverridesWithoutTickerKlineOrderbook,
        tickerRepositoryProvider.overrideWithValue(_StubTickerRepository()),
        orderbookRepositoryProvider.overrideWithValue(
          _StubOrderbookRepository(),
        ),
        klineRepositoryProvider.overrideWithValue(_StubKlineRepository()),
        sharedPreferencesProvider.overrideWithValue(prefs),
      ],
      child: MaterialApp.router(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(QzTheme.fallback),
        routerConfig: router,
      ),
    ),
  );
  for (int i = 0; i < 4; i++) {
    await tester.pump();
  }
}

void main() {
  testWidgets(
    'MarketDetailStats renders real optional ticker fields without widget derivation',
    (WidgetTester tester) async {
      await _pumpStats(
        tester,
        const Ticker(
          symbol: 'BTCUSDT',
          price: 100,
          changePercent: 2,
          volume24h: 1000,
          high24h: 110,
          low24h: 90,
          openInterest: 2500,
          indexPrice: 99.5,
          markPrice: 100.5,
          fundingRate: 0.0123,
        ),
      );

      expect(find.text('99.50'), findsOneWidget);
      expect(find.text('100.50'), findsOneWidget);
      expect(find.text('+1.23%'), findsOneWidget);
      expect(find.text('2.50K'), findsOneWidget);
      expect(find.text('110.00'), findsOneWidget);
      expect(find.text('90.00'), findsOneWidget);
    },
  );

  testWidgets(
    'MarketDetailStats renders placeholders when backend fields are missing',
    (WidgetTester tester) async {
      await _pumpStats(
        tester,
        const Ticker(
          symbol: 'BTCUSDT',
          price: 100,
          changePercent: 2,
          volume24h: 1000,
        ),
      );

      expect(find.text('--'), findsNWidgets(6));
    },
  );

  testWidgets('交易详情：价格头三行（指数/标记/资金费率/持仓量 + 24H 高/低/量）+ 副标题 + star/more 按钮', (
    WidgetTester tester,
  ) async {
    await _pump(tester);

    // row2：指数价格 / 标记价格 / 资金费率 / 持仓量
    expect(find.text('指数价格'), findsOneWidget);
    expect(find.text('标记价格'), findsOneWidget);
    expect(find.text('资金费率'), findsOneWidget);
    expect(find.text('持仓量'), findsOneWidget);
    // row3：24H 高 / 低 / 量
    expect(find.text('24H 高'), findsOneWidget);
    expect(find.text('24H 低'), findsOneWidget);
    expect(find.text('24H 量'), findsOneWidget);
    expect(find.byType(MarketDetailStats), findsOneWidget);
    expect(find.text('110.00'), findsWidgets);
    expect(find.text('90.00'), findsWidgets);
    expect(find.text('+100.00K'), findsNothing);

    // 顶栏副标题：默认数据源为聚合（#2113 起 _source 默认 aggregated）。
    expect(find.text('永续 · 聚合'), findsOneWidget);

    // 顶栏 star / more 按钮（按 tooltip 命中）
    expect(find.byTooltip('收藏'), findsOneWidget);
    expect(find.byTooltip('更多'), findsOneWidget);
  });

  testWidgets('交易详情：默认显示盘口 tab，切到「成交」显示 TradesPanel', (
    WidgetTester tester,
  ) async {
    await _pump(tester);

    // 默认：3 段 panel tab + OrderbookView 可见
    expect(find.text('盘口'), findsWidgets);
    expect(find.text('成交'), findsOneWidget);
    expect(find.text('深度图'), findsOneWidget);
    expect(find.byType(OrderbookView), findsOneWidget);

    await tester.tap(find.text('成交'));
    await tester.pump();
    await tester.pump();

    expect(find.byType(TradesPanel), findsOneWidget);
    expect(find.byType(OrderbookView), findsNothing);
    // 表头三列 + 至少 30 行成交
    expect(find.text('成交时间'), findsOneWidget);
    expect(find.text('价格(USDT)'), findsOneWidget);
    expect(find.text('数量(BTC)'), findsOneWidget);
  });

  testWidgets('交易详情：切到「深度图」显示 DepthPanel + BID/ASK 图例', (
    WidgetTester tester,
  ) async {
    await _pump(tester);

    await tester.tap(find.text('深度图'));
    await tester.pump();
    // wait for DepthPanel.getSnapshot
    for (int i = 0; i < 4; i++) {
      await tester.pump();
    }

    expect(find.byType(DepthPanel), findsOneWidget);
    expect(find.text('BID'), findsOneWidget);
    expect(find.text('ASK'), findsOneWidget);
    expect(find.text('SPREAD'), findsOneWidget);
    // SPREAD 双值格式：`绝对值 / 百分比%`，对齐设计稿 `0.10 / 0.0001%`。
    expect(
      find.byWidgetPredicate(
        (Widget w) =>
            w is Text &&
            w.data != null &&
            RegExp(r'^\d+\.\d{2} / \d+\.\d{4}%$').hasMatch(w.data!),
      ),
      findsOneWidget,
    );
    // CustomPaint 存在（深度曲线）
    expect(find.byType(CustomPaint), findsWidgets);
    expect(tester.takeException(), isNull);
  });
}
