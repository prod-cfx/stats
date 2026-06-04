import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/live/live_strategy_detail_page.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:shared_preferences/shared_preferences.dart';

GoRouter _router(String id) {
  return GoRouter(
    initialLocation: '/me/live/$id',
    routes: <RouteBase>[
      GoRoute(
        path: '/me/live',
        builder: (_, _) => const Scaffold(
          key: Key('list-stub'),
          body: Center(child: Text('list')),
        ),
        routes: <RouteBase>[
          GoRoute(
            path: ':id',
            builder: (BuildContext _, GoRouterState s) =>
                LiveStrategyDetailPage(id: s.pathParameters['id']!),
          ),
        ],
      ),
      GoRoute(
        path: '/ai',
        builder: (BuildContext _, GoRouterState s) => Scaffold(
          key: const Key('ai-stub'),
          body: Center(
            child: Text('ai ${s.uri.queryParameters['loadStrategy']}'),
          ),
        ),
      ),
    ],
  );
}

Future<ProviderContainer> _pump(WidgetTester tester, String id) async {
  await tester.binding.setSurfaceSize(const Size(420, 2000));
  SharedPreferences.setMockInitialValues(<String, Object>{});
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  final ProviderContainer container = ProviderContainer(
    overrides: <Override>[sharedPreferencesProvider.overrideWithValue(prefs)],
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
        routerConfig: _router(id),
      ),
    ),
  );
  await tester.pump(const Duration(milliseconds: 300));
  await tester.pumpAndSettle();
  return container;
}

void main() {
  testWidgets('概览：展示名称、累计盈亏与指标', (WidgetTester tester) async {
    await _pump(tester, 'QF-AY7K2P');
    // hero 名称（subtitle 在 top bar）
    expect(find.text('BTC 趋势 · 双均线'), findsWidgets);
    expect(find.text('累计盈亏'), findsWidgets);
    // 概览指标格：胜率
    expect(find.text('胜率'), findsOneWidget);
    expect(find.text('交易笔数'), findsOneWidget);
    // AI 观察存在
    expect(find.textContaining('AI 观察'), findsOneWidget);
    // 策略档案 section
    expect(find.text('策略档案'), findsOneWidget);
  });

  testWidgets('详情 tabs 单行四等分对齐设计稿', (WidgetTester tester) async {
    await _pump(tester, 'QF-AY7K2P');
    final double overviewY = tester.getTopLeft(find.text('概览')).dy;
    final double positionsY = tester.getTopLeft(find.text('持仓')).dy;
    final double historyY = tester.getTopLeft(find.text('交易记录')).dy;
    final double paramsY = tester.getTopLeft(find.text('参数')).dy;
    expect(positionsY, overviewY);
    expect(historyY, overviewY);
    expect(paramsY, overviewY);
  });

  testWidgets('切到持仓 tab：running 策略展示持仓', (WidgetTester tester) async {
    await _pump(tester, 'QF-AY7K2P');
    await tester.tap(find.text('持仓'));
    await tester.pumpAndSettle();
    expect(find.text('入场价'), findsOneWidget);
    expect(find.text('当前价'), findsOneWidget);
    expect(find.text('止损价'), findsOneWidget);
  });

  testWidgets('暂停策略持仓 tab：展示空态', (WidgetTester tester) async {
    await _pump(tester, 'QF-2H8N5W');
    await tester.tap(find.text('持仓'));
    await tester.pumpAndSettle();
    expect(find.text('策略已暂停'), findsOneWidget);
  });

  testWidgets('交易记录 tab：展示历史成交', (WidgetTester tester) async {
    await _pump(tester, 'QF-AY7K2P');
    await tester.tap(find.text('交易记录'));
    await tester.pumpAndSettle();
    expect(find.textContaining('今天 14:30'), findsOneWidget);
  });

  testWidgets('参数 tab：展示策略参数', (WidgetTester tester) async {
    await _pump(tester, 'QF-AY7K2P');
    await tester.tap(find.text('参数'));
    await tester.pumpAndSettle();
    expect(find.text('fast_ma'), findsOneWidget);
    expect(find.text('leverage'), findsOneWidget);
  });

  testWidgets('running 暂停：弹持仓处理对话框，确认后转已暂停', (WidgetTester tester) async {
    await _pump(tester, 'QF-AY7K2P');
    // 主操作 = 暂停（running）
    await tester.tap(find.byKey(const Key('live-primary-action')));
    await tester.pumpAndSettle();
    // 持仓处理对话框出现
    expect(find.byKey(const Key('live-pause-confirm')), findsOneWidget);
    expect(find.text('暂停策略'), findsWidgets);
    // 确认 → store 转 paused：主按钮变「开启策略」，状态注出现
    await tester.ensureVisible(find.byKey(const Key('live-pause-confirm')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('live-pause-confirm')));
    await tester.pumpAndSettle();
    expect(find.text('开启策略'), findsOneWidget);
    expect(find.textContaining('已暂停'), findsWidgets);
  });

  testWidgets('paused 策略：主操作恢复 → running', (WidgetTester tester) async {
    await _pump(tester, 'QF-2H8N5W');
    // 暂停态主按钮 = 开启策略
    expect(find.text('开启策略'), findsOneWidget);
    await tester.tap(find.byKey(const Key('live-primary-action')));
    await tester.pumpAndSettle();
    // 恢复后状态注清空（'已暂停 · 等待恢复' 消失），主按钮变暂停策略
    expect(find.text('暂停策略'), findsOneWidget);
  });

  testWidgets('running 删除：先弹需暂停守卫', (WidgetTester tester) async {
    await _pump(tester, 'QF-AY7K2P');
    await tester.tap(find.byKey(const Key('live-delete-button')));
    await tester.pumpAndSettle();
    expect(find.text('需要先暂停策略'), findsOneWidget);
    expect(find.byKey(const Key('live-need-pause-confirm')), findsOneWidget);
  });

  testWidgets('paused 删除：软删默认，可展开永久勾选', (WidgetTester tester) async {
    await _pump(tester, 'QF-2H8N5W');
    await tester.tap(find.byKey(const Key('live-delete-button')));
    await tester.pumpAndSettle();
    expect(find.text('删除策略？'), findsOneWidget);
    // 展开「不保留历史?」→ 勾选 → 标题切永久
    await tester.tap(find.text('不保留历史？'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('live-delete-permanent-checkbox')));
    await tester.pumpAndSettle();
    expect(find.text('永久删除策略？'), findsOneWidget);
  });

  testWidgets('stopped 永久删除：确认后回弹列表', (WidgetTester tester) async {
    await _pump(tester, 'QF-5J1RT8');
    await tester.tap(find.byKey(const Key('live-delete-button')));
    await tester.pumpAndSettle();
    // stopped 直接永久删除
    expect(find.text('永久删除策略？'), findsOneWidget);
    await tester.tap(find.byKey(const Key('live-delete-confirm')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('list-stub')), findsOneWidget);
  });

  testWidgets('调优参数：跳 AI 对话并带策略 id', (WidgetTester tester) async {
    await _pump(tester, 'QF-AY7K2P');
    await tester.tap(find.text('参数'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('live-tune-in-ai')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('ai-stub')), findsOneWidget);
    expect(find.text('ai QF-AY7K2P'), findsOneWidget);
  });
}
