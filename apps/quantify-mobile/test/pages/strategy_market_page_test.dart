import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/mock/fixtures/strategies.dart';
import 'package:quantify_mobile/data/models/strategy_models.dart';
import 'package:quantify_mobile/pages/strategy/strategy_detail_page.dart';
import 'package:quantify_mobile/pages/strategy/strategy_home_page.dart';
import 'package:quantify_mobile/pages/strategy/widgets/featured_hero_card.dart';
import 'package:quantify_mobile/pages/strategy/widgets/strategy_card_tile.dart';
import 'package:quantify_mobile/router/app_router.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 简化测试用 router（**故意不含 shell**）：仅验证 `/strategy` 与
/// `/strategy/:id` 两个 builder 命中，不验证 shell 覆盖语义（那个由
/// smoke test 用真实 `buildRouter()` 校验）。
Future<void> _pump(WidgetTester tester, {QzTheme? theme}) async {
  // 用足够高的 surface 让 ListView.builder 一次性建出整页卡片，
  // 避免 viewport 截断使 widget count 少于 pageSize。
  await tester.binding.setSurfaceSize(const Size(420, 4200));
  SharedPreferences.setMockInitialValues(<String, Object>{});
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  final GoRouter router = GoRouter(
    initialLocation: '/strategy',
    routes: <RouteBase>[
      GoRoute(
        path: '/strategy',
        builder: (BuildContext context, GoRouterState state) =>
            const StrategyHomePage(),
      ),
      GoRoute(
        path: '/strategy/:id',
        builder: (BuildContext context, GoRouterState s) =>
            StrategyDetailPage(id: s.pathParameters['id']!),
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        sharedPreferencesProvider.overrideWithValue(prefs),
      ],
      child: MaterialApp.router(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(
          theme ?? const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
        ),
        routerConfig: router,
      ),
    ),
  );
  // 初始 mock 200ms delay
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 250));
  await tester.pump();
}

