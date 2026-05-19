import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/auth/session_controller.dart';
import 'package:quantify_mobile/data/mock/mock_auth_repository.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/storage/secure_token_storage.dart';
import 'package:quantify_mobile/pages/auth/login_page.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 用最小 GoRouter 驱动登录页：`/login` 起点，`/ai` 用占位页接住，
/// 这样 `context.go('/ai')` 后我们可以断言"已离开登录页"。
class _AiPlaceholder extends StatelessWidget {
  const _AiPlaceholder();
  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: Text('AI_HOME_PLACEHOLDER')));
}

Future<({ProviderContainer container, InMemoryTokenStorage storage})>
_pumpLogin(
  WidgetTester tester, {
  InMemoryTokenStorage? storage,
}) async {
  SharedPreferences.setMockInitialValues(<String, Object>{});
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  final InMemoryTokenStorage s = storage ?? InMemoryTokenStorage();

  final GoRouter router = GoRouter(
    initialLocation: '/login',
    routes: <RouteBase>[
      GoRoute(
        path: '/login',
        builder: (BuildContext context, GoRouterState state) =>
            const LoginPage(),
      ),
      GoRoute(
        path: '/ai',
        builder: (BuildContext context, GoRouterState state) =>
            const _AiPlaceholder(),
      ),
    ],
  );

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
      child: MaterialApp.router(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(container.read(themeProvider)),
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return (container: container, storage: s);
}

void main() {
  testWidgets('LoginPage 渲染品牌占位 + 邮箱/密码字段 + 两个按钮',
      (WidgetTester tester) async {
    await _pumpLogin(tester);
    expect(find.byKey(const ValueKey<String>('login-brand')), findsOneWidget);
    expect(find.byKey(const ValueKey<String>('login-email-field')),
        findsOneWidget);
    expect(find.byKey(const ValueKey<String>('login-password-field')),
        findsOneWidget);
    expect(find.byKey(const ValueKey<String>('login-submit')), findsOneWidget);
    expect(find.byKey(const ValueKey<String>('login-telegram')), findsOneWidget);
  });

  testWidgets('点击登录但邮箱格式不正确 → 显示错误，不跳转',
      (WidgetTester tester) async {
    await _pumpLogin(tester);
    await tester.enterText(
      find.byKey(const ValueKey<String>('login-email-field')),
      'not-an-email',
    );
    await tester.enterText(
      find.byKey(const ValueKey<String>('login-password-field')),
      'pwpwpw',
    );
    await tester.tap(find.byKey(const ValueKey<String>('login-submit')));
    await tester.pumpAndSettle();

    expect(find.text('邮箱格式不正确'), findsOneWidget);
    expect(find.text('AI_HOME_PLACEHOLDER'), findsNothing);
  });

  testWidgets('密码不足 6 位 → 显示错误', (WidgetTester tester) async {
    await _pumpLogin(tester);
    await tester.enterText(
      find.byKey(const ValueKey<String>('login-email-field')),
      'a@b.com',
    );
    await tester.enterText(
      find.byKey(const ValueKey<String>('login-password-field')),
      '123',
    );
    await tester.tap(find.byKey(const ValueKey<String>('login-submit')));
    await tester.pumpAndSettle();

    expect(find.text('密码至少 6 位'), findsOneWidget);
    expect(find.text('AI_HOME_PLACEHOLDER'), findsNothing);
  });

  testWidgets('合法表单 → mock 登录成功 → 跳 /ai + token 写盘',
      (WidgetTester tester) async {
    final (:ProviderContainer container, :InMemoryTokenStorage storage) =
        await _pumpLogin(tester);

    await tester.enterText(
      find.byKey(const ValueKey<String>('login-email-field')),
      'me@quantify.dev',
    );
    await tester.enterText(
      find.byKey(const ValueKey<String>('login-password-field')),
      'pwpwpw',
    );
    await tester.tap(find.byKey(const ValueKey<String>('login-submit')));
    await tester.pumpAndSettle();

    expect(find.text('AI_HOME_PLACEHOLDER'), findsOneWidget);
    expect(storage.snapshot.containsKey(kSessionStorageKey), isTrue);
    expect(
      container.read(sessionControllerProvider).valueOrNull?.email,
      'me@quantify.dev',
    );
  });

  testWidgets('Telegram 按钮 → mock 登录 → 跳 /ai',
      (WidgetTester tester) async {
    final (:ProviderContainer container, :InMemoryTokenStorage storage) =
        await _pumpLogin(tester);
    final Finder tg = find.byKey(const ValueKey<String>('login-telegram'));
    await tester.ensureVisible(tg);
    await tester.pumpAndSettle();
    await tester.tap(tg);
    await tester.pumpAndSettle();

    expect(find.text('AI_HOME_PLACEHOLDER'), findsOneWidget);
    expect(storage.snapshot.containsKey(kSessionStorageKey), isTrue);
    expect(
      container.read(sessionControllerProvider).valueOrNull?.email,
      kTelegramMockEmail,
    );
  });

  testWidgets('hero 区域渲染品牌 Logo + 大标题 + 副标题',
      (WidgetTester tester) async {
    await _pumpLogin(tester);
    expect(find.byKey(const ValueKey<String>('login-hero')), findsOneWidget);
    expect(find.byKey(const ValueKey<String>('login-brand')), findsOneWidget);
    expect(find.byKey(const ValueKey<String>('login-hero-title-1')),
        findsOneWidget);
    expect(find.byKey(const ValueKey<String>('login-hero-title-2')),
        findsOneWidget);
    expect(find.byKey(const ValueKey<String>('login-hero-subtitle')),
        findsOneWidget);
    expect(find.text('把交易想法'), findsOneWidget);
    expect(find.text('变成可回测的策略'), findsOneWidget);
    expect(find.text('对话生成 · 历史回测 · API 部署'), findsOneWidget);
  });

  testWidgets('表单区显示「欢迎回来」+「使用邮箱或 Telegram 继续」副标题',
      (WidgetTester tester) async {
    await _pumpLogin(tester);
    expect(find.byKey(const ValueKey<String>('login-welcome-title')),
        findsOneWidget);
    expect(find.byKey(const ValueKey<String>('login-welcome-subtitle')),
        findsOneWidget);
    expect(find.text('欢迎回来'), findsOneWidget);
    expect(find.text('使用邮箱或 Telegram 继续'), findsOneWidget);
  });

  testWidgets('密码框右侧存在「忘记?」链接，点击不导致跳转',
      (WidgetTester tester) async {
    await _pumpLogin(tester);
    final Finder forgot =
        find.byKey(const ValueKey<String>('login-forgot-password'));
    expect(forgot, findsOneWidget);
    await tester.tap(forgot);
    await tester.pump(); // SnackBar 入场
    // 不应离开登录页
    expect(find.text('AI_HOME_PLACEHOLDER'), findsNothing);
  });

  testWidgets('游客按钮 → mock guest 登录 → 跳 /ai',
      (WidgetTester tester) async {
    final (:ProviderContainer container, :InMemoryTokenStorage storage) =
        await _pumpLogin(tester);
    final Finder guest = find.byKey(const ValueKey<String>('login-guest'));
    expect(guest, findsOneWidget);
    // hero 300px + 表单整体使按钮可能超出默认 800px 窗口，先滚到可见再点。
    await tester.ensureVisible(guest);
    await tester.pumpAndSettle();
    await tester.tap(guest);
    await tester.pumpAndSettle();

    expect(find.text('AI_HOME_PLACEHOLDER'), findsOneWidget);
    expect(storage.snapshot.containsKey(kSessionStorageKey), isTrue);
    expect(
      container.read(sessionControllerProvider).valueOrNull?.email,
      kGuestMockEmail,
    );
  });

  testWidgets('底部服务条款 / 隐私政策文字存在', (WidgetTester tester) async {
    await _pumpLogin(tester);
    final Finder terms = find.byKey(const ValueKey<String>('login-terms'));
    expect(terms, findsOneWidget);
    await tester.ensureVisible(terms);
    await tester.pumpAndSettle();
    expect(find.textContaining('服务条款'), findsOneWidget);
    expect(find.textContaining('隐私政策'), findsOneWidget);
  });

  testWidgets('点击服务条款 link → 弹 SnackBar，不跳转',
      (WidgetTester tester) async {
    await _pumpLogin(tester);
    final Finder terms = find.byKey(const ValueKey<String>('login-terms'));
    expect(terms, findsOneWidget);
    await tester.ensureVisible(terms);
    await tester.pumpAndSettle();
    // Text.rich 内的 TextSpan + TapGestureRecognizer 在 widget test 里没有
    // 独立 widget，无法直接 tapOnText 子串，借助 tester.tapOnText 的
    // textRange 接口定位「服务条款」TextSpan。
    await tester.tapOnText(find.textRange.ofSubstring('服务条款'));
    await tester.pump(); // SnackBar 入场
    // SnackBar 内容 == authLoginTermsLink
    expect(find.widgetWithText(SnackBar, '服务条款'), findsOneWidget);
    expect(find.text('AI_HOME_PLACEHOLDER'), findsNothing);
  });

  testWidgets('点击隐私政策 link → 弹 SnackBar，不跳转',
      (WidgetTester tester) async {
    await _pumpLogin(tester);
    final Finder terms = find.byKey(const ValueKey<String>('login-terms'));
    expect(terms, findsOneWidget);
    await tester.ensureVisible(terms);
    await tester.pumpAndSettle();
    await tester.tapOnText(find.textRange.ofSubstring('隐私政策'));
    await tester.pump();
    expect(find.widgetWithText(SnackBar, '隐私政策'), findsOneWidget);
    expect(find.text('AI_HOME_PLACEHOLDER'), findsNothing);
  });
}
