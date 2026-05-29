import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
        path: '/me/live/:id',
        builder: (BuildContext _, GoRouterState s) =>
            LiveStrategyDetailPage(id: s.pathParameters['id']!),
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

  testWidgets('底部主操作未接通：tap 提示即将上线', (WidgetTester tester) async {
    await _pump(tester, 'QF-AY7K2P');
    await tester.tap(find.byKey(const Key('live-primary-action')));
    await tester.pump();
    expect(find.text('策略操作即将上线'), findsOneWidget);
  });
}
