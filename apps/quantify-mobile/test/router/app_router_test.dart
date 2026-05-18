import 'dart:convert';

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
import 'package:quantify_mobile/pages/ai/ai_home_page.dart';
import 'package:quantify_mobile/pages/ai/backtest_config_sheet.dart';
import 'package:quantify_mobile/pages/auth/login_page.dart';
import 'package:quantify_mobile/pages/market/long_short_page.dart';
import 'package:quantify_mobile/pages/market/market_detail_page.dart';
import 'package:quantify_mobile/pages/market/market_home_page.dart';
import 'package:quantify_mobile/pages/me/api_settings_page.dart';
import 'package:quantify_mobile/pages/me/me_home_page.dart';
import 'package:quantify_mobile/pages/me/theme_settings_page.dart';
import 'package:quantify_mobile/pages/strategy/strategy_home_page.dart';
import 'package:quantify_mobile/pages/whale/whale_feed_page.dart';
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
  // Default initial route is /_dev/theme-preview in debug; navigate to /ai.
  // GoRouter.of needs a context *below* the Router widget — Navigator works.
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
    expect(find.byType(MarketHomePage), findsOneWidget);

    await tester.tap(_tab('whale'));
    await tester.pumpAndSettle();
    expect(find.byType(WhaleFeedPage), findsOneWidget);

    await tester.tap(_tab('strategy'));
    await tester.pumpAndSettle();
    expect(find.byType(StrategyHomePage), findsOneWidget);

    await tester.tap(_tab('me'));
    await tester.pumpAndSettle();
    expect(find.byType(MeHomePage), findsOneWidget);
  });

  testWidgets('branch state is preserved across tab switch', (
    WidgetTester tester,
  ) async {
    await _pumpApp(tester);

    // AiHomePage exposes a debug-only counter in its AppBar (cleared of the
    // floating bottom tab bar) so hit-test routing succeeds.
    final Finder incBtn = find.byKey(const Key('ai-counter-inc'));
    await tester.tap(incBtn);
    await tester.tap(incBtn);
    await tester.tap(incBtn);
    await tester.pump();
    expect(find.text('count: 3'), findsOneWidget);

    // Switch to market and back; counter state should survive.
    await tester.tap(_tab('market'));
    await tester.pumpAndSettle();
    expect(find.byType(MarketHomePage), findsOneWidget);

    await tester.tap(_tab('ai'));
    await tester.pumpAndSettle();
    expect(find.byType(AiHomePage), findsOneWidget);
    expect(find.text('count: 3'), findsOneWidget);
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
    expect(find.byType(MarketHomePage), findsOneWidget);
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

  testWidgets('/market/long-short resolves to LongShortPage (not :symbol)', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).push('/market/long-short');
    await tester.pumpAndSettle();

    expect(find.byType(LongShortPage), findsOneWidget);
    expect(find.byType(MarketDetailPage), findsNothing);
  });

  testWidgets('/market/BTCUSDT resolves to MarketDetailPage', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).push('/market/BTCUSDT');
    await tester.pumpAndSettle();

    expect(find.byType(MarketDetailPage), findsOneWidget);
    expect(find.text('行情详情：BTCUSDT'), findsWidgets);
  });

  testWidgets('/ai/backtest-config resolves to BacktestConfigSheet', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).push('/ai/backtest-config');
    await tester.pumpAndSettle();

    expect(find.byType(BacktestConfigSheet), findsOneWidget);
  });

  testWidgets('/me/api resolves to ApiSettingsPage', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(
      tester,
      storage: _loggedInStorage(),
    );
    GoRouter.of(ctx).push('/me/api');
    await tester.pumpAndSettle();

    expect(find.byType(ApiSettingsPage), findsOneWidget);
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

  testWidgets('/_dev/theme-preview is the debug-mode landing', (
    WidgetTester tester,
  ) async {
    // Tests run in debug; the initial route lands here before any go() call.
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

  testWidgets('未登录访问 /me/api 也被守卫拦回 /login', (WidgetTester tester) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).go('/me/api');
    await tester.pumpAndSettle();
    expect(find.byType(LoginPage), findsOneWidget);
    expect(find.byType(ApiSettingsPage), findsNothing);
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
