import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
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
import 'package:quantify_mobile/widgets/qz_avatar.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 简化测试用 router（**故意不含 shell**）：仅验证 `/strategy` 与
/// `/strategy/:id` 两个 builder 命中，不验证 shell 覆盖语义（那个由
/// smoke test 用真实 `buildRouter()` 校验）。
Future<void> _pump(
  WidgetTester tester, {
  QzTheme? theme,
  List<String> favorites = const <String>[],
}) async {
  // 用足够高的 surface 让 ListView.builder 一次性建出整页卡片，
  // 避免 viewport 截断使 widget count 少于 pageSize。
  await tester.binding.setSurfaceSize(const Size(420, 4200));
  SharedPreferences.setMockInitialValues(<String, Object>{
    if (favorites.isNotEmpty) 'qz.strategy.favorites': favorites,
  });
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
      GoRoute(
        path: '/ai',
        builder: (BuildContext context, GoRouterState s) => const Scaffold(
          body: Center(child: Text('ai-stub')),
        ),
      ),
      GoRoute(
        path: '/me/live',
        builder: (BuildContext context, GoRouterState s) => const Scaffold(
          body: Center(child: Text('live-stub')),
        ),
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

/// 经搜索 overlay 提交一个自由文本查询，回到广场后查询已应用（#1824）。
///
/// 流程：tap 顶栏搜索按钮 → overlay 输入框 enterText → 键盘 search 提交 →
/// overlay pop + `onApplyQuery` 回调 → 广场 `_reload`。
Future<void> _applySearch(WidgetTester tester, String term) async {
  await tester.tap(find.byKey(const Key('strategy-search-btn')));
  await tester.pumpAndSettle();
  await tester.enterText(find.byKey(const Key('strategy-search-input')), term);
  await tester.pump();
  await tester.testTextInput.receiveAction(TextInputAction.search);
  await tester.pumpAndSettle();
  // 广场重新拉取（mock 200ms）
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

  testWidgets('搜索有关键词时：hero 隐藏 (#1593 / #1824)',
      (WidgetTester tester) async {
    await _pump(tester);
    // 先确认默认渲染 hero
    expect(find.byKey(const Key('strategy-featured-hero')), findsOneWidget);
    // 经搜索 overlay 提交关键词后 hero 应消失
    await _applySearch(tester, 'Alpha');
    expect(find.byKey(const Key('strategy-featured-hero')), findsNothing);
    expect(find.byType(FeaturedHeroCard), findsNothing);
  });

  testWidgets('顶栏搜索按钮：应用 query 后呈激活态（红点）(#1824)',
      (WidgetTester tester) async {
    await _pump(tester);
    // 初始无 query：无红点 badge
    expect(find.byKey(const Key('strategy-search-btn-dot')), findsNothing);
    await _applySearch(tester, 'Alpha');
    // 应用 query 后激活态红点出现
    expect(find.byKey(const Key('strategy-search-btn-dot')), findsOneWidget);
  });

  testWidgets('分类切到 trend：hero 隐藏 (#1593 / #1594)',
      (WidgetTester tester) async {
    await _pump(tester);
    expect(find.byKey(const Key('strategy-featured-hero')), findsOneWidget);
    await tester.tap(find.byKey(const Key('strategy-chip-trend')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.byKey(const Key('strategy-featured-hero')), findsNothing);
    expect(find.byType(FeaturedHeroCard), findsNothing);
  });

  testWidgets('点击 hero 卡：push 到 /strategy/:id 详情页 (#1593)',
      (WidgetTester tester) async {
    await _pump(tester);
    final Finder hero = find.byKey(const Key('strategy-featured-hero'));
    expect(hero, findsOneWidget);
    await tester.tap(hero);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump();
    expect(find.byType(StrategyDetailPage), findsOneWidget);
  });

  testWidgets('顶部栏：策略广场 + 副标题 + 筛选按钮 + 7 个分类 chip (#1594)',
      (WidgetTester tester) async {
    await _pump(tester);
    // 标题 + 副标题
    expect(find.text('策略广场'), findsOneWidget);
    expect(find.text('精选策略 · 一键载入对话'), findsOneWidget);
    // 右上搜索 + 筛选按钮
    expect(find.byKey(const Key('strategy-search-btn')), findsOneWidget);
    expect(find.byKey(const Key('strategy-filter-btn')), findsOneWidget);
    expect(
      find.descendant(
        of: find.byKey(const Key('strategy-filter-btn')),
        matching: find.byIcon(Icons.tune),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byKey(const Key('strategy-filter-btn')),
        matching: find.byIcon(Icons.filter_alt),
      ),
      findsNothing,
    );
    // 7 个分类 chip key
    expect(find.byKey(const Key('strategy-chip-all')), findsOneWidget);
    expect(find.byKey(const Key('strategy-chip-trend')), findsOneWidget);
    expect(find.byKey(const Key('strategy-chip-grid')), findsOneWidget);
    expect(find.byKey(const Key('strategy-chip-arbitrage')), findsOneWidget);
    expect(find.byKey(const Key('strategy-chip-reversal')), findsOneWidget);
    expect(find.byKey(const Key('strategy-chip-hedge')), findsOneWidget);
    expect(find.byKey(const Key('strategy-chip-highFreq')), findsOneWidget);
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

  testWidgets('排序行：选中项尾部展示向下箭头，未选中无箭头 (#1823)',
      (WidgetTester tester) async {
    await _pump(tester);
    // 默认 hot 选中：其 chip 内含向下箭头
    expect(
      find.descendant(
        of: find.byKey(const Key('strategy-sort-hot')),
        matching: find.byIcon(Icons.keyboard_arrow_down),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byKey(const Key('strategy-sort-hot')),
        matching: find.byWidgetPredicate(
          (Widget w) => w is SizedBox && w.height == 24,
        ),
      ),
      findsOneWidget,
    );
    final Container hotContainer = tester.widget<Container>(
      find.descendant(
        of: find.byKey(const Key('strategy-sort-hot')),
        matching: find.byWidgetPredicate(
          (Widget w) => w is Container && w.decoration is BoxDecoration,
        ),
      ),
    );
    expect(
      hotContainer.padding,
      const EdgeInsets.symmetric(horizontal: 10),
    );
    final Icon hotArrow = tester.widget<Icon>(
      find.descendant(
        of: find.byKey(const Key('strategy-sort-hot')),
        matching: find.byIcon(Icons.keyboard_arrow_down),
      ),
    );
    expect(hotArrow.size, 10);
    // 未选中 cagr：无箭头
    expect(
      find.descendant(
        of: find.byKey(const Key('strategy-sort-cagr')),
        matching: find.byIcon(Icons.keyboard_arrow_down),
      ),
      findsNothing,
    );
    // 切到 cagr 后箭头随选中态迁移
    await tester.tap(find.byKey(const Key('strategy-sort-cagr')));
    await tester.pump();
    expect(
      find.descendant(
        of: find.byKey(const Key('strategy-sort-cagr')),
        matching: find.byIcon(Icons.keyboard_arrow_down),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byKey(const Key('strategy-sort-hot')),
        matching: find.byIcon(Icons.keyboard_arrow_down),
      ),
      findsNothing,
    );
  });

  testWidgets('featured hero：副标题含作者 + 带箭头胶囊「查看详情」(#1823)',
      (WidgetTester tester) async {
    await _pump(tester);
    final Finder hero = find.byKey(const Key('strategy-featured-hero'));
    expect(hero, findsOneWidget);
    // 副标题结构「作者 · 市场中性 · 低回撤」
    expect(
      find.descendant(
        of: hero,
        matching: find.textContaining('· 市场中性 · 低回撤'),
      ),
      findsOneWidget,
    );
    // 「查看详情」胶囊按钮带 forward 箭头
    expect(
      find.descendant(of: hero, matching: find.text('查看详情')),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: hero,
        matching: find.byIcon(Icons.arrow_forward),
      ),
      findsOneWidget,
    );
  });

  testWidgets('featured hero：badge 带 ★ 前缀且无指标行 (#1885)',
      (WidgetTester tester) async {
    await _pump(tester);
    final Finder hero = find.byKey(const Key('strategy-featured-hero'));
    expect(hero, findsOneWidget);
    // badge 含 ★ 前缀 + 本周推荐文案
    expect(
      find.descendant(of: hero, matching: find.text('★')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: hero, matching: find.text('本周推荐')),
      findsOneWidget,
    );
    // 删除指标行后 hero 内不出现 CAGR / Sharpe / 回撤 标签
    expect(
      find.descendant(of: hero, matching: find.text('CAGR')),
      findsNothing,
    );
    expect(
      find.descendant(of: hero, matching: find.text('Sharpe')),
      findsNothing,
    );
    expect(
      find.descendant(of: hero, matching: find.text('回撤')),
      findsNothing,
    );
  });

  testWidgets('featured hero：标题左侧渲染 36 币种符号头像 (#1903)',
      (WidgetTester tester) async {
    await _pump(tester);
    final Finder hero = find.byKey(const Key('strategy-featured-hero'));
    expect(hero, findsOneWidget);

    final StrategyCard featured = mockFeaturedStrategies.firstWhere(
      (StrategyCard c) => c.status == StrategyStatusBadge.official,
      orElse: () => mockFeaturedStrategies.first,
    );
    final Finder avatarFinder = find.descendant(
      of: hero,
      matching: find.byType(QzAvatar),
    );
    expect(avatarFinder, findsOneWidget);

    final QzAvatar avatar = tester.widget<QzAvatar>(avatarFinder);
    expect(avatar.label, featured.symbol);
    expect(avatar.size, 36);
    expect(avatar.monospace, isTrue);
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
    final QzColorScheme scheme = qzColors(QzBg.light, QzAccent.violet);
    final BoxDecoration catDecoration = tester
        .widget<DecoratedBox>(
          find.descendant(
            of: find.byKey(const Key('strategy-sheet-cat-all')),
            matching: find.byWidgetPredicate(
              (Widget w) => w is DecoratedBox && w.decoration is BoxDecoration,
            ),
          ),
        )
        .decoration as BoxDecoration;
    expect(catDecoration.color, scheme.accent);
    expect(
      tester.getSize(find.byKey(const Key('strategy-sheet-cat-all'))).width,
      lessThan(90),
    );
    expect(
      tester
          .widget<Text>(
            find.descendant(
              of: find.byKey(const Key('strategy-sheet-cat-all')),
              matching: find.text('全部'),
            ),
          )
          .style
          ?.color,
      scheme.accentOn,
    );
    final BoxDecoration sortDecoration = tester
        .widget<Container>(
          find.descendant(
            of: find.byKey(const Key('strategy-sheet-sort-hot')),
            matching: find.byWidgetPredicate(
              (Widget w) => w is Container && w.decoration is BoxDecoration,
            ),
          ),
        )
        .decoration! as BoxDecoration;
    expect(sortDecoration.color, scheme.accentSoft);
    expect(
      tester
          .widget<Text>(
            find.descendant(
              of: find.byKey(const Key('strategy-sheet-sort-hot')),
              matching: find.text('按 热门 排序'),
            ),
          )
          .style
          ?.color,
      scheme.accent,
    );
    final Finder applyDecoration = find.ancestor(
      of: find.byKey(const Key('strategy-sheet-apply-btn')),
      matching: find.byWidgetPredicate((Widget w) {
        if (w is! Container) return false;
        final Decoration? decoration = w.decoration;
        if (decoration is! BoxDecoration) return false;
        final List<BoxShadow> shadows = decoration.boxShadow ?? <BoxShadow>[];
        return decoration.gradient is LinearGradient &&
            decoration.borderRadius == BorderRadius.circular(12) &&
            shadows.any(
              (BoxShadow s) =>
                  s.color == const Color(0x527C5CFF) &&
                  s.blurRadius == 20 &&
                  s.offset == const Offset(0, 6),
            );
      }),
    );
    expect(applyDecoration, findsOneWidget);
    // 排序选项文案对齐设计稿「按 {label} 排序」（#1888）
    expect(find.text('按 热门 排序'), findsOneWidget);
    expect(find.text('按 低回撤 排序'), findsOneWidget);

    // #2128：点排序即时生效——sheet 仍打开时排序行已切到 sharpe（active 箭头）。
    await tester.tap(find.byKey(const Key('strategy-sheet-sort-sharpe')));
    await tester.pump();
    expect(find.byKey(const Key('strategy-sheet-apply-btn')), findsOneWidget);
    expect(
      find.descendant(
        of: find.byKey(const Key('strategy-sort-sharpe')),
        matching: find.byIcon(Icons.keyboard_arrow_down),
      ),
      findsOneWidget,
    );
    // 「查看 N 个结果」只负责关闭 sheet，不再是唯一提交入口。
    await tester.tap(find.byKey(const Key('strategy-sheet-apply-btn')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('strategy-sheet-apply-btn')), findsNothing);
    expect(
      find.descendant(
        of: find.byKey(const Key('strategy-sort-sharpe')),
        matching: find.byIcon(Icons.keyboard_arrow_down),
      ),
      findsOneWidget,
    );
  });

  testWidgets('筛选 sheet：点类型即时筛选列表 + 结果数实时联动 (#2128)',
      (WidgetTester tester) async {
    await _pump(tester);
    final StrategyCard nonTrend = mockFeaturedStrategies.firstWhere(
      (StrategyCard s) => s.category != StrategyCategory.trend,
    );

    await tester.tap(find.byKey(const Key('strategy-filter-btn')));
    await tester.pumpAndSettle();

    // 「查看 N 个结果」文案携带实时计数（来自父页面 ValueListenable，非静态快照）。
    int sheetCount() => int.parse(
          RegExp(r'\d+')
              .firstMatch(
                tester
                    .widget<Text>(
                      find.descendant(
                        of: find.byKey(const Key('strategy-sheet-apply-btn')),
                        matching: find.byType(Text),
                      ),
                    )
                    .data!,
              )!
              .group(0)!,
        );
    expect(sheetCount(), greaterThan(0));

    // 点 sheet 内「趋势」类型 chip：底层列表即时收敛、sheet 不关闭。
    await tester.tap(find.byKey(const Key('strategy-sheet-cat-trend')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.byKey(const Key('strategy-sheet-apply-btn')), findsOneWidget);
    // 切换后 sheet 计数仍有效（实时跟随当前筛选，未停留在打开时的值）。
    expect(sheetCount(), greaterThan(0));

    // 关闭 sheet 后底层列表确实只剩 trend 类，证明点类型即时改了页面筛选。
    await tester.tap(find.byKey(const Key('strategy-sheet-apply-btn')));
    await tester.pumpAndSettle();
    expect(find.text(nonTrend.name), findsNothing);
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

  testWidgets('切换 "趋势" chip：筛选只剩 trend 类 (#1594)',
      (WidgetTester tester) async {
    await _pump(tester);
    final StrategyCard nonTrend = mockFeaturedStrategies
        .firstWhere((StrategyCard s) =>
            s.category != StrategyCategory.trend);
    await tester.tap(find.byKey(const Key('strategy-chip-trend')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    // 切换后非 trend 名字应消失
    expect(find.text(nonTrend.name), findsNothing);
    // trend 至少存在 1 张
    final StrategyCard trendFirst = mockFeaturedStrategies
        .firstWhere(
            (StrategyCard s) => s.category == StrategyCategory.trend);
    expect(find.text(trendFirst.name), findsOneWidget);
  });

  testWidgets('搜索：经 overlay 提交作者名子串过滤生效 (#1824)',
      (WidgetTester tester) async {
    await _pump(tester);
    // "Alpha Hunter" 在 fixture 中存在
    await _applySearch(tester, 'Alpha');
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
    // #1829 详情页重构为 bottom-sheet 后移除「策略详情」AppBar 标题，
    // 以真实策略名作为导航落地断言。
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

  testWidgets('点击载入对话：先显示 toast，再约 700ms 后跳转到 /ai?loadStrategy= (#1596)',
      (WidgetTester tester) async {
    await _pump(tester);
    final StrategyCard first = mockFeaturedStrategies.first;
    final Finder loadBtn =
        find.byKey(Key('strategy-card-load-chat-${first.id}'));
    expect(loadBtn, findsOneWidget);
    await tester.tap(loadBtn);
    // 先 pump 一帧，让 setState 生效但不让 700ms timer 触发
    await tester.pump();
    expect(
      find.byKey(const Key('strategy-load-conversation-toast')),
      findsOneWidget,
      reason: 'toast 应在点击后立即显示',
    );
    expect(find.text('「${first.name}」已载入对话'), findsOneWidget);
    // 600ms 时还不应跳走（界面仍在 StrategyHomePage）
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.byType(StrategyHomePage), findsOneWidget,
        reason: '未到 700ms 时不应跳转');
    // 推过 700ms 阈值 + buffer，到达 /ai
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pumpAndSettle(const Duration(milliseconds: 300));
    expect(find.text('ai-stub'), findsOneWidget,
        reason: '700ms 后应跳到 /ai 路由');
  });

  testWidgets('卡片同时存在「载入对话」「运行」双按钮 (#1821 验收)',
      (WidgetTester tester) async {
    await _pump(tester);
    final StrategyCard first = mockFeaturedStrategies.first;
    expect(find.byKey(Key('strategy-card-load-chat-${first.id}')),
        findsOneWidget);
    expect(
        find.byKey(Key('strategy-card-run-${first.id}')), findsOneWidget);
  });

  testWidgets('点击运行：显示已启动 toast，约 700ms 后跳转 /me/live (#1821 验收)',
      (WidgetTester tester) async {
    await _pump(tester);
    final StrategyCard first = mockFeaturedStrategies.first;
    final Finder runBtn = find.byKey(Key('strategy-card-run-${first.id}'));
    expect(runBtn, findsOneWidget);
    await tester.tap(runBtn);
    await tester.pump();
    expect(find.text('「${first.name}」已启动 · 进入实盘监控'), findsOneWidget,
        reason: 'toast 应在点击后立即显示');
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.byType(StrategyHomePage), findsOneWidget,
        reason: '未到 700ms 时不应跳转');
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pumpAndSettle(const Duration(milliseconds: 300));
    expect(find.text('live-stub'), findsOneWidget,
        reason: '700ms 后应跳到实盘监控 /me/live');
  });

  testWidgets('点击运行不触发卡片整体打开详情（事件不冒泡, #1821 验收）',
      (WidgetTester tester) async {
    await _pump(tester);
    final StrategyCard first = mockFeaturedStrategies.first;
    await tester.tap(find.byKey(Key('strategy-card-run-${first.id}')));
    await tester.pump();
    expect(find.byType(StrategyDetailPage), findsNothing,
        reason: '运行按钮点击不应冒泡到卡片 onTap 打开详情');
    expect(find.text('「${first.name}」已启动 · 进入实盘监控'), findsOneWidget);
  });

  testWidgets('载入对话点击后立刻 pop 路由：dispose 不抛 setState after dispose (#1596)',
      (WidgetTester tester) async {
    await _pump(tester);
    final StrategyCard first = mockFeaturedStrategies.first;
    await tester
        .tap(find.byKey(Key('strategy-card-load-chat-${first.id}')));
    await tester.pump(); // toast 显示
    expect(find.byKey(const Key('strategy-load-conversation-toast')),
        findsOneWidget);
    // 立即跳走原页面：换一个空 widget 模拟 dispose
    await tester.pumpWidget(const MaterialApp(home: SizedBox.shrink()));
    // 等过 toast (2.4s) + nav timer 触发：dispose 后回调中 mounted 检查应阻止 setState
    await tester.pump(const Duration(milliseconds: 800));
    await tester.pump(const Duration(seconds: 2));
    expect(tester.takeException(), isNull,
        reason: 'dispose 后的 toast/nav timer 不应抛异常');
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

  // ───────────────────────── #1822 收藏筛选视图 ─────────────────────────

  testWidgets('分类行头部存在「收藏」toggle (#1822 验收 1)',
      (WidgetTester tester) async {
    await _pump(tester);
    expect(find.byKey(const Key('strategy-fav-toggle')), findsOneWidget);
  });

  testWidgets('开启「收藏」后列表仅显示已星标策略 (#1822 验收 2)',
      (WidgetTester tester) async {
    final String favId = mockFeaturedStrategies.first.id;
    final String otherName = mockFeaturedStrategies
        .firstWhere((StrategyCard s) => s.id != favId)
        .name;
    await _pump(tester, favorites: <String>[favId]);
    await tester.tap(find.byKey(const Key('strategy-fav-toggle')));
    await tester.pump();
    await tester.pump();
    // 收藏视图仅有这一张已星标卡。
    expect(find.byKey(Key('strategy-tile-$favId')), findsOneWidget);
    expect(find.text(otherName), findsNothing);
    expect(tester.widgetList(find.byType(StrategyCardTile)).length, 1);
  });

  testWidgets('收藏视图与分类互斥：开收藏 hero 隐藏 (#1822 验收 5)',
      (WidgetTester tester) async {
    final String favId = mockFeaturedStrategies.first.id;
    await _pump(tester, favorites: <String>[favId]);
    expect(find.byKey(const Key('strategy-featured-hero')), findsOneWidget);
    await tester.tap(find.byKey(const Key('strategy-fav-toggle')));
    await tester.pump();
    await tester.pump();
    expect(find.byKey(const Key('strategy-featured-hero')), findsNothing);
  });

  testWidgets('收藏为空时显示专属空态 + CTA (#1822 验收 3)',
      (WidgetTester tester) async {
    await _pump(tester); // 无收藏
    await tester.tap(find.byKey(const Key('strategy-fav-toggle')));
    await tester.pump();
    await tester.pump();
    expect(find.byKey(const Key('strategy-fav-empty')), findsOneWidget);
    expect(find.byKey(const Key('strategy-fav-empty-cta')), findsOneWidget);
    expect(find.text('还没有收藏的策略'), findsOneWidget);
  });

  testWidgets('点击「去策略广场看看」回到全部策略视图 (#1822 验收 4)',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('strategy-fav-toggle')));
    await tester.pump();
    await tester.pump();
    await tester.tap(find.byKey(const Key('strategy-fav-empty-cta')));
    await tester.pump();
    await tester.pump();
    // 退出收藏视图：空态消失，卡片重新出现。
    expect(find.byKey(const Key('strategy-fav-empty')), findsNothing);
    expect(find.byType(StrategyCardTile), findsWidgets);
  });

  testWidgets('选分类自动退出收藏视图 (#1822 验收 5 互斥)',
      (WidgetTester tester) async {
    final String favId = mockFeaturedStrategies.first.id;
    await _pump(tester, favorites: <String>[favId]);
    await tester.tap(find.byKey(const Key('strategy-fav-toggle')));
    await tester.pump();
    await tester.pump();
    expect(find.byType(StrategyCardTile), findsOneWidget);
    // 切到分类应退出收藏视图，恢复按分类过滤的多张卡。
    await tester.tap(find.byKey(const Key('strategy-chip-all')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.byType(StrategyCardTile), findsWidgets);
  });
}
