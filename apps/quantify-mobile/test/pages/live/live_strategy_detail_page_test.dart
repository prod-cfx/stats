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
import '../../helpers/test_overrides.dart';

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
    overrides: <Override>[
      ...testRepositoryOverrides,
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
        routerConfig: _router(id),
      ),
    ),
  );
  await tester.pump(const Duration(milliseconds: 300));
  await tester.pumpAndSettle();
  return container;
}

void main() {
  testWidgets('概览：展示名称、总收益额与 front 指标', (WidgetTester tester) async {
    await _pump(tester, 'QF-AY7K2P');
    // hero 名称（subtitle 在 top bar）
    expect(find.text('BTC 趋势 · 双均线'), findsWidgets);
    expect(find.text('总收益额'), findsWidgets);
    expect(find.text('累计盈亏'), findsNothing);
    // 概览指标格：最大回撤 / 胜率对齐 front metrics。
    expect(find.text('最大回撤'), findsOneWidget);
    expect(find.text('12.40%'), findsOneWidget);
    expect(find.text('胜率'), findsOneWidget);
    expect(find.text('55.3%'), findsOneWidget);
    expect(find.text('今日 %'), findsNothing);
    expect(find.text('累计 %'), findsNothing);
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

  testWidgets('停止策略持仓 tab：展示空态', (WidgetTester tester) async {
    await _pump(tester, 'QF-2H8N5W');
    await tester.tap(find.text('持仓'));
    await tester.pumpAndSettle();
    expect(find.text('策略已停止'), findsOneWidget);
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

  testWidgets('running 停止：弹持仓处理对话框，确认后转已停止', (WidgetTester tester) async {
    await _pump(tester, 'QF-AY7K2P');
    // 主操作 = 停止（running）
    await tester.tap(find.byKey(const Key('live-primary-action')));
    await tester.pumpAndSettle();
    // 持仓处理对话框出现
    expect(find.byKey(const Key('live-pause-confirm')), findsOneWidget);
    expect(find.text('停止策略'), findsWidgets);
    expect(find.text('等待止损/止盈触发'), findsNothing);
    // 确认 → store 转 stopped：状态注出现
    await tester.ensureVisible(find.byKey(const Key('live-pause-confirm')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('live-pause-confirm')));
    await tester.pumpAndSettle();
    expect(find.textContaining('已停止'), findsWidgets);
  });

  testWidgets('running 无持仓停止：仍弹停止选择', (WidgetTester tester) async {
    await _pump(tester, 'QF-9MX31R');

    await tester.tap(find.byKey(const Key('live-primary-action')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('live-pause-confirm')), findsOneWidget);
    expect(find.text('市价平仓后停止'), findsOneWidget);
    expect(find.text('保留持仓，仅停止策略'), findsOneWidget);
    expect(find.text('等待止损/止盈触发'), findsNothing);
  });

  testWidgets('stopped 策略：删除按钮可用', (WidgetTester tester) async {
    await _pump(tester, 'QF-2H8N5W');
    expect(find.byKey(const Key('live-delete-button')), findsOneWidget);
  });

  testWidgets('running 删除：先弹需停止守卫', (WidgetTester tester) async {
    await _pump(tester, 'QF-AY7K2P');
    await tester.tap(find.byKey(const Key('live-delete-button')));
    await tester.pumpAndSettle();
    expect(find.text('需要先停止策略'), findsOneWidget);
    expect(find.byKey(const Key('live-need-pause-confirm')), findsOneWidget);
  });

  testWidgets('stopped 删除：软删默认，可展开永久勾选', (WidgetTester tester) async {
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

  testWidgets('历史记录详情只读：隐藏操作按钮', (WidgetTester tester) async {
    await _pump(tester, 'QF-5J1RT8');
    expect(find.byKey(const Key('live-primary-action')), findsNothing);
    expect(find.byKey(const Key('live-delete-button')), findsNothing);
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
