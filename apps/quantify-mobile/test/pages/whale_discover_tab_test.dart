import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/mock/fixtures/whale_leaders.dart';
import 'package:quantify_mobile/data/models/whale_leader_models.dart';
import 'package:quantify_mobile/data/models/whale_profile_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/whale_leaderboard_repository.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/whale/tabs/whale_discover_tab.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_card_controls.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_leader_card.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_sort_bar.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_top_slideshow.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_trade_stats_sheet.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

class _FakeLeaderboardRepo implements WhaleLeaderboardRepository {
  @override
  Future<List<WhaleLeaderEntry>> getLeaderboard() async => mockWhaleLeaders;
}

/// 列表卡顺序：取所有 [WhaleLeaderCard] 的地址（[WhaleLeaderEntry.id]）。
List<String> _cardOrder(WidgetTester tester) {
  return tester
      .widgetList<WhaleLeaderCard>(find.byType(WhaleLeaderCard))
      .map((WhaleLeaderCard w) => w.entry.id)
      .toList();
}

Future<void> _pump(WidgetTester tester) async {
  await tester.binding.setSurfaceSize(const Size(420, 3200));
  final GoRouter router = GoRouter(
    initialLocation: '/whale',
    routes: <RouteBase>[
      GoRoute(
        path: '/whale',
        builder: (BuildContext context, GoRouterState state) =>
            const Scaffold(body: WhaleDiscoverTab()),
      ),
      GoRoute(
        path: '/whale/profile/:address',
        builder: (BuildContext context, GoRouterState state) =>
            const Scaffold(body: Text('PROFILE')),
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        whaleLeaderboardRepositoryProvider.overrideWithValue(
          _FakeLeaderboardRepo(),
        ),
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
  await tester.pump(const Duration(milliseconds: 250));
}

void main() {
  group('排序纯函数', () {
    test('sort=null 返回原序副本，不改入参', () {
      final List<WhaleLeaderEntry> out = sortWhaleLeaders(
        mockWhaleLeaders,
        null,
      );
      expect(
        out.map((WhaleLeaderEntry e) => e.id),
        mockWhaleLeaders.map((WhaleLeaderEntry e) => e.id),
      );
      expect(identical(out, mockWhaleLeaders), isFalse);
    });

    test('胜率降序：首条为最高 winRate', () {
      final List<WhaleLeaderEntry> out = sortWhaleLeaders(
        mockWhaleLeaders,
        const WhaleLeaderSort(
          key: WhaleLeaderSortKey.winRate,
          dir: WhaleLeaderSortDir.desc,
        ),
      );
      final double maxWin = mockWhaleLeaders
          .map((WhaleLeaderEntry e) => e.winRate)
          .reduce((double a, double b) => a > b ? a : b);
      expect(out.first.winRate, maxWin);
    });

    test('总值升序：首条为最低 aumValue', () {
      final List<WhaleLeaderEntry> out = sortWhaleLeaders(
        mockWhaleLeaders,
        const WhaleLeaderSort(
          key: WhaleLeaderSortKey.aum,
          dir: WhaleLeaderSortDir.asc,
        ),
      );
      final double minAum = mockWhaleLeaders
          .map((WhaleLeaderEntry e) => e.aumValue)
          .reduce((double a, double b) => a < b ? a : b);
      expect(out.first.aumValue, minAum);
    });

    test('盈亏降序：首条为最高 pnlValue（负值排末尾）', () {
      final List<WhaleLeaderEntry> out = sortWhaleLeaders(
        mockWhaleLeaders,
        const WhaleLeaderSort(
          key: WhaleLeaderSortKey.pnl,
          dir: WhaleLeaderSortDir.desc,
        ),
      );
      final double maxPnl = mockWhaleLeaders
          .map((WhaleLeaderEntry e) => e.pnlValue)
          .reduce((double a, double b) => a > b ? a : b);
      expect(out.first.pnlValue, maxPnl);
    });

    test('topWhaleLeaders 仅取带头像徽章的 top3', () {
      final List<WhaleLeaderEntry> top = topWhaleLeaders(mockWhaleLeaders);
      expect(top.length, 3);
      expect(top.every((WhaleLeaderEntry e) => e.avatarText != null), isTrue);
    });

    test('whaleLeaderTradeStats 复用条目展示串派生统计入参', () {
      final WhaleLeaderEntry e = mockWhaleLeaders.first; // 0x8ba1，盈利 73.81%
      final WhaleTradeStats s = whaleLeaderTradeStats(e);
      expect(s.pnlDisplay, e.pnlDisplay);
      expect(s.pnlTone, 'up');
      expect(s.winRatePct, 73.81);
      expect(s.tradesTotal, e.trades);
      expect(s.wins, 31);
      expect(s.losses, 11);
      expect(s.assetPerf.first.symbol, 'ZEC');
      expect(s.positionPerf.first.sym, 'XMR');
    });
  });

  group('发现 tab 渲染与交互', () {
    testWidgets('top3 轮播渲染：含 PageView 与首张 hero 卡', (WidgetTester tester) async {
      await _pump(tester);
      expect(find.byType(WhaleTopSlideshow), findsOneWidget);
      expect(find.byType(PageView), findsOneWidget);
      // 首张 hero 卡渲染（top3 首条地址）。
      expect(find.text('0x8ba1...ba72'), findsWidgets);
    });

    testWidgets('排序条三档药丸均渲染', (WidgetTester tester) async {
      await _pump(tester);
      Finder pill(String label) => find.descendant(
        of: find.byType(WhaleSortBar),
        matching: find.text(label),
      );
      expect(pill('胜率'), findsOneWidget);
      expect(pill('账户总价值'), findsOneWidget);
      expect(pill('已实现盈亏'), findsOneWidget);
    });

    testWidgets('巨鲸列表卡渲染 AI 标签', (WidgetTester tester) async {
      await _pump(tester);
      expect(find.byType(WhaleLeaderCard), findsWidgets);
      expect(find.text('金库管家'), findsWidgets);
    });

    testWidgets('点击「账户总价值」药丸即时重排列表卡顺序', (WidgetTester tester) async {
      await _pump(tester);
      // 默认胜率降序：首卡非 aum 最大者。
      final List<String> before = _cardOrder(tester);
      expect(before, isNotEmpty);

      await tester.tap(
        find.descendant(
          of: find.byType(WhaleSortBar),
          matching: find.text('账户总价值'),
        ),
      );
      await tester.pump();

      final List<String> after = _cardOrder(tester);
      // 总值降序后首卡应为 aumValue 最大者（0x8ba1...ba72，1.29 亿）。
      expect(after.first, '0x8ba1...ba72');
      expect(after, isNot(before));
    });

    testWidgets('卡片控件齐全：复制 / 趋势按钮均渲染', (WidgetTester tester) async {
      await _pump(tester);
      expect(find.byType(WhaleCopyButton), findsWidgets);
      expect(find.byType(WhaleTrendButton), findsWidgets);
      expect(find.byType(WhaleAddressLink), findsWidgets);
    });

    testWidgets('hero tier 两段渲染：金额 + 词分离', (WidgetTester tester) async {
      await _pump(tester);
      // '$100M+ HYPERUNIT WHALE' → 金额段 '$100M+' + 词段 'HYPERUNIT WHALE'。
      expect(find.text('\$100M+'), findsOneWidget);
      expect(find.text('HYPERUNIT WHALE'), findsWidgets);
    });

    testWidgets('列表卡指标文案含 (1月) 后缀', (WidgetTester tester) async {
      await _pump(tester);
      expect(find.text('已实现盈亏(1月)'), findsWidgets);
      expect(find.text('胜率(1月)'), findsWidgets);
      expect(find.text('当前持仓'), findsWidgets);
    });

    testWidgets('副标题对齐设计稿文案', (WidgetTester tester) async {
      await _pump(tester);
      expect(find.text('发现最有价值的交易者'), findsOneWidget);
    });

    testWidgets('入口一：点列表卡地址 → 进详情页', (WidgetTester tester) async {
      await _pump(tester);
      final Finder cardLink = find.descendant(
        of: find.byType(WhaleLeaderCard).first,
        matching: find.byType(WhaleAddressLink),
      );
      await tester.tap(cardLink.first);
      // 不用 pumpAndSettle：轮播 autoplay 为周期 timer，settle 会超时。
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 350));
      expect(find.text('PROFILE'), findsOneWidget);
    });

    testWidgets('入口二：点列表卡卡片本体 → 打开交易统计弹窗', (WidgetTester tester) async {
      await _pump(tester);
      // 点卡片本体（InkWell），避开地址 / 复制 / 趋势子控件。
      await tester.tap(find.text('账户总价值').last);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 350));
      expect(find.byType(WhaleTradeStatsSheet), findsOneWidget);
    });

    testWidgets('入口二：点趋势按钮 → 打开交易统计弹窗', (WidgetTester tester) async {
      await _pump(tester);
      await tester.tap(find.byType(WhaleTrendButton).first);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 350));
      expect(find.byType(WhaleTradeStatsSheet), findsOneWidget);
    });

    testWidgets('点复制按钮 → 写入剪贴板 + toast', (WidgetTester tester) async {
      final List<MethodCall> calls = <MethodCall>[];
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (MethodCall call) async {
          if (call.method == 'Clipboard.setData') calls.add(call);
          return null;
        },
      );
      await _pump(tester);
      await tester.tap(find.byType(WhaleCopyButton).first);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 350));
      expect(calls, isNotEmpty);
      expect(find.text('地址已复制'), findsOneWidget);
      // 浮层 toast 自带 1s 延时 + 淡出动画，drain 掉定时器避免 pending Timer。
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 250));
      expect(find.text('地址已复制'), findsNothing);
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      );
    });
  });
}
