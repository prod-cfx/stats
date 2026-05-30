import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:quantify_mobile/data/mock/fixtures/tickers.dart';
import 'package:quantify_mobile/data/models/ticker_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/ticker_repository.dart';
import 'package:quantify_mobile/pages/market/market_detail_page.dart';
import 'package:quantify_mobile/pages/market/market_home_page.dart';
import 'package:quantify_mobile/pages/market/widgets/ticker_row.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// 行情数据屏（issue #1561/#1600/#1597）的二级 tab / 搜索 / 列表行为测试。
///
/// issue #1852 起，行情数据屏不再有独立 `QzTopBar` 标题层——统一由「数据」hub
/// （`DataHubPage`）的 hub header 承载标题/铃铛。这里直接挂被测主体
/// [MarketHomeBody]（即行情数据 tab 的内容），验证既有 tab/搜索/列表行为不变；
/// 不挂整个 hub，避免兄弟子屏（多空比的 mock kline 流式 Timer）噪声干扰本屏断言。
/// hub header（横滑 tab + 铃铛 badge）与 hub 集成本身的覆盖见
/// `data_hub_page_test.dart`。
class _FakeTickerRepository implements TickerRepository {
  final Map<String, StreamController<Ticker>> controllers =
      <String, StreamController<Ticker>>{};

  @override
  Future<List<Ticker>> listTickers() async => mockTickers;

  @override
  Stream<Ticker> watchTicker(String symbol) {
    final StreamController<Ticker> controller = controllers.putIfAbsent(
      symbol,
      () => StreamController<Ticker>.broadcast(),
    );
    return controller.stream;
  }
}

