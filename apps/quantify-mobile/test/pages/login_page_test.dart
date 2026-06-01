import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/auth/session_controller.dart';
import 'package:quantify_mobile/data/mock/mock_auth_repository.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/auth_repository.dart';
import 'package:quantify_mobile/data/storage/secure_token_storage.dart';
import 'package:quantify_mobile/data/models/auth_models.dart';
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

class _FailingCodeAuthRepository extends MockAuthRepository {
  @override
  Future<AuthSession> loginWithCode({
    required String email,
    required String code,
  }) async {
    throw StateError('mock code rejected');
  }
}

Future<({ProviderContainer container, InMemoryTokenStorage storage})>
_pumpLogin(
  WidgetTester tester, {
  InMemoryTokenStorage? storage,
  AuthRepository? authRepository,
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
      authRepositoryProvider.overrideWithValue(
        authRepository ?? MockAuthRepository(),
      ),
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
  testWidgets('LoginPage 渲染品牌占位 + 邮箱/验证码字段 + 两个按钮', (
    WidgetTester tester,
  ) async {
    await _pumpLogin(tester);
    expect(find.byKey(const ValueKey<String>('login-brand')), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('login-email-field')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('login-code-field')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('login-send-code')),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey<String>('login-submit')), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('login-telegram')),
      findsOneWidget,
    );
  });

  testWidgets('点击登录但邮箱格式不正确 → 显示错误，不跳转', (WidgetTester tester) async {
    await _pumpLogin(tester);
    await tester.enterText(
      find.byKey(const ValueKey<String>('login-email-field')),
      'not-an-email',
    );
    await tester.enterText(
      find.byKey(const ValueKey<String>('login-code-field')),
      '123456',
    );
    await tester.tap(find.byKey(const ValueKey<String>('login-submit')));
    await tester.pumpAndSettle();

    expect(find.text('邮箱格式不正确'), findsOneWidget);
    expect(find.text('AI_HOME_PLACEHOLDER'), findsNothing);
  });

  testWidgets('验证码不足 6 位 → 显示错误', (WidgetTester tester) async {
    await _pumpLogin(tester);
    await tester.enterText(
      find.byKey(const ValueKey<String>('login-email-field')),
      'a@b.com',
    );
    await tester.enterText(
      find.byKey(const ValueKey<String>('login-code-field')),
      '123',
    );
    await tester.tap(find.byKey(const ValueKey<String>('login-submit')));
    await tester.pumpAndSettle();

    expect(find.text('验证码必须为 6 位'), findsOneWidget);
    expect(find.text('AI_HOME_PLACEHOLDER'), findsNothing);
  });

  testWidgets('空验证码 → 显示错误', (WidgetTester tester) async {
    await _pumpLogin(tester);
    await tester.enterText(
      find.byKey(const ValueKey<String>('login-email-field')),
      'a@b.com',
    );
    await tester.tap(find.byKey(const ValueKey<String>('login-submit')));
    await tester.pumpAndSettle();

    expect(find.text('请输入验证码'), findsOneWidget);
    expect(find.text('AI_HOME_PLACEHOLDER'), findsNothing);
  });

  testWidgets('发送验证码按钮进入倒计时并结束后可重发', (WidgetTester tester) async {
    await _pumpLogin(tester);
    await tester.enterText(
      find.byKey(const ValueKey<String>('login-email-field')),
      'me@quantify.dev',
    );

    final Finder send = find.byKey(const ValueKey<String>('login-send-code'));
    await tester.tap(send);
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('60s 后重发'), findsOneWidget);

    await tester.pump(const Duration(seconds: 1));
    expect(find.text('59s 后重发'), findsOneWidget);

    await tester.pump(const Duration(seconds: 59));
    expect(find.text('重新发送'), findsOneWidget);
  });

  testWidgets('合法表单 → mock 登录成功 → 跳 /ai + token 写盘', (
    WidgetTester tester,
  ) async {
    final (:ProviderContainer container, :InMemoryTokenStorage storage) =
        await _pumpLogin(tester);

    await tester.enterText(
      find.byKey(const ValueKey<String>('login-email-field')),
      'me@quantify.dev',
    );
    await tester.enterText(
      find.byKey(const ValueKey<String>('login-code-field')),
      '123456',
    );
    await tester.tap(find.byKey(const ValueKey<String>('login-send-code')));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.tap(find.byKey(const ValueKey<String>('login-submit')));
    await tester.pumpAndSettle();

    expect(find.text('AI_HOME_PLACEHOLDER'), findsOneWidget);
    expect(storage.snapshot.containsKey(kSessionStorageKey), isTrue);
    expect(
      container.read(sessionControllerProvider).valueOrNull?.email,
      'me@quantify.dev',
    );
  });

  testWidgets('验证码登录失败 → 弹 SnackBar，不跳转', (WidgetTester tester) async {
    await _pumpLogin(tester, authRepository: _FailingCodeAuthRepository());

    await tester.enterText(
      find.byKey(const ValueKey<String>('login-email-field')),
      'me@quantify.dev',
    );
    await tester.enterText(
      find.byKey(const ValueKey<String>('login-code-field')),
      '123456',
    );
    await tester.tap(find.byKey(const ValueKey<String>('login-send-code')));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.tap(find.byKey(const ValueKey<String>('login-submit')));
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.textContaining('登录失败：'), findsOneWidget);
    expect(find.text('AI_HOME_PLACEHOLDER'), findsNothing);
  });

  testWidgets('Telegram 按钮 → mock 登录 → 跳 /ai', (WidgetTester tester) async {
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

  testWidgets('hero 区域渲染品牌 Logo + 大标题 + 副标题', (WidgetTester tester) async {
    await _pumpLogin(tester);
    expect(find.byKey(const ValueKey<String>('login-hero')), findsOneWidget);
    expect(find.byKey(const ValueKey<String>('login-brand')), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('login-hero-title-1')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('login-hero-title-2')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('login-hero-subtitle')),
      findsOneWidget,
    );
    expect(find.text('把交易想法'), findsOneWidget);
    expect(find.text('变成可回测的策略'), findsOneWidget);
    expect(find.text('对话生成 · 历史回测 · API 部署'), findsOneWidget);
  });

  testWidgets('表单区显示「欢迎回来」+「使用邮箱或 Telegram 继续」副标题', (
    WidgetTester tester,
  ) async {
    await _pumpLogin(tester);
    expect(
      find.byKey(const ValueKey<String>('login-welcome-title')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('login-welcome-subtitle')),
      findsOneWidget,
    );
    expect(find.text('欢迎回来'), findsOneWidget);
    expect(find.text('使用邮箱或 Telegram 继续'), findsOneWidget);
  });

  testWidgets('动作栈锚定底部拇指区', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await _pumpLogin(tester);
    final Finder actions = find.byKey(
      const ValueKey<String>('login-actions-stack'),
    );
    expect(actions, findsOneWidget);

    final Offset topLeft = tester.getTopLeft(actions);
    final Size size = tester.getSize(actions);
    final double bottom = topLeft.dy + size.height;
    expect(bottom, lessThanOrEqualTo(844));
    expect(bottom, greaterThanOrEqualTo(780));
  });

  testWidgets('输入框使用外置 label 和填充框形态', (WidgetTester tester) async {
    await _pumpLogin(tester);
    expect(
      find.byKey(const ValueKey<String>('login-email-label')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('login-code-label')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('login-email-field-shell')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('login-code-field-shell')),
      findsOneWidget,
    );
  });

  testWidgets('Telegram 按钮使用品牌圆形 logo', (WidgetTester tester) async {
    await _pumpLogin(tester);
    expect(
      find.byKey(const ValueKey<String>('login-telegram-logo')),
      findsOneWidget,
    );
  });

  testWidgets('登录页不显示忘记密码链接', (WidgetTester tester) async {
    await _pumpLogin(tester);
    final Finder forgot = find.byKey(
      const ValueKey<String>('login-forgot-password'),
    );
    expect(forgot, findsNothing);
    expect(find.text('忘记?'), findsNothing);
  });

  testWidgets('登录页不显示游客入口', (WidgetTester tester) async {
    await _pumpLogin(tester);
    final Finder guest = find.byKey(const ValueKey<String>('login-guest'));
    expect(guest, findsNothing);
    expect(find.text('以游客身份先看看'), findsNothing);
    expect(find.text('· 无需注册'), findsNothing);
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

  testWidgets('点击服务条款 link → 弹 SnackBar，不跳转', (WidgetTester tester) async {
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

  testWidgets('点击隐私政策 link → 弹 SnackBar，不跳转', (WidgetTester tester) async {
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

  testWidgets('登录页底部拇指区与输入框形态 golden', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await _pumpLogin(tester);

    await expectLater(
      find.byType(LoginPage),
      matchesGoldenFile('goldens/login_page.png'),
    );
  });
}