void main() {
  testWidgets('smoke: 真实 buildRouter() 能解析 /strategy/:id 到 StrategyDetailPage',
      (WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(420, 1400));
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final GoRouter router = buildRouter();
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          sharedPreferencesProvider.overrideWithValue(prefs),
        ],
        child: MaterialApp.router(
          locale: const Locale('zh'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          theme: buildQzThemeData(
            const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
          ),
          routerConfig: router,
        ),
      ),
    );
    await tester.pump();
    router.go('/strategy/st-grid-btc');
    await tester.pump();
    // detail + signals 200ms / reviews 150ms / equity 120ms
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump();
    expect(find.byType(StrategyDetailPage), findsOneWidget);
    // 渲染出真实策略名 = 占位页已被替换
    expect(find.text('BTC 网格搬砖'), findsOneWidget);
  });

  testWidgets('默认渲染：初始页加载至少 10 张卡片，fixture ≥ 20',
      (WidgetTester tester) async {
    expect(mockFeaturedStrategies.length, greaterThanOrEqualTo(20));
    await _pump(tester);
    // 默认 pageSize=10；hero 卡命中的策略会在列表里去重，所以列表 StrategyCardTile
    // 可能是 9 或 10（取决于 hero 是否在首页结果集中）。
    final int tiles = tester.widgetList(find.byType(StrategyCardTile)).length;
    expect(tiles, greaterThanOrEqualTo(9));
    expect(tiles, lessThanOrEqualTo(10));
  });

  testWidgets('默认 category=all 且无 query：渲染 featured hero 卡 (#1565)',
      (WidgetTester tester) async {
    await _pump(tester);
    expect(find.byKey(const Key('strategy-featured-hero')), findsOneWidget);
    expect(find.byType(FeaturedHeroCard), findsOneWidget);
  });

  testWidgets('排序行：4 个排序 chip + 结果计数 (#1565)',
      (WidgetTester tester) async {
    await _pump(tester);
    expect(find.byKey(const Key('strategy-sort-hot')), findsOneWidget);
    expect(find.byKey(const Key('strategy-sort-cagr')), findsOneWidget);
    expect(find.byKey(const Key('strategy-sort-sharpe')), findsOneWidget);
    expect(find.byKey(const Key('strategy-sort-mddLow')), findsOneWidget);
    // 默认 hot 选中：tap cagr 切换不抛
    await tester.tap(find.byKey(const Key('strategy-sort-cagr')));
    await tester.pump();
    expect(tester.takeException(), isNull);
  });

  testWidgets('筛选 sheet：点击右上 icon 弹出底部 sheet (#1565)',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('strategy-filter-btn')));
    await tester.pumpAndSettle();
    // sheet 内 4 个分类 + 4 个排序 + apply 按钮
    expect(find.byKey(const Key('strategy-sheet-cat-all')), findsOneWidget);
    expect(find.byKey(const Key('strategy-sheet-sort-hot')), findsOneWidget);
    expect(find.byKey(const Key('strategy-sheet-apply-btn')), findsOneWidget);
  });

  testWidgets('星标按钮：点击切换收藏状态 (#1565)',
      (WidgetTester tester) async {
    await _pump(tester);
    final String firstId = mockFeaturedStrategies.first.id;
    final Finder star = find.byKey(Key('strategy-star-$firstId'));
    expect(star, findsOneWidget);
    await tester.tap(star);
    await tester.pump();
    await tester.pump();
    expect(tester.takeException(), isNull);
  });

  testWidgets('切换 "高收益" chip：筛选只剩 highReturn 类',
      (WidgetTester tester) async {
    await _pump(tester);
    final StrategyCard nonHighReturn = mockFeaturedStrategies
        .firstWhere((StrategyCard s) =>
            s.category != StrategyCategory.highReturn);
    // 默认全部时，非 highReturn 项可能在前 10 内（取决于顺序）
    await tester.tap(find.byKey(const Key('strategy-chip-highReturn')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    // 切换后非 highReturn 名字应消失
    expect(find.text(nonHighReturn.name), findsNothing);
    // highReturn 至少存在 1 张
    final StrategyCard highReturnFirst = mockFeaturedStrategies
        .firstWhere(
            (StrategyCard s) => s.category == StrategyCategory.highReturn);
    expect(find.text(highReturnFirst.name), findsOneWidget);
  });

  testWidgets('搜索：输入作者名子串过滤生效', (WidgetTester tester) async {
    await _pump(tester);
    // "Alpha Hunter" 在 fixture 中存在
    await tester.enterText(find.byType(TextField), 'Alpha');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    // 至少一条 Alpha Hunter 出品的卡片可见
    expect(find.text('Alpha Hunter'), findsWidgets);
    // 不含 Alpha 的某条应被过滤（"BTC 网格搬砖" 作者是 "量化老王"）
    expect(find.text('BTC 网格搬砖'), findsNothing);
  });

  testWidgets('下拉刷新：触发 RefreshIndicator → loading 显示',
      (WidgetTester tester) async {
    await _pump(tester);
    // fling 触发 pull-to-refresh
    await tester.fling(
      find.byType(StrategyCardTile).first,
      const Offset(0, 400),
      1000,
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.byType(RefreshProgressIndicator), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle(const Duration(milliseconds: 500));
    // 刷新完成 indicator 消失
    expect(find.byType(RefreshProgressIndicator), findsNothing);
    // 列表仍渲染
    expect(find.byType(StrategyCardTile), findsAtLeast(1));
  });

  testWidgets('点击卡片：push 到 /strategy/:id 详情页',
      (WidgetTester tester) async {
    await _pump(tester);
    final StrategyCard first = mockFeaturedStrategies.first;
    await tester.tap(find.byKey(Key('strategy-tile-${first.id}')));
    // pumpAndSettle 受 mock 200ms delay + 渲染影响：手动驱动多轮 future
    // detail+signals 200ms / reviews 150ms / equity 120ms
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump();
    expect(find.byType(StrategyDetailPage), findsOneWidget);
    // 详情页 AppBar 标题 + 真实策略名同时存在
    expect(find.text('策略详情'), findsOneWidget);
    expect(find.text(first.name), findsOneWidget);
  });

  testWidgets('9 主题循环 pump 不抛异常（验收 #5）',
      (WidgetTester tester) async {
    for (final QzBg bg in QzBg.values) {
      for (final QzAccent accent in QzAccent.values) {
        await _pump(tester, theme: QzTheme(bg: bg, accent: accent));
        expect(find.byType(StrategyCardTile), findsAtLeast(1),
            reason: 'theme bg=$bg accent=$accent');
        expect(tester.takeException(), isNull,
            reason: 'theme bg=$bg accent=$accent should pump without exception');
      }
    }
  });

  testWidgets('上拉加载：滚到底部触发分页，itemCount 增加',
      (WidgetTester tester) async {
    // 这条用例需要 viewport 比内容小才能产生 scroll；不走 _pump 的高 surface。
    await tester.binding.setSurfaceSize(const Size(420, 800));
    final GoRouter router = GoRouter(
      initialLocation: '/strategy',
      routes: <RouteBase>[
        GoRoute(
          path: '/strategy',
          builder: (BuildContext context, GoRouterState state) =>
              const StrategyHomePage(),
        ),
        GoRoute(
          path: '/strategy/:id',
          builder: (BuildContext context, GoRouterState s) =>
              StrategyDetailPage(id: s.pathParameters['id']!),
        ),
      ],
    );
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final SharedPreferences prefs2 = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          sharedPreferencesProvider.overrideWithValue(prefs2),
        ],
        child: MaterialApp.router(
          locale: const Locale('zh'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          theme: buildQzThemeData(
            const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
          ),
          routerConfig: router,
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump();

    final String id22 = mockFeaturedStrategies.last.id;
    // 默认排序按 hot（users 降序）—— fixture 末条（subscribers 较小）一定不在
    // 首页 10 条，必须 loadMore 才会出现。
    final Finder mainList = find.descendant(
      of: find.byType(RefreshIndicator),
      matching: find.byType(Scrollable),
    );
    expect(mainList, findsOneWidget,
        reason: '主列表 Scrollable 应能唯一定位');
    await tester.scrollUntilVisible(
      find.byKey(Key('strategy-tile-$id22')),
      300,
      scrollable: mainList,
      duration: const Duration(milliseconds: 100),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(Key('strategy-tile-$id22')), findsOneWidget,
        reason: '上拉到底应触发 loadMore，末条卡片应可见');
  });
}
