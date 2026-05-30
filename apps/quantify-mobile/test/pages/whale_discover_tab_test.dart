import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/mock/fixtures/whale_leaders.dart';
import 'package:quantify_mobile/data/models/whale_leader_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/whale_leaderboard_repository.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/whale/tabs/whale_discover_tab.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_leader_card.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_top_slideshow.dart';
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
        whaleLeaderboardRepositoryProvider
            .overrideWithValue(_FakeLeaderboardRepo()),
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
      final List<WhaleLeaderEntry> out =
          sortWhaleLeaders(mockWhaleLeaders, null);
      expect(out.map((WhaleLeaderEntry e) => e.id),
          mockWhaleLeaders.map((WhaleLeaderEntry e) => e.id));
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
      expect(find.text('胜率'), findsWidgets);
      expect(find.text('总值'), findsOneWidget);
      expect(find.text('盈亏'), findsOneWidget);
    });

    testWidgets('巨鲸列表卡渲染 AI 标签', (WidgetTester tester) async {
      await _pump(tester);
      expect(find.byType(WhaleLeaderCard), findsWidgets);
      expect(find.text('金库管家'), findsWidgets);
    });

    testWidgets('点击「总值」药丸即时重排列表卡顺序', (WidgetTester tester) async {
      await _pump(tester);
      // 默认胜率降序：首卡非 aum 最大者。
      final List<String> before = _cardOrder(tester);
      expect(before, isNotEmpty);

      await tester.tap(find.text('总值'));
      await tester.pump();

      final List<String> after = _cardOrder(tester);
      // 总值降序后首卡应为 aumValue 最大者（0x8ba1...ba72，1.29 亿）。
      expect(after.first, '0x8ba1...ba72');
      expect(after, isNot(before));
    });
  });
}
