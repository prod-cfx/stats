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
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

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
    expect(find.text('发现'), findsOneWidget);
    expect(find.text('实时'), findsOneWidget);
    expect(find.text('持仓'), findsOneWidget);
    expect(find.text('监控'), findsOneWidget);
  });

  testWidgets('默认进入实时 tab，可见净流入卡片',
      (WidgetTester tester) async {
    await _pump(tester);
    // hero 卡 label：来自 whaleNetFlowLabel("BTC 净流入 · 1H")
    expect(find.textContaining('净流入'), findsWidgets);
    // 3 格统计
    expect(find.text('大额交易'), findsOneWidget);
    expect(find.text('活跃巨鲸'), findsOneWidget);
    expect(find.text('净增持'), findsOneWidget);
  });

  testWidgets('切到「发现」tab → 聪明钱榜 section 出现',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.text('发现'));
    await tester.pumpAndSettle();
    expect(find.text('聪明钱榜'), findsOneWidget);
    expect(find.text('趋势资产'), findsOneWidget);
    expect(find.text('新晋巨鲸'), findsOneWidget);
  });

  testWidgets('切到「持仓」tab → 交易所余额 section 出现',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.text('持仓'));
    await tester.pumpAndSettle();
    expect(find.text('交易所 BTC 余额'), findsOneWidget);
    expect(find.text('头部地址持仓'), findsOneWidget);
    expect(find.text('Binance'), findsOneWidget);
  });

  testWidgets('切到「监控」tab → 我的监控 + 添加 CTA + 最近告警',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.text('监控'));
    await tester.pumpAndSettle();
    expect(find.text('我的监控'), findsOneWidget);
    expect(find.text('添加地址监控'), findsOneWidget);
    expect(find.text('最近告警'), findsOneWidget);
  });

  testWidgets(
      '监控 tab「添加地址监控」按钮禁用 (onPressed=null)，对齐设计稿无 onClick',
      (WidgetTester tester) async {
    // issue #1663：能力未落地前按钮应明示禁用，避免空 lambda 的 ripple
    // 暗示可点。
    await _pump(tester);
    await tester.tap(find.text('监控'));
    await tester.pumpAndSettle();
    final Finder ctaText = find.text('添加地址监控');
    expect(ctaText, findsOneWidget);
    final OutlinedButton cta = tester.widget<OutlinedButton>(
      find.ancestor(of: ctaText, matching: find.byType(OutlinedButton)).first,
    );
    expect(cta.onPressed, isNull,
        reason: '添加地址监控能力未实现前按钮应禁用');
  });

  testWidgets('默认进入「实时」tab：tab 高亮 + 实时内容可见',
      (WidgetTester tester) async {
    // issue #1663 守护：设计稿 ScreenWhale 默认 tab='实时'，Flutter
    // _tabIndex=1，必须有测试断言避免后续回归。
    await _pump(tester);
    // 「实时」tab Text 颜色应为高亮（fontWeight=w700）。tab 实现：
    // _SubTab 选中态 fontWeight w700，未选中 w500。
    final Finder liveTabText = find.text('实时');
    expect(liveTabText, findsOneWidget);
    final Text liveText = tester.widget<Text>(liveTabText);
    expect(liveText.style?.fontWeight, FontWeight.w700,
        reason: '默认 tab 应为「实时」，文案应高亮 w700');
    // 「发现」未选中应为 w500
    final Text discoverText = tester.widget<Text>(find.text('发现'));
    expect(discoverText.style?.fontWeight, FontWeight.w500);
  });

  testWidgets('右上铃铛存在且显示初始未读数 badge',
      (WidgetTester tester) async {
    await _pump(tester);
    final int expectedUnread = mockWhaleNotifications
        .where((w) => w.unread)
        .length;
    expect(expectedUnread, greaterThan(0),
        reason: 'fixture 至少包含 1 条未读');
    // badge 文字 = unread 数
    expect(find.text('$expectedUnread'), findsWidgets);
    expect(find.byIcon(Icons.notifications_outlined), findsOneWidget);
  });

  testWidgets(
      '顶部 action 含搜索 icon + 36x36 圆形铃铛（对齐设计稿 iconBtn）',
      (WidgetTester tester) async {
    await _pump(tester);

    // 搜索 icon 渲染（设计稿 iconBtn 风格）。
    expect(find.byIcon(Icons.search), findsOneWidget);

    // issue #1651：搜索能力尚未落地，按钮应为禁用态（onPressed=null），
    // 避免出现空 onTap 的误导点击。
    final Finder searchIcon = find.byIcon(Icons.search);
    final IconButton searchButton = tester.widget<IconButton>(
      find.ancestor(of: searchIcon, matching: find.byType(IconButton)).first,
    );
    expect(searchButton.onPressed, isNull,
        reason: '搜索按钮未实现前应禁用，避免空点击');

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
    // 防御：unreadBefore 可能也出现在其他地方，因此只断言铃铛旁不再有 'unreadBefore'
    // 文字位置。简单做法：找到 notifications_outlined icon 后兄弟里没有 unreadBefore。
    expect(find.text('$unreadBefore'), findsNothing,
        reason: '全部已读后 badge 数字应消失');
  });
}