Future<void> _pump(
  WidgetTester tester,
  _FakeTickerRepository repo, {
  QzTheme theme = QzTheme.fallback,
  Map<String, Object>? prefsSeed,
}) async {
  SharedPreferences.setMockInitialValues(prefsSeed ?? <String, Object>{});
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  await tester.binding.setSurfaceSize(const Size(420, 3000));
  final GoRouter router = GoRouter(
    initialLocation: '/market',
    routes: <RouteBase>[
      GoRoute(
        path: '/market',
        builder: (BuildContext context, GoRouterState state) =>
            const Scaffold(body: SafeArea(child: MarketHomeBody())),
      ),
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
        tickerRepositoryProvider.overrideWithValue(repo),
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
  await tester.pump();
  await tester.pump();
}

/// 在「tab 行」里找指定 tab 的可点击节点，按 `market-tab-${tab.name}` key 定位，
/// 与实现保持低耦合（不再绑定 `GestureDetector` 具体 widget 类型）。
Finder _findTab(String tabName) {
  return find.byKey(Key('market-tab-$tabName'));
}

void main() {
  testWidgets('行情数据主体无独立 QzTopBar / 自带铃铛（#1852）',
      (WidgetTester tester) async {
    final _FakeTickerRepository repo = _FakeTickerRepository();
    await _pump(tester, repo);

    // 被测主体为 MarketHomeBody，不再有 standalone QzTopBar 包装层。
    expect(find.byType(MarketHomeBody), findsOneWidget);
    // 标题/铃铛归 hub header；行情数据主体内不再自带 market-notification-bell。
    expect(find.byKey(const Key('market-notification-bell')), findsNothing);
  });

  testWidgets('默认自选 tab 展示 5 条 + 推流变价生效（#1600）',
      (WidgetTester tester) async {
    final _FakeTickerRepository repo = _FakeTickerRepository();
    await _pump(tester, repo);

    // 默认 watchlist tab：固定 5 条收藏（_kFavoriteSet）。
    expect(find.byType(TickerRow), findsNWidgets(5));

    // BTCUSDT 在自选中，推一笔变价应反映在 UI。
    // broadcast stream 是异步派发，需要 pumpAndSettle 让订阅完成 + 断言 key 存在。
    await tester.pumpAndSettle();
    expect(
      repo.controllers.containsKey('BTCUSDT'),
      isTrue,
      reason: 'BTCUSDT 行在自选 tab 应已挂载并注册 listener',
    );
    repo.controllers['BTCUSDT']!.add(
      const Ticker(
        symbol: 'BTCUSDT',
        price: 70123.45,
        changePercent: 2.22,
        volume24h: 2.13e10,
        kind: MarketKind.perp,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('70123.45'), findsOneWidget);
  });

  testWidgets('5 tabs 切换：自选 / 现货 / 合约 / 涨幅榜 / 跌幅榜 过滤与排序生效',
      (WidgetTester tester) async {
    final _FakeTickerRepository repo = _FakeTickerRepository();
    await _pump(tester, repo);

    final int spotCount = mockTickers
        .where((Ticker t) => t.kind == MarketKind.spot)
        .length;
    final int perpCount = mockTickers
        .where((Ticker t) => t.kind == MarketKind.perp)
        .length;
    final int gainCount = mockTickers
        .where((Ticker t) => t.changePercent > 0)
        .length;
    final int loseCount = mockTickers
        .where((Ticker t) => t.changePercent < 0)
        .length;

    // 默认 watchlist：5 条收藏。
    expect(find.byType(TickerRow), findsNWidgets(5));

    await tester.tap(_findTab('spot'));
    await tester.pump();
    expect(find.byType(TickerRow), findsNWidgets(spotCount));

    await tester.tap(_findTab('perp'));
    await tester.pump();
    expect(find.byType(TickerRow), findsNWidgets(perpCount));

    await tester.tap(_findTab('gainers'));
    await tester.pump();
    expect(find.byType(TickerRow), findsNWidgets(gainCount));
    // 涨幅榜首行应为 mockTickers 中涨幅最大者。
    final Ticker topGainer = (mockTickers.toList()
          ..sort((Ticker a, Ticker b) =>
              b.changePercent.compareTo(a.changePercent)))
        .first;
    final TickerRow firstRow =
        tester.widget<TickerRow>(find.byType(TickerRow).first);
    expect(firstRow.ticker.symbol, topGainer.symbol);

    await tester.tap(_findTab('losers'));
    await tester.pump();
    expect(find.byType(TickerRow), findsNWidgets(loseCount));
    final Ticker topLoser = (mockTickers
            .where((Ticker t) => t.changePercent < 0)
            .toList()
          ..sort((Ticker a, Ticker b) =>
              a.changePercent.compareTo(b.changePercent)))
        .first;
    final TickerRow firstLoseRow =
        tester.widget<TickerRow>(find.byType(TickerRow).first);
    expect(firstLoseRow.ticker.symbol, topLoser.symbol);

    await tester.tap(_findTab('watchlist'));
    await tester.pump();
    expect(find.byType(TickerRow), findsNWidgets(5));
  });

  testWidgets('默认选中 watchlist tab：底部 underline + 加粗文字（#1600）',
      (WidgetTester tester) async {
    final _FakeTickerRepository repo = _FakeTickerRepository();
    await _pump(tester, repo);

    // 默认 watchlist 必须有 underline 加粗样式；spot 等其它 tab 无 underline。
    final Finder watchlistText = find.descendant(
      of: _findTab('watchlist'),
      matching: find.byType(Text),
    );
    final Text watchlistLabel = tester.widget<Text>(watchlistText);
    expect(watchlistLabel.style!.fontWeight, FontWeight.w700);

    final Finder spotText = find.descendant(
      of: _findTab('spot'),
      matching: find.byType(Text),
    );
    final Text spotLabel = tester.widget<Text>(spotText);
    expect(spotLabel.style!.fontWeight, FontWeight.w500);
  });

  testWidgets('搜索按钮展开行内搜索框并即时过滤当前 tab', (WidgetTester tester) async {
    final _FakeTickerRepository repo = _FakeTickerRepository();
    await _pump(tester, repo);

    // 初始无搜索框。
    expect(find.byKey(const Key('market-search-field')), findsNothing);

    await tester.tap(find.byKey(const Key('market-search-toggle')));
    await tester.pump();
    expect(find.byKey(const Key('market-search-field')), findsOneWidget);

    // 切到合约（BTCUSDT 在合约里），输入 BTC 应只剩 1 行。
    await tester.tap(_findTab('perp'));
    await tester.pump();
    await tester.enterText(
      find.byKey(const Key('market-search-field')),
      'BTC',
    );
    await tester.pump();
    expect(find.byType(TickerRow), findsOneWidget);
    final TickerRow only =
        tester.widget<TickerRow>(find.byType(TickerRow).first);
    expect(only.ticker.symbol, 'BTCUSDT');

    // 无匹配 -> 空态。
    await tester.enterText(
      find.byKey(const Key('market-search-field')),
      'ZZZZZZ',
    );
    await tester.pump();
    expect(find.byType(TickerRow), findsNothing);
    expect(find.text('无匹配结果'), findsOneWidget);

    // 关闭搜索 -> 输入清空 + 列表恢复。
    await tester.tap(find.byKey(const Key('market-search-toggle')));
    await tester.pump();
    expect(find.byKey(const Key('market-search-field')), findsNothing);
    final int perpCount = mockTickers
        .where((Ticker t) => t.kind == MarketKind.perp)
        .length;
    expect(find.byType(TickerRow), findsNWidgets(perpCount));
  });

  testWidgets('点击行情行 push /market/:symbol 进入详情页', (WidgetTester tester) async {
    final _FakeTickerRepository repo = _FakeTickerRepository();
    await _pump(tester, repo);

    // 默认 watchlist tab，首行点击进入详情。
    final TickerRow firstRow =
        tester.widget<TickerRow>(find.byType(TickerRow).first);
    final String expectedSymbol = firstRow.ticker.symbol;

    await tester.tap(find.byType(TickerRow).first);
    await tester.pumpAndSettle();

    expect(find.byType(MarketDetailPage), findsOneWidget);
    expect(find.byType(MarketHomeBody), findsNothing);
    final MarketDetailPage detailPage =
        tester.widget<MarketDetailPage>(find.byType(MarketDetailPage));
    expect(detailPage.symbol, expectedSymbol);
  });

  testWidgets('搜索框 placeholder 为「搜索币种 · BTC, ETH, SOL…」（#1597 设计稿）',
      (WidgetTester tester) async {
    final _FakeTickerRepository repo = _FakeTickerRepository();
    await _pump(tester, repo);

    await tester.tap(find.byKey(const Key('market-search-toggle')));
    await tester.pump();
    expect(find.text('搜索币种 · BTC, ETH, SOL…'), findsOneWidget);
  });

  testWidgets('行情数据屏 9 主题循环 pump 不抛异常',
      (WidgetTester tester) async {
    for (final QzBg bg in QzBg.values) {
      for (final QzAccent accent in QzAccent.values) {
        await _pump(
          tester,
          _FakeTickerRepository(),
          theme: QzTheme(bg: bg, accent: accent),
        );
        // 默认 watchlist tab：固定 5 条收藏。
        expect(find.byType(TickerRow), findsNWidgets(5));
        expect(
          tester.takeException(),
          isNull,
          reason: 'theme bg=$bg accent=$accent',
        );
      }
    }
  });
}
