import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/auth/session_controller.dart';
import 'package:quantify_mobile/data/mock/mock_auth_repository.dart';
import 'package:quantify_mobile/data/models/auth_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/storage/secure_token_storage.dart';
import 'package:quantify_mobile/main.dart';
import 'package:quantify_mobile/pages/_dev/components_preview_page.dart';
import 'package:quantify_mobile/pages/_dev/theme_preview_page.dart';
import 'package:quantify_mobile/pages/ai/ai_confirm_page.dart';
import 'package:quantify_mobile/pages/ai/ai_home_page.dart';
import 'package:quantify_mobile/pages/ai/backtest_config_sheet.dart';
import 'package:quantify_mobile/pages/auth/login_page.dart';
import 'package:quantify_mobile/pages/market/data_hub_page.dart';
import 'package:quantify_mobile/pages/market/market_detail_page.dart';
import 'package:quantify_mobile/pages/market/widgets/data_hub_header.dart';
import 'package:quantify_mobile/pages/live/live_strategies_page.dart';
import 'package:quantify_mobile/pages/me/me_home_page.dart';
import 'package:quantify_mobile/pages/me/theme_settings_page.dart';
import 'package:quantify_mobile/pages/strategy/strategy_home_page.dart';
import 'package:quantify_mobile/pages/whale/whale_home_page.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/widgets/qz_bottom_tab_bar.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Pumps the app and navigates to `/ai` to bypass the debug-only landing
/// (`/_dev/theme-preview`). Returns a [BuildContext] anchored on the AI page.
Future<BuildContext> _pumpApp(
  WidgetTester tester, {
  InMemoryTokenStorage? storage,
}) async {
  SharedPreferences.setMockInitialValues(<String, Object>{});
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  final InMemoryTokenStorage s = storage ?? InMemoryTokenStorage();
  final ProviderContainer container = ProviderContainer(
    overrides: <Override>[
      sharedPreferencesProvider.overrideWithValue(prefs),
      tokenStorageProvider.overrideWithValue(s),
      authRepositoryProvider.overrideWithValue(MockAuthRepository()),
    ],
  );
  await container.read(sessionControllerProvider.future);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: const QuantifyMobileApp(),
    ),
  );
  await tester.pumpAndSettle();
  // Default initial route is /login (公开浏览也需先穿过登录页跳转）。测试场景
  // 需要直接落到 /ai，借 Navigator context 调 GoRouter.go。
  final BuildContext bootCtx = tester.element(find.byType(Navigator).first);
  GoRouter.of(bootCtx).go('/ai');
  await tester.pumpAndSettle();
  return tester.element(find.byType(AiHomePage));
}

/// Locates a bottom-tab icon by stable ValueKey instead of icon constant —
/// keeps tests resilient against future icon swaps.
Finder _tab(String name) => find.byKey(ValueKey<String>('tab-$name'));

/// 构造一份已登录的 InMemoryTokenStorage，用来绕过 `/me*` 守卫。
InMemoryTokenStorage _loggedInStorage() {
  final AuthSession seed = AuthSession(
    userId: 'u',
    token: 't',
    email: 'a@b.com',
  );
  return InMemoryTokenStorage(<String, String>{
    kSessionStorageKey: jsonEncode(seed.toMap()),
  });
}

