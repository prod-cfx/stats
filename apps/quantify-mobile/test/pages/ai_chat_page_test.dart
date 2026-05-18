import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/pages/ai/ai_home_page.dart';
import 'package:quantify_mobile/pages/ai/backtest_config_sheet.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// Minimal router: AiHomePage at `/ai`, BacktestConfigSheet at
/// `/ai/backtest-config`. Sized 400×800 so the input bar + a few bubbles
/// fit without forcing a scroll; some assertions rely on widgets being
/// `findsOneWidget` rather than `findsAny`.
Future<void> _pump(WidgetTester tester) async {
  await tester.binding.setSurfaceSize(const Size(400, 1200));
  final GoRouter router = GoRouter(
    initialLocation: '/ai',
    routes: <RouteBase>[
      GoRoute(
        path: '/ai',
        builder: (BuildContext context, GoRouterState state) =>
            const AiHomePage(),
        routes: <RouteBase>[
          GoRoute(
            path: 'backtest-config',
            builder: (BuildContext context, GoRouterState state) =>
                const BacktestConfigSheet(),
          ),
        ],
      ),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp.router(
        theme: buildQzThemeData(
          const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
        ),
        routerConfig: router,
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('AI 对话页：输入消息发送 → user 气泡显示 → 流式 assistant 回复',
      (WidgetTester tester) async {
    await _pump(tester);

    // Send "hi"
    await tester.enterText(find.byKey(const Key('ai-chat-input')), 'hi');
    await tester.tap(find.byKey(const Key('ai-send-button')));
    // Spin frames over the mock's 200 ms reply delay + the 250 ms-per-char
    // streaming cadence. Each pump advances the clock without forcing
    // pumpAndSettle (Timer.periodic would never settle).
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.text('hi'), findsOneWidget);

    // Wait for the full mock reply to stream in. The mock returns:
    // 已收到："hi"。这是一段 mock 回复。
    // (~22 chars; 22 * 250 ms = 5.5 s). Spin extra frames to flush the
    // final Timer tick.
    for (int i = 0; i < 30; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }
    expect(find.text('已收到："hi"。这是一段 mock 回复。'), findsOneWidget);
  });

  testWidgets('AI 对话页：点回测按钮 → 抽屉打开 → 提交后卡片插入对话流',
      (WidgetTester tester) async {
    await _pump(tester);

    await tester.tap(find.byKey(const Key('ai-backtest-button')));
    await tester.pumpAndSettle();
    expect(find.text('回测参数'), findsOneWidget);

    // Submit with default values (last 30 days, 10000 capital, leverage 1×).
    // The sheet is taller than the 800×400 widget-test surface, so scroll
    // the submit button into view before tapping.
    await tester
        .ensureVisible(find.byKey(const Key('backtest-submit')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('backtest-submit')));
    // Mock backtest delays 200 ms.
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pumpAndSettle();

    expect(find.text('回测结果'), findsOneWidget);
    expect(find.text('+18.20%'), findsOneWidget);
  });

  testWidgets('回测抽屉：空白起止时间 → 显示校验错误，不 pop',
      (WidgetTester tester) async {
    await _pump(tester);

    await tester.tap(find.byKey(const Key('ai-backtest-button')));
    await tester.pumpAndSettle();

    // Clear start date input → 触发 "请输入正确的起止时间"
    await tester.enterText(find.byKey(const Key('backtest-start')), '');
    await tester
        .ensureVisible(find.byKey(const Key('backtest-submit')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('backtest-submit')));
    await tester.pump();

    expect(find.text('请输入正确的起止时间（YYYY-MM-DD）'), findsOneWidget);
    // 抽屉仍在 — 没 pop 回 AI 页
    expect(find.text('回测参数'), findsOneWidget);
  });
}
