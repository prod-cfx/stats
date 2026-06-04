import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/pages/ai/ai_home_page.dart';
import 'package:quantify_mobile/pages/strategy/strategy_detail_page.dart';
import 'package:quantify_mobile/pages/strategy/strategy_home_page.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:shared_preferences/shared_preferences.dart';

// _pump 是辅助函数；不需要 typed return。

/// #1559 验收：策略卡/详情「载入对话」→ AI tab 注入预设消息 + params bubble。
///
/// 路由结构最小复现：把 `/ai`、`/strategy`、`/strategy/:id` 三条注册成 top-level
/// GoRoute（不复用 StatefulShellRoute，因为 shell 需要的 navigation shell 在
/// widget test 里搭起来代价过大）。query handling、消息注入逻辑与生产路由完全
/// 一致，验证目标是 AiHomePage 内部对 `?loadStrategy` 的响应。
Future<void> _pump(WidgetTester tester) async {
  await tester.binding.setSurfaceSize(const Size(420, 2400));
  SharedPreferences.setMockInitialValues(<String, Object>{});
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  final GoRouter router = GoRouter(
    initialLocation: '/strategy',
    routes: <RouteBase>[
      GoRoute(
        path: '/ai',
        builder: (BuildContext context, GoRouterState state) =>
            const AiHomePage(),
      ),
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
      overrides: <Override>[sharedPreferencesProvider.overrideWithValue(prefs)],
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
  // 策略列表 200ms repo 延迟
  await tester.pump(const Duration(milliseconds: 250));
  await tester.pump(const Duration(milliseconds: 250));
}

void main() {
  testWidgets('策略卡：右下角存在「载入对话」按钮（验收 1）', (WidgetTester tester) async {
    await _pump(tester);
    // 至少首屏第一条策略带 load button
    expect(
      find.byKey(const Key('strategy-card-load-chat-st-grid-btc')),
      findsOneWidget,
    );
    expect(find.text('载入对话'), findsAtLeastNWidgets(1));
  });

  testWidgets('策略详情：底部存在「载入到对话」按钮（验收 2）', (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('strategy-tile-st-grid-btc')));
    await tester.pump();
    // detail+signals 200ms / reviews 150ms / equity 120ms
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump();
    expect(
      find.byKey(const Key('strategy-detail-load-chat-btn')),
      findsOneWidget,
    );
    expect(find.text('载入到对话'), findsOneWidget);
  });

  testWidgets('点击策略卡载入对话 → 跳到 /ai → 注入用户消息 + assistant params 气泡（验收 3-5）', (
    WidgetTester tester,
  ) async {
    await _pump(tester);
    await tester.tap(
      find.byKey(const Key('strategy-card-load-chat-st-grid-btc')),
    );
    // 路由切换 + AI 页 _loadSessions（50ms）+ getStrategyDetail（200ms）+ create session
    // + post-frame；分多次 pump 排空 microtask 队列。
    await tester.pump();
    for (int i = 0; i < 20; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    // 兜底再 settle 一次
    await tester.pump(const Duration(milliseconds: 300));

    // 用户消息内容包含策略名（fixture 中 st-grid-btc 名为「BTC 网格搬砖」）
    expect(find.textContaining('BTC'), findsWidgets);
    expect(find.textContaining('请基于策略'), findsAtLeastNWidgets(1));
    // params 气泡（assistant kind=params）：QzChatBubble 用 `ai-bubble-params` key
    expect(find.byKey(const Key('ai-bubble-params')), findsOneWidget);
    expect(find.byKey(const Key('ai-bubble-param-fast_ma')), findsOneWidget);
    expect(find.byKey(const Key('ai-bubble-param-slow_ma')), findsOneWidget);
    expect(find.byKey(const Key('ai-bubble-param-stop_loss')), findsOneWidget);
    expect(find.byKey(const Key('ai-bubble-param-position')), findsOneWidget);
    expect(find.byKey(const Key('ai-bubble-param-return_7d')), findsNothing);
    expect(find.byKey(const Key('ai-bubble-param-max_drawdown')), findsNothing);
  });

  testWidgets('从策略详情点击载入到对话 → 跳到 /ai 并注入（验收 2 + 3-5）', (
    WidgetTester tester,
  ) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('strategy-tile-st-grid-btc')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump(const Duration(milliseconds: 250));

    await tester.tap(find.byKey(const Key('strategy-detail-load-chat-btn')));
    await tester.pump();
    for (int i = 0; i < 20; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.textContaining('请基于策略'), findsAtLeastNWidgets(1));
    expect(find.byKey(const Key('ai-bubble-params')), findsOneWidget);
  });
}
