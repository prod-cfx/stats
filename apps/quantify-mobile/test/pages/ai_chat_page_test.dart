import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/pages/ai/ai_home_page.dart';
import 'package:quantify_mobile/pages/ai/backtest_config_sheet.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// Pump AI page with a minimal router. Sized 400×1200 so 3 mock sessions +
/// input bar fit; await an extra 100ms tick so `_loadSessions` (50ms repo
/// delay) resolves before assertions.
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
  // 让 postFrame loadSessions（50ms 延迟）解析
  await tester.pump(const Duration(milliseconds: 100));
  await tester.pump();
}

void main() {
  testWidgets('AI 对话页：输入消息发送 → user 气泡显示 → 流式 assistant 回复',
      (WidgetTester tester) async {
    await _pump(tester);

    // Send "hi"
    await tester.enterText(find.byKey(const Key('ai-chat-input')), 'hi');
    await tester.tap(find.byKey(const Key('ai-send-button')));
    // 等 200ms 思考延迟 + 流式
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.text('hi'), findsOneWidget);
    for (int i = 0; i < 30; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }
    expect(find.text('已收到："hi"。这是一段 mock 回复。'), findsOneWidget);
  });

  testWidgets('AI 对话页：点回测按钮 → 抽屉打开 → 提交后先回测中 → 完成切结果卡',
      (WidgetTester tester) async {
    await _pump(tester);

    await tester.tap(find.byKey(const Key('ai-backtest-button')));
    await tester.pumpAndSettle();
    expect(find.text('回测参数'), findsOneWidget);

    await tester
        .ensureVisible(find.byKey(const Key('backtest-submit')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('backtest-submit')));
    // sheet 内 200ms mock + pop 回 AI 页，先进入「回测中」进度卡
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump();
    expect(find.byKey(const Key('backtest-progress-card')), findsOneWidget);
    expect(find.text('回测进行中'), findsOneWidget);
    // 结果卡此时尚未出现
    expect(find.text('回测结果'), findsNothing);

    // 推进进度计时器（120ms × ~25 tick）直到完成
    for (int i = 0; i < 30; i++) {
      await tester.pump(const Duration(milliseconds: 120));
    }
    expect(find.byKey(const Key('backtest-progress-card')), findsNothing);
    expect(find.text('回测结果'), findsOneWidget);
    expect(find.text('+18.20%'), findsOneWidget);
    expect(find.byKey(const Key('ai-deploy-button')), findsOneWidget);
  });

  testWidgets('回测中：点取消回测 → 进度卡消失，不出现结果卡',
      (WidgetTester tester) async {
    await _pump(tester);

    await tester.tap(find.byKey(const Key('ai-backtest-button')));
    await tester.pumpAndSettle();
    await tester
        .ensureVisible(find.byKey(const Key('backtest-submit')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('backtest-submit')));
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump();
    expect(find.byKey(const Key('backtest-progress-card')), findsOneWidget);

    await tester.tap(find.byKey(const Key('backtest-progress-cancel')));
    await tester.pump();
    expect(find.byKey(const Key('backtest-progress-card')), findsNothing);
    expect(find.text('回测结果'), findsNothing);
  });

  testWidgets('回测抽屉：自定义区间留空起止时间 → 显示校验错误，不 pop',
      (WidgetTester tester) async {
    await _pump(tester);
    // 自定义模式下 sheet 内容更长，给一个更高的测试 surface 避免按钮被裁
    await tester.binding.setSurfaceSize(const Size(400, 1800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('ai-backtest-button')));
    await tester.pumpAndSettle();

    // 切到「自定义」区间，露出 start/end 文本框
    await tester.ensureVisible(find.byKey(const Key('backtest-range-custom')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('backtest-range-custom')));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('backtest-start')), '');
    await tester
        .ensureVisible(find.byKey(const Key('backtest-submit')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('backtest-submit')));
    await tester.pump();

    expect(find.text('请输入正确的起止时间（YYYY-MM-DD）'), findsOneWidget);
    expect(find.text('回测参数'), findsOneWidget);
  });

  testWidgets('回测抽屉：新字段渲染齐全（区间 chips / 滑点 / 手续费 / 成交价来源 / shield banner）',
      (WidgetTester tester) async {
    await _pump(tester);

    await tester.tap(find.byKey(const Key('ai-backtest-button')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('backtest-range-7D')), findsOneWidget);
    expect(find.byKey(const Key('backtest-range-30D')), findsOneWidget);
    expect(find.byKey(const Key('backtest-range-90D')), findsOneWidget);
    expect(find.byKey(const Key('backtest-range-1Y')), findsOneWidget);
    expect(find.byKey(const Key('backtest-range-custom')), findsOneWidget);
    expect(find.byKey(const Key('backtest-slippage')), findsOneWidget);
    expect(find.byKey(const Key('backtest-fee')), findsOneWidget);
    expect(find.byKey(const Key('backtest-fill-source')), findsOneWidget);
    expect(find.byKey(const Key('backtest-partial-data')), findsOneWidget);
    expect(find.byKey(const Key('backtest-collapse')), findsOneWidget);
    expect(find.text('确认并开始回测'), findsOneWidget);
  });

  testWidgets('多会话：顶栏点击历史按钮 → 抽屉列出 3 条 mock 会话 → 切换会话',
      (WidgetTester tester) async {
    await _pump(tester);

    // 顶栏标题展示当前会话标题（默认第一条 — 倒序后 = BTC 趋势 · 双均线）
    expect(find.text('BTC 趋势 · 双均线'), findsOneWidget);

    await tester.tap(find.byKey(const Key('ai-appbar-history')));
    await tester.pumpAndSettle();

    // 3 条 mock session tile 都在
    expect(find.byKey(const Key('ai-session-tile-s1')), findsOneWidget);
    expect(find.byKey(const Key('ai-session-tile-s2')), findsOneWidget);
    expect(find.byKey(const Key('ai-session-tile-s3')), findsOneWidget);

    // 切到 ETH
    await tester.tap(find.byKey(const Key('ai-session-tile-s2')));
    await tester.pumpAndSettle();

    expect(find.text('ETH 4H 均值回归'), findsOneWidget);
  });

  testWidgets('快捷回复 chips：点击直接发送，user 气泡渲染',
      (WidgetTester tester) async {
    await _pump(tester);

    // 点第一个 chip：「再跑一次回测」
    await tester.tap(find.byKey(const Key('ai-quick-reply-0')));
    await tester.pump(const Duration(milliseconds: 250));

    expect(find.text('再跑一次回测'), findsWidgets);
    // 让 stream timer 跑完，避免 "A Timer is still pending"
    for (int i = 0; i < 40; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }
  });

  testWidgets('typing indicator：发送消息后到 reply 到达前显示',
      (WidgetTester tester) async {
    await _pump(tester);

    await tester.enterText(find.byKey(const Key('ai-chat-input')), '测试 typing');
    await tester.tap(find.byKey(const Key('ai-send-button')));
    // 还没过 200ms 思考延迟 → indicator 可见
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.byKey(const Key('ai-typing-indicator')), findsOneWidget);

    // 思考延迟过后 → indicator 消失（流式开始）
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.byKey(const Key('ai-typing-indicator')), findsNothing);

    for (int i = 0; i < 30; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }
  });

  testWidgets('params 气泡：mock s1 session 渲染 fast_ma=5 / slow_ma=20',
      (WidgetTester tester) async {
    await _pump(tester);

    // 默认进入 s1 → 含 params 气泡（fast_ma=5 / slow_ma=20）。
    // params 行通过 RichText 内嵌 TextSpan 渲染，无法用 find.text 命中；
    // 以 Key 为准 + 校验 RichText 子节点的纯文本拼接含 fast_ma 即可。
    final Finder paramsBubble =
        find.byKey(const Key('ai-bubble-params'));
    expect(paramsBubble, findsOneWidget);
    final Iterable<RichText> richTexts =
        tester.widgetList<RichText>(find.descendant(
      of: paramsBubble,
      matching: find.byType(RichText),
    ));
    final String joined = richTexts
        .map((RichText r) => r.text.toPlainText())
        .join('|');
    expect(joined, contains('fast_ma'));
    expect(joined, contains('slow_ma'));
  });

  testWidgets('删除当前会话 → 自动切到最近会话',
      (WidgetTester tester) async {
    await _pump(tester);

    await tester.tap(find.byKey(const Key('ai-appbar-history')));
    await tester.pumpAndSettle();

    // 当前 s1 — 抽屉里 s1 tile 上才有删除按钮
    await tester.tap(find.byKey(const Key('ai-session-delete-s1')));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pumpAndSettle();

    // s1 不再存在；关掉 drawer 后顶栏标题切到 ETH
    expect(find.byKey(const Key('ai-session-tile-s1')), findsNothing);
    await tester.tap(find.byKey(const Key('ai-drawer-close')));
    await tester.pumpAndSettle();
    expect(find.text('ETH 4H 均值回归'), findsOneWidget);
  });

  testWidgets('顶部栏：不再显示 debug count，渲染新建会话图标 + 参数 pill（#1590）',
      (WidgetTester tester) async {
    await _pump(tester);

    // #1590 验收：移除 debug-only `count: 0`，确认 widget tree 中不存在。
    expect(find.textContaining('count:'), findsNothing);
    expect(find.byKey(const Key('ai-counter-inc')), findsNothing);

    // 新建会话图标按钮 + 参数 pill 都要在。
    expect(find.byKey(const Key('ai-appbar-new-session')), findsOneWidget);
    expect(find.byKey(const Key('ai-backtest-button')), findsOneWidget);
    expect(find.text('参数'), findsOneWidget);

    // 点参数按钮 → 打开回测参数 sheet。
    await tester.tap(find.byKey(const Key('ai-backtest-button')));
    await tester.pumpAndSettle();
    expect(find.text('回测参数'), findsOneWidget);
  });

  testWidgets('草稿不串台：在 s1 输入后切到 s2 输入框为空，再切回 s1 草稿仍在',
      (WidgetTester tester) async {
    await _pump(tester);

    await tester.enterText(
        find.byKey(const Key('ai-chat-input')), 'draft for s1');
    await tester.pump();

    await tester.tap(find.byKey(const Key('ai-appbar-history')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('ai-session-tile-s2')));
    await tester.pumpAndSettle();

    // s2 输入应为空
    expect(
      (tester.widget(find.byKey(const Key('ai-chat-input'))) as TextField)
          .controller!
          .text,
      isEmpty,
    );

    // 切回 s1
    await tester.tap(find.byKey(const Key('ai-appbar-history')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('ai-session-tile-s1')));
    await tester.pumpAndSettle();

    expect(
      (tester.widget(find.byKey(const Key('ai-chat-input'))) as TextField)
          .controller!
          .text,
      'draft for s1',
    );
  });
}
