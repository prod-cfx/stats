import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/live/live_strategies_page.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 测试 router：`/me/live` 落 [LiveStrategiesPage]，`/me/live/:id` 用 stub
/// 接收详情跳转（断言列表 tile 点击会导航）。
GoRouter _router() {
  return GoRouter(
    initialLocation: '/me/live',
    routes: <RouteBase>[
      GoRoute(
        path: '/me/live',
        builder: (_, _) => const LiveStrategiesPage(),
      ),
      GoRoute(
        path: '/me/live/:id',
        builder: (BuildContext _, GoRouterState s) => Scaffold(
          key: const Key('detail-stub'),
          body: Center(child: Text('detail ${s.pathParameters['id']}')),
        ),
      ),
    ],
  );
}

Future<ProviderContainer> _pump(WidgetTester tester) async {
  await tester.binding.setSurfaceSize(const Size(420, 1600));
  SharedPreferences.setMockInitialValues(<String, Object>{});
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  final ProviderContainer container = ProviderContainer(
    overrides: <Override>[
      sharedPreferencesProvider.overrideWithValue(prefs),
    ],
  );
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(
          const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
        ),
        routerConfig: _router(),
      ),
    ),
  );
  await tester.pump(const Duration(milliseconds: 300));
  await tester.pumpAndSettle();
  return container;
}

void main() {
  testWidgets('列表展示策略名称、状态、收益摘要', (WidgetTester tester) async {
    await _pump(tester);

    // 名称（验收标准：列表展示策略名称）
    expect(find.text('BTC 趋势 · 双均线'), findsOneWidget);
    expect(find.text('ETH 均值回归 · 4H'), findsOneWidget);
    // 运行中策略卡存在（默认 all 过滤掉 stopped → BNB 高频不在）
    expect(find.byKey(const Key('live-card-QF-AY7K2P')), findsOneWidget);
    expect(find.byKey(const Key('live-card-QF-5J1RT8')), findsNothing);
    // 聚合摘要标题
    expect(find.text('总资产 (持仓 + 可用)'), findsOneWidget);
  });

  testWidgets('点击策略卡进入详情', (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('live-card-QF-AY7K2P')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('detail-stub')), findsOneWidget);
    expect(find.text('detail QF-AY7K2P'), findsOneWidget);
  });

  testWidgets('已停止筛选展示 stopped 策略 + 保留提示',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.text('已停止 1'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('live-card-QF-5J1RT8')), findsOneWidget);
    expect(find.textContaining('保留 30 天'), findsOneWidget);
  });

  testWidgets('排序入口：打开筛选 & 排序 sheet', (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('live-sort-button')));
    await tester.pumpAndSettle();
    expect(find.text('筛选 & 排序'), findsOneWidget);
    expect(find.byKey(const Key('live-sort-apply')), findsOneWidget);
    // 6 个排序指标可选
    expect(find.byKey(const Key('live-sort-metric-todayPnl')), findsOneWidget);
    expect(find.byKey(const Key('live-sort-metric-winRate')), findsOneWidget);
  });

  testWidgets('排序生效：按累计盈亏升序后首卡为最小盈亏策略',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('live-sort-button')));
    await tester.pumpAndSettle();
    // 选累计盈亏 + 升序
    await tester.tap(find.byKey(const Key('live-sort-metric-totalPnl')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('升序'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('live-sort-apply')));
    await tester.pumpAndSettle();
    // all 过滤排除 stopped；活跃 4 条累计盈亏最小为 QF-DK4F71（+20.80）
    final Offset first =
        tester.getTopLeft(find.byKey(const Key('live-card-QF-DK4F71')));
    final Offset btc =
        tester.getTopLeft(find.byKey(const Key('live-card-QF-AY7K2P')));
    expect(first.dy, lessThan(btc.dy));
  });
}
