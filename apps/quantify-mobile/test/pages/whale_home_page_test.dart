import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/mock/fixtures/whale_events.dart';
import 'package:quantify_mobile/data/mock/fixtures/whale_extras.dart';
import 'package:quantify_mobile/data/models/whale_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/whale_feed_repository.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/whale/whale_home_page.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_notification_sheet.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_sort_bar.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/widgets/qz_notification_bell.dart';

class _FakeWhaleFeedRepository implements WhaleFeedRepository {
  _FakeWhaleFeedRepository({List<WhaleEvent>? history})
      : _history = history ?? mockWhaleEvents.reversed.toList();

  final List<WhaleEvent> _history;
  final StreamController<WhaleEvent> _controller =
      StreamController<WhaleEvent>.broadcast();

  Future<void> dispose() async => _controller.close();

  @override
  Future<List<WhaleEvent>> listRecent({required int limit}) async {
    final int take = limit > _history.length ? _history.length : limit;
    return _history.sublist(0, take);
  }

  @override
  Stream<WhaleEvent> watchFeed() => _controller.stream;
}

Future<void> _pump(WidgetTester tester) async {
  await tester.binding.setSurfaceSize(const Size(420, 3000));
  final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository();
  addTearDown(() async => repo.dispose());
  final GoRouter router = GoRouter(
    initialLocation: '/whale',
    routes: <RouteBase>[
      GoRoute(
        path: '/whale',
        builder: (BuildContext context, GoRouterState state) =>
            const WhaleHomePage(),
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        whaleFeedRepositoryProvider.overrideWithValue(repo),
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
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pump(const Duration(milliseconds: 50));
}

void main() {
  testWidgets('WhaleHomePage 渲染 4 个二级 tab label',
      (WidgetTester tester) async {
    await _pump(tester);
    // 子 tab label 在 tab 栏内（按 key 定位，避开默认「发现」tab body
    // 中同名文案的干扰）。
    expect(
      find.descendant(
        of: find.byKey(const Key('whaleSubTab_0')),
        matching: find.text('发现'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byKey(const Key('whaleSubTab_1')),
        matching: find.text('实时'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byKey(const Key('whaleSubTab_2')),
        matching: find.text('持仓'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byKey(const Key('whaleSubTab_3')),
        matching: find.text('监控'),
      ),
      findsOneWidget,
    );
  });

  testWidgets('切到「实时」tab，可见净流入卡片',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('whaleSubTab_1')));
    await tester.pumpAndSettle();
    // hero 卡 label：来自 whaleNetFlowLabel("BTC 净流入 · 1H")
    expect(find.textContaining('净流入'), findsWidgets);
    // 3 格统计
    expect(find.text('大额交易'), findsOneWidget);
    expect(find.text('活跃巨鲸'), findsOneWidget);
    expect(find.text('净增持'), findsOneWidget);
  });

  testWidgets('默认进入「发现」tab → WhaleDiscoverNew（轮播+排序条+列表卡）出现',
      (WidgetTester tester) async {
    // issue #1789：发现 tab 重构为 top3 轮播 + 排序条 + 巨鲸列表卡。
    // issue #1976：默认 tab 改为「发现」，无需点击即应可见发现内容。
    await _pump(tester);
    await tester.pumpAndSettle();
    // 排序条三档药丸。
    expect(
      find.descendant(
        of: find.byType(WhaleSortBar),
        matching: find.text('账户总价值'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byType(WhaleSortBar),
        matching: find.text('已实现盈亏'),
      ),
      findsOneWidget,
    );
    // 列表卡 AI 标签。
    expect(find.text('金库管家'), findsWidgets);
  });

  testWidgets('切到「持仓」tab → 巨鲸持仓明细（币种 chip + 筛选 + 列表）出现',
      (WidgetTester tester) async {
    // issue #1790：持仓 tab 重构为 币种 chip + 方向/盈亏筛选 + 排序 +
    // 持仓明细卡列表（WhaleHoldingsTab），废弃旧的「交易所余额/头部地址持仓」
    // section。断言同步到现行 WhaleHoldingsTab 可见结构。
    await _pump(tester);
    await tester.tap(find.byKey(const Key('whaleSubTab_2')));
    await tester.pumpAndSettle();
    // 区段标题（whaleHoldingsSectionTitle）。
    expect(find.text('巨鲸持仓'), findsOneWidget);
    // 币种 chip 首项「全部」（whaleHoldingsCoinAll）。
    expect(find.text('全部'), findsWidgets);
    // 方向 / 盈亏 筛选药丸（whaleHoldingsFilterDir / FilterPnl）。
    expect(find.byKey(const Key('whaleHoldingsDirFilter')), findsOneWidget);
    expect(find.byKey(const Key('whaleHoldingsPnlFilter')), findsOneWidget);
  });

  testWidgets('切到「监控」tab → 三层子 Tab 分段（实时巨鲸/监控地址/通知中心）',
      (WidgetTester tester) async {
    // issue #1769：监控 tab 改为 segmented 三子 Tab。
    await _pump(tester);
    await tester.tap(find.byKey(const Key('whaleSubTab_3')));
    await tester.pumpAndSettle();
    expect(find.text('实时巨鲸'), findsOneWidget);
    expect(find.text('监控地址'), findsOneWidget);
    expect(find.text('通知中心'), findsOneWidget);
  });

  testWidgets(
      '监控 tab → 监控地址子 Tab「添加地址监控」按钮可点，打开规则表单 sheet',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('whaleSubTab_3')));
    await tester.pumpAndSettle();
    // 切到「监控地址」子 Tab。
    await tester.tap(find.text('监控地址'));
    await tester.pumpAndSettle();
    final Finder ctaButton = find.ancestor(
      of: find.text('添加地址监控'),
      matching: find.byType(OutlinedButton),
    );
    final OutlinedButton cta = tester.widget<OutlinedButton>(ctaButton.first);
    expect(cta.onPressed, isNotNull, reason: '#1754 后添加按钮应可点');
    await tester.tap(ctaButton.first);
    await tester.pumpAndSettle();
    // 规则表单 sheet 标题为「添加地址监控」。
    expect(find.text('添加地址监控'), findsWidgets);
  });

  testWidgets('默认进入「发现」tab：tab 高亮 + 发现内容可见',
      (WidgetTester tester) async {
    // issue #1976 守护：设计稿 proto.jsx 巨鲸子 tab 首项为「发现」(w-discover)，
    // Flutter _tabIndex=0，必须有测试断言避免回退到「实时」。
    await _pump(tester);
    // 「发现」tab Text 颜色应为高亮（fontWeight=w700）。tab 实现：
    // _SubTab 选中态 fontWeight w700，未选中 w500。
    final Finder discoverTabText = find.descendant(
      of: find.byKey(const Key('whaleSubTab_0')),
      matching: find.text('发现'),
    );
    expect(discoverTabText, findsOneWidget);
    final Text discoverText = tester.widget<Text>(discoverTabText);
    expect(discoverText.style?.fontWeight, FontWeight.w700,
        reason: '默认 tab 应为「发现」，文案应高亮 w700');
    // 「实时」未选中应为 w500
    final Text liveText = tester.widget<Text>(find.descendant(
      of: find.byKey(const Key('whaleSubTab_1')),
      matching: find.text('实时'),
    ));
    expect(liveText.style?.fontWeight, FontWeight.w500);
  });

  testWidgets('右上铃铛存在且显示初始未读数 badge',
      (WidgetTester tester) async {
    await _pump(tester);
    final int expectedUnread = mockWhaleNotifications
        .where((w) => w.unread)
        .length;
    expect(expectedUnread, greaterThan(0),
        reason: 'fixture 至少包含 1 条未读');
    // badge 文字 = unread 数（限定在铃铛内，避开默认「发现」tab body 同名数字）。
    expect(
      find.descendant(
        of: find.byType(QzNotificationBell),
        matching: find.text('$expectedUnread'),
      ),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.notifications_outlined), findsOneWidget);
  });

  testWidgets(
      '顶部 action 含搜索 icon + 36x36 圆形铃铛（对齐设计稿 iconBtn）',
      (WidgetTester tester) async {
    await _pump(tester);

    // 搜索 icon 渲染（设计稿 iconBtn 风格）。
    expect(find.byIcon(Icons.search), findsOneWidget);

    // issue #1754：搜索能力落地，按钮可点（解除 #1651 暂缓的禁用态）。
    final Finder searchIcon = find.byIcon(Icons.search);
    final IconButton searchButton = tester.widget<IconButton>(
      find.ancestor(of: searchIcon, matching: find.byType(IconButton)).first,
    );
    expect(searchButton.onPressed, isNotNull,
        reason: '#1754 后搜索按钮应可点');

    // 铃铛使用 36x36 SizedBox（QzNotificationBell circular=true 路径）。
    final Finder bellIcon = find.byIcon(Icons.notifications_outlined);
    expect(bellIcon, findsOneWidget);
    final SizedBox bellBox = tester.widget<SizedBox>(
      find
          .ancestor(of: bellIcon, matching: find.byType(SizedBox))
          .first,
    );
    expect(bellBox.width, 36);
    expect(bellBox.height, 36);
  });

  testWidgets('QzTopBar 应用 SafeArea 顶部 inset，标题不与状态栏重叠',
      (WidgetTester tester) async {
    // 模拟带刘海的设备：top padding = 44。
    await tester.binding.setSurfaceSize(const Size(420, 3000));
    tester.view.padding = FakeViewPadding(
      top: 44 * tester.view.devicePixelRatio,
    );
    addTearDown(() => tester.view.resetPadding());

    await _pump(tester);

    // 标题位置 y >= 44（status bar 高度），证明 SafeArea 顶部 padding 生效。
    final Offset titlePos = tester.getTopLeft(find.text('巨鲸动向'));
    expect(titlePos.dy, greaterThanOrEqualTo(44),
        reason: '标题应位于状态栏下方');
  });

  testWidgets('点击铃铛弹出通知中心 sheet，含 4 个 tab',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byIcon(Icons.notifications_outlined));
    await tester.pumpAndSettle();

    expect(find.byType(WhaleNotificationSheet), findsOneWidget);
    expect(find.text('通知中心'), findsOneWidget);
    // sheet 内 4 个 tab 应可见。tab 文案与 row 内 kind 标签共字面量，本测试
    // 仅断言「至少出现一次」；精确 tab 数（恰好 4 个 tab Container）由
    // whale_notification_sheet_test.dart 中
    // 「tabs 显示分类数量；切到「巨鲸预警」后只剩 alert kind」与
    // 「sheet 渲染恰好 4 个 _NotifTab」用例守护。
    expect(find.text('巨鲸预警'), findsAtLeastNWidgets(1));
    expect(find.text('监控触发'), findsAtLeastNWidgets(1));
    expect(find.text('系统'), findsAtLeastNWidgets(1));
    // 「全部已读」按钮存在
    expect(find.text('全部已读'), findsOneWidget);
  });

  testWidgets('点击「全部已读」后关闭 sheet，badge 消失',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byIcon(Icons.notifications_outlined));
    await tester.pumpAndSettle();

    await tester.tap(find.text('全部已读'));
    await tester.pumpAndSettle();

    // 关闭 sheet
    await tester.tap(find.byIcon(Icons.close));
    await tester.pumpAndSettle();

    // 未读 badge 消失（IconButton 仍在，只是没有红点）。
    // 我们没有直接 finder badge 容器，转而断言 badge 数字文本不再可见。
    // mock 初始未读 3 条，应该已为 0；找不到 '3' 这种 badge 文字即可。
    final int unreadBefore = mockWhaleNotifications
        .where((w) => w.unread)
        .length;
    // 限定在铃铛内断言：全部已读后铃铛 badge 数字不再渲染（unread=0 时不画 badge）。
    // 注意不能用全树 find.text('$unreadBefore')——默认「发现」tab body 可能含同名数字。
    expect(
      find.descendant(
        of: find.byType(QzNotificationBell),
        matching: find.text('$unreadBefore'),
      ),
      findsNothing,
      reason: '全部已读后 badge 数字应消失');
  });
}
