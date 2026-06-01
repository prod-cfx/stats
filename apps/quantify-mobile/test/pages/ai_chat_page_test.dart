import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/pages/ai/ai_home_page.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_context.dart';
import 'package:quantify_mobile/widgets/qz_glyph_icon.dart';
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

  testWidgets('顶部栏：仅历史 + 新建会话，无设计稿外的「参数」按钮（#2014）',
      (WidgetTester tester) async {
    await _pump(tester);

    // #1590 验收：移除 debug-only `count: 0`，确认 widget tree 中不存在。
    expect(find.textContaining('count:'), findsNothing);
    expect(find.byKey(const Key('ai-counter-inc')), findsNothing);

    // 设计稿顶栏：左历史 + 右新建会话；无「参数」pill（#2014）。
    expect(find.byKey(const Key('ai-appbar-history')), findsOneWidget);
    expect(find.byKey(const Key('ai-appbar-new-session')), findsOneWidget);
    expect(find.byKey(const Key('ai-backtest-button')), findsNothing);
    expect(find.text('参数'), findsNothing);
  });

  testWidgets('顶栏左/右按钮：32×32 bgSoft 软背景容器 + 设计 glyph，方钮/圆钮圆角各异（#2015）',
      (WidgetTester tester) async {
    await _pump(tester);

    // 从实际渲染上下文取软背景色，与页面（`c.bgSoft`）共享单一事实源，
    // 主题色调整时测试自动同步，避免硬编码字面值静默失真。
    final BuildContext ctx = tester.element(find.byType(AiHomePage));
    final Color bgSoft = ctx.qzScheme.bgSoft;

    // 校验软背景按钮：背景与圆角由 Material（ink 表面）承载，水波纹才不被遮挡；
    // 内层 32×32 固定尺寸承载 glyph。按钮 Key 在 InkWell 上，向上找最近 Material。
    void expectSoftButton(Key key, double radius) {
      final Finder btn = find.byKey(key);
      expect(btn, findsOneWidget);
      final Material mat = tester.widget<Material>(
        find.ancestor(of: btn, matching: find.byType(Material)).first,
      );
      expect(mat.color, bgSoft);
      expect(mat.borderRadius, BorderRadius.circular(radius));
      // InkWell 内层固定 32×32 视觉尺寸。
      final SizedBox inner = tester.widget<SizedBox>(
        find.descendant(of: btn, matching: find.byType(SizedBox)).first,
      );
      expect(inner.width, 32);
      expect(inner.height, 32);
      // 命中区 48×48 由 _TopBarButton 最外层 SizedBox 提供，且不被 leading 槽 /
      // actions 裁切（回归：leadingWidth 须容纳 padding + 48，否则左钮被裁回 ~32）。
      final Size hit = tester.getSize(
        find.ancestor(of: btn, matching: find.byType(SizedBox)).first,
      );
      expect(hit.width, greaterThanOrEqualTo(48));
      expect(hit.height, greaterThanOrEqualTo(48));
      expect(
        find.descendant(of: btn, matching: find.byType(QzGlyphIcon)),
        findsOneWidget,
      );
    }

    // 左·历史方钮 borderRadius 9；右·新建会话圆钮 borderRadius 999。
    expectSoftButton(const Key('ai-appbar-history'), 9);
    expectSoftButton(const Key('ai-appbar-new-session'), 999);
  });

  testWidgets('顶栏标题字重：fontSize 14 / w700 / letterSpacing -0.2（#2015）',
      (WidgetTester tester) async {
    await _pump(tester);

    final Text title = tester.widget<Text>(find.text('BTC 趋势 · 双均线'));
    expect(title.style?.fontSize, 14);
    expect(title.style?.fontWeight, FontWeight.w700);
    expect(title.style?.letterSpacing, -0.2);
  });

  testWidgets('顶栏占位标题「AI」字重：fontSize 14 / w700 / letterSpacing -0.2（#2015）',
      (WidgetTester tester) async {
    // 占位标题仅在会话加载完成前（current == null）出现，故只 pump 首帧、
    // 不等 loadSessions 解析，覆盖与会话标题独立硬编码的占位样式分支。
    await tester.binding.setSurfaceSize(const Size(400, 1200));
    final GoRouter router = GoRouter(
      initialLocation: '/ai',
      routes: <RouteBase>[
        GoRoute(
          path: '/ai',
          builder: (BuildContext context, GoRouterState state) =>
              const AiHomePage(),
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

    final Text placeholder = tester.widget<Text>(find.text('AI'));
    expect(placeholder.style?.fontSize, 14);
    expect(placeholder.style?.fontWeight, FontWeight.w700);
    expect(placeholder.style?.letterSpacing, -0.2);

    // 排空 postFrame loadSessions（50ms）定时器，避免 dispose 时残留 pending timer。
    await tester.pump(const Duration(milliseconds: 100));
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