void main() {
  testWidgets('5 tabs render and switch via bottom bar', (
    WidgetTester tester,
  ) async {
    // /me 受守卫保护 → 需要预登录 session 才能切到 me tab。
    await _pumpApp(tester, storage: _loggedInStorage());
    expect(find.byType(AiHomePage), findsOneWidget);

    await tester.tap(_tab('market'));
    await tester.pumpAndSettle();
    expect(find.byType(DataHubPage), findsOneWidget);

    await tester.tap(_tab('strategy'));
    await tester.pumpAndSettle();
    expect(find.byType(StrategyHomePage), findsOneWidget);

    await tester.tap(_tab('whale'));
    await tester.pumpAndSettle();
    expect(find.byType(WhaleHomePage), findsOneWidget);

    await tester.tap(_tab('me'));
    await tester.pumpAndSettle();
    expect(find.byType(MeHomePage), findsOneWidget);
  });

  testWidgets('bottom-bar index → page mapping is ai/market/strategy/whale/me',
      (WidgetTester tester) async {
    // Source-of-truth guard for issue #1637: lock the router branch order so
    // reshuffling branches in `app_router.dart` (or tab order in
    // `QzBottomTabBar`) trips this test, not just runtime UX.
    await _pumpApp(tester, storage: _loggedInStorage());

    const List<String> keys = <String>[
      'tab-ai',
      'tab-market',
      'tab-strategy',
      'tab-whale',
      'tab-me',
    ];
    final List<Type> expectedPages = <Type>[
      AiHomePage,
      DataHubPage,
      StrategyHomePage,
      WhaleHomePage,
      MeHomePage,
    ];

    for (int i = 0; i < keys.length; i++) {
      await tester.tap(_tab(keys[i].substring('tab-'.length)));
      await tester.pumpAndSettle();
      expect(
        find.byType(expectedPages[i]),
        findsOneWidget,
        reason: 'tab index $i (key=${keys[i]}) must land on ${expectedPages[i]}',
      );
    }
  });

  testWidgets('branch state is preserved across tab switch', (
    WidgetTester tester,
  ) async {
    await _pumpApp(tester);

    // AiHomePage 输入框草稿在 tab 切换时应被 IndexedStack 保留 — 通过
    // chat input 写入一段草稿，再来回切换，验证 branch state 不丢。
    final Finder input = find.byKey(const Key('ai-chat-input'));
    await tester.enterText(input, 'draft-preserve-1590');
    await tester.pump();
    expect(find.text('draft-preserve-1590'), findsOneWidget);

    // Switch to market and back; input draft should survive.
    await tester.tap(_tab('market'));
    await tester.pumpAndSettle();
    expect(find.byType(DataHubPage), findsOneWidget);

    await tester.tap(_tab('ai'));
    await tester.pumpAndSettle();
    expect(find.byType(AiHomePage), findsOneWidget);
    expect(find.text('draft-preserve-1590'), findsOneWidget);
  });

  testWidgets('tapping the active tab is safe (initialLocation path)', (
    WidgetTester tester,
  ) async {
    // Guards the `initialLocation: i == currentIndex` branch in
    // MainShellScaffold.onTap. Each tab branch currently holds a single
    // route, so re-tapping is a no-op visually — but the call must not
    // throw. Once a tab grows sub-routes (later PRs), this same test will
    // start asserting "pop to branch root" behavior.
    await _pumpApp(tester);
    expect(find.byType(AiHomePage), findsOneWidget);

    await tester.tap(_tab('ai'));
    await tester.pumpAndSettle();
    expect(find.byType(AiHomePage), findsOneWidget);

    await tester.tap(_tab('market'));
    await tester.pumpAndSettle();
    await tester.tap(_tab('market')); // tap active tab
    await tester.pumpAndSettle();
    expect(find.byType(DataHubPage), findsOneWidget);
  });

  testWidgets('push /login covers the bottom tab bar', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).push('/login');
    await tester.pumpAndSettle();

    expect(find.byType(LoginPage), findsOneWidget);
    expect(find.byType(QzBottomTabBar), findsNothing);
  });

  testWidgets('/market/long-short resolves to DataHubPage (not :symbol)', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).push('/market/long-short');
    // 不用 pumpAndSettle：hub 内 MarketHomeBody 的 mock kline 流式 Timer 永不静默。
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));

    expect(find.byType(DataHubPage), findsOneWidget);
    expect(find.byType(MarketDetailPage), findsNothing);
    // 深链预选多空比 tab（#1853）。
    final DataHubPage page =
        tester.widget<DataHubPage>(find.byType(DataHubPage));
    expect(page.initial, DataHubScreen.longShort);
  });

  testWidgets('/market/BTCUSDT resolves to MarketDetailPage', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).push('/market/BTCUSDT');
    await tester.pumpAndSettle();

    expect(find.byType(MarketDetailPage), findsOneWidget);
    // MarketDetailPage 当前以 symbol 本身作为页面标题（见 market_detail_page.dart：
    // `title: widget.symbol`），故断言文案与之保持一致；旧的「行情详情：BTCUSDT」
    // 字面量已随页面重构移除。
    expect(find.text('BTCUSDT'), findsWidgets);
  });

  testWidgets('/ai/backtest-config resolves to BacktestConfigSheet', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).push('/ai/backtest-config');
    await tester.pumpAndSettle();

    expect(find.byType(BacktestConfigSheet), findsOneWidget);
  });

  testWidgets('/ai/confirm resolves to AiConfirmPage（#1832 确认策略屏）', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).push('/ai/confirm');
    await tester.pumpAndSettle();

    expect(find.byType(AiConfirmPage), findsOneWidget);
    // 顶栏标题 + 参数确认卡 + 脚本预览 + 下一步 CTA 均渲染。
    expect(find.text('确认策略'), findsWidgets);
    expect(find.byKey(const Key('ai-confirm-params')), findsOneWidget);
    expect(find.byKey(const Key('ai-confirm-copy-script')), findsOneWidget);
    expect(find.byKey(const Key('ai-confirm-next-cta')), findsOneWidget);
  });

  testWidgets('/ai/confirm 接收 extra 参数并渲染到参数卡', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).push(
      '/ai/confirm',
      extra: const <String, String>{
        'category': '网格',
        'fast_ma': '7',
        'slow_ma': '30',
      },
    );
    await tester.pumpAndSettle();

    expect(find.byType(AiConfirmPage), findsOneWidget);
    // extra 透传的 category 走普通 Text（chip），断言非 mock 兜底值「趋势跟踪」。
    expect(find.text('网格'), findsWidgets);
    expect(find.text('趋势跟踪'), findsNothing);
    // 参数表用 RichText（mono），断言其拼接文本含 extra 透传的 fast_ma=7。
    final Iterable<RichText> richTexts =
        tester.widgetList<RichText>(find.byType(RichText));
    final bool hasFastMa = richTexts.any((RichText rt) {
      final InlineSpan span = rt.text;
      return span.toPlainText().contains('fast_ma') &&
          span.toPlainText().contains('7');
    });
    expect(hasFastMa, isTrue,
        reason: 'extra 透传的 fast_ma=7 应渲染到参数卡 RichText');
  });

  test('/me/api 已下线（issue #1648）→ router 不再注册该路径', () {
    // API 配置入口统一为 bottom sheet（me_home + deploy sheet 均直接打开
    // `showApiFormSheet`），独立列表页 `/me/api` 已移除。守护这条测试，
    // 避免未来误恢复路由造成入口双轨。
    final String source =
        File('lib/router/app_router.dart').readAsStringSync();
    expect(
      source.contains("path: '/me/api'"),
      isFalse,
      reason: '/me/api 已下线，不应在 router 中重新注册',
    );
    expect(
      source.contains('ApiSettingsPage'),
      isFalse,
      reason: 'ApiSettingsPage 已删除，不应被 router 引用',
    );
  });

  testWidgets('/me/theme resolves to ThemeSettingsPage', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(
      tester,
      storage: _loggedInStorage(),
    );
    GoRouter.of(ctx).push('/me/theme');
    await tester.pumpAndSettle();

    expect(find.byType(ThemeSettingsPage), findsOneWidget);
  });

  testWidgets('/me/live resolves to LiveStrategiesPage（已登录）', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(
      tester,
      storage: _loggedInStorage(),
    );
    GoRouter.of(ctx).push('/me/live');
    await tester.pumpAndSettle();
    expect(find.byType(LiveStrategiesPage), findsOneWidget);
  });

  testWidgets('未登录访问 /me/live 重定向到 /login（#1752 受守卫）', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).go('/me/live');
    await tester.pumpAndSettle();
    expect(find.byType(LoginPage), findsOneWidget);
    expect(find.byType(LiveStrategiesPage), findsNothing);
  });

  testWidgets('未登录首次启动落在 /login', (WidgetTester tester) async {
    // Verifies issue #1586 acceptance criterion: default landing is /login,
    // not /_dev/theme-preview, even in debug builds.
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final ProviderContainer c = ProviderContainer(
      overrides: <Override>[
        sharedPreferencesProvider.overrideWithValue(prefs),
        tokenStorageProvider.overrideWithValue(InMemoryTokenStorage()),
        authRepositoryProvider.overrideWithValue(MockAuthRepository()),
      ],
    );
    await c.read(sessionControllerProvider.future);
    await tester.pumpWidget(
      UncontrolledProviderScope(container: c, child: const QuantifyMobileApp()),
    );
    await tester.pumpAndSettle();
    expect(find.byType(LoginPage), findsOneWidget);
    expect(find.byType(ThemePreviewPage), findsNothing);
  });

  testWidgets('/_dev/theme-preview 仍可通过显式路径打开', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).go('/_dev/theme-preview');
    await tester.pumpAndSettle();
    expect(find.byType(ThemePreviewPage), findsOneWidget);
  });

  testWidgets('/_dev/components-preview resolves to ComponentsPreviewPage', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    ctx.go('/_dev/components-preview');
    // Do not pumpAndSettle: the preview page renders QzSpinner whose
    // CircularProgressIndicator animates forever. A single frame commits the
    // GoRouter transition; the second 350 ms pump is just over the default
    // GoRouter cupertino/material transition (≈ 300 ms) so the new page
    // becomes the front-most route before we assert.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));
    expect(find.byType(ComponentsPreviewPage), findsOneWidget);
  });

  testWidgets('theme-preview screen exposes a link to components-preview', (
    WidgetTester tester,
  ) async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final ProviderContainer c = ProviderContainer(
      overrides: <Override>[
        sharedPreferencesProvider.overrideWithValue(prefs),
        tokenStorageProvider.overrideWithValue(InMemoryTokenStorage()),
        authRepositoryProvider.overrideWithValue(MockAuthRepository()),
      ],
    );
    await c.read(sessionControllerProvider.future);
    await tester.pumpWidget(
      UncontrolledProviderScope(container: c, child: const QuantifyMobileApp()),
    );
    await tester.pumpAndSettle();
    // 默认 landing 已切到 /login（见 issue #1586），所以这里显式跳到主题预览。
    final BuildContext bootCtx = tester.element(find.byType(Navigator).first);
    GoRouter.of(bootCtx).go('/_dev/theme-preview');
    await tester.pumpAndSettle();
    // The link sits below the sample cards inside a ListView, so scroll
    // before asserting visibility.
    final Finder linkFinder = find.byKey(
      const ValueKey<String>('dev-link-components-preview'),
    );
    await tester.scrollUntilVisible(linkFinder, 200);
    expect(linkFinder, findsOneWidget);
  });

  testWidgets('未登录访问 /me 重定向到 /login', (WidgetTester tester) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).go('/me');
    await tester.pumpAndSettle();
    expect(find.byType(LoginPage), findsOneWidget);
    expect(find.byType(MeHomePage), findsNothing);
  });

  testWidgets('已登录直接访问 /me 不被拦', (WidgetTester tester) async {
    final AuthSession seed = AuthSession(
      userId: 'u',
      token: 't',
      email: 'a@b.com',
    );
    final InMemoryTokenStorage storage = InMemoryTokenStorage(<String, String>{
      kSessionStorageKey: jsonEncode(seed.toMap()),
    });
    final BuildContext ctx = await _pumpApp(tester, storage: storage);
    GoRouter.of(ctx).go('/me');
    await tester.pumpAndSettle();
    expect(find.byType(MeHomePage), findsOneWidget);
    expect(find.byType(LoginPage), findsNothing);
  });

  testWidgets('登出后再访问 /me 弹回 /login', (WidgetTester tester) async {
    final AuthSession seed = AuthSession(
      userId: 'u',
      token: 't',
      email: 'a@b.com',
    );
    final InMemoryTokenStorage storage = InMemoryTokenStorage(<String, String>{
      kSessionStorageKey: jsonEncode(seed.toMap()),
    });
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final ProviderContainer container = ProviderContainer(
      overrides: <Override>[
        sharedPreferencesProvider.overrideWithValue(prefs),
        tokenStorageProvider.overrideWithValue(storage),
        authRepositoryProvider.overrideWithValue(MockAuthRepository()),
      ],
    );
    await container.read(sessionControllerProvider.future);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const QuantifyMobileApp(),
      ),
    );
    await tester.pumpAndSettle();
    final BuildContext ctx = tester.element(find.byType(Navigator).first);
    GoRouter.of(ctx).go('/me');
    await tester.pumpAndSettle();
    expect(find.byType(MeHomePage), findsOneWidget);

    await container.read(sessionControllerProvider.notifier).logout();
    await tester.pumpAndSettle();
    expect(find.byType(LoginPage), findsOneWidget);
    expect(find.byType(MeHomePage), findsNothing);
  });
}
