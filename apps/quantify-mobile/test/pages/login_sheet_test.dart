import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/auth/session_controller.dart';
import 'package:quantify_mobile/data/mock/mock_auth_repository.dart';
import 'package:quantify_mobile/data/models/auth_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/auth_repository.dart';
import 'package:quantify_mobile/data/storage/secure_token_storage.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/auth/login_sheet.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
_pumpSheetHarness(WidgetTester tester, {AuthRepository? authRepository}) async {
  SharedPreferences.setMockInitialValues(<String, Object>{});
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  final InMemoryTokenStorage storage = InMemoryTokenStorage();
  final ProviderContainer container = ProviderContainer(
    overrides: <Override>[
      sharedPreferencesProvider.overrideWithValue(prefs),
      tokenStorageProvider.overrideWithValue(storage),
      authRepositoryProvider.overrideWithValue(
        authRepository ?? MockAuthRepository(),
      ),
    ],
  );
  await container.read(sessionControllerProvider.future);

  final GoRouter router = GoRouter(
    initialLocation: '/',
    routes: <RouteBase>[
      GoRoute(
        path: '/',
        builder: (BuildContext context, GoRouterState state) => Scaffold(
          body: Center(
            child: FilledButton(
              key: const Key('open-login-sheet'),
              onPressed: () => showLoginSheet(context),
              child: const Text('OPEN'),
            ),
          ),
        ),
      ),
      GoRoute(
        path: '/ai',
        builder: (BuildContext context, GoRouterState state) =>
            const _AiPlaceholder(),
      ),
    ],
  );

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
  await tester.tap(find.byKey(const Key('open-login-sheet')));
  await tester.pumpAndSettle();
  return (container: container, storage: storage);
}

void main() {
  testWidgets('LoginSheet renders sheet heading, close, form and actions', (
    WidgetTester tester,
  ) async {
    await _pumpSheetHarness(tester);

    expect(find.byKey(const Key('login-sheet')), findsOneWidget);
    expect(find.byKey(const Key('login-sheet-handle')), findsOneWidget);
    expect(find.byKey(const Key('login-sheet-close')), findsOneWidget);
    expect(find.text('登录 Quantify'), findsOneWidget);
    expect(find.text('邮箱或 Telegram 继续'), findsOneWidget);
    expect(find.byKey(const Key('login-email-field')), findsOneWidget);
    expect(find.byKey(const Key('login-code-field')), findsOneWidget);
    expect(find.text('或'), findsOneWidget);
  });

  testWidgets('LoginSheet form controls avoid inner white fills', (
    WidgetTester tester,
  ) async {
    final (:ProviderContainer container, :InMemoryTokenStorage storage) =
        await _pumpSheetHarness(tester);
    expect(storage.snapshot, isEmpty);

    final InputDecorator emailInput = tester.widget<InputDecorator>(
      find.descendant(
        of: find.byKey(const Key('login-email-field')),
        matching: find.byType(InputDecorator),
      ),
    );
    final InputDecorator codeInput = tester.widget<InputDecorator>(
      find.descendant(
        of: find.byKey(const Key('login-code-field')),
        matching: find.byType(InputDecorator),
      ),
    );

    expect(emailInput.decoration.filled, isFalse);
    expect(emailInput.decoration.fillColor, Colors.transparent);
    expect(codeInput.decoration.filled, isFalse);
    expect(codeInput.decoration.fillColor, Colors.transparent);

    final OutlinedButton sendCodeButton = tester.widget<OutlinedButton>(
      find.descendant(
        of: find.byKey(const Key('login-send-code')),
        matching: find.byType(OutlinedButton),
      ),
    );
    expect(
      sendCodeButton.style?.backgroundColor?.resolve(<WidgetState>{}),
      qzColors(
        container.read(themeProvider).bg,
        container.read(themeProvider).accent,
      ).accentSoft,
    );
  });

  testWidgets('LoginSheet send code countdown starts at 58', (
    WidgetTester tester,
  ) async {
    await _pumpSheetHarness(tester);
    await tester.enterText(
      find.byKey(const Key('login-email-field')),
      'me@quantify.dev',
    );

    await tester.tap(find.byKey(const Key('login-send-code')));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('58s 后重发'), findsOneWidget);

    await tester.pump(const Duration(seconds: 1));
    expect(find.text('57s 后重发'), findsOneWidget);

    // 倒计时 Timer 现由 controller 持有，关闭 sheet → provider autoDispose →
    // `ref.onDispose` 取消 Timer（issue #2187 验收：无 dispose 后残留计时器）。
    await tester.tap(find.byKey(const Key('login-sheet-close')));
    await tester.pumpAndSettle();
  });

  testWidgets('LoginSheet email login closes sheet before going to /ai', (
    WidgetTester tester,
  ) async {
    final (:ProviderContainer container, :InMemoryTokenStorage storage) =
        await _pumpSheetHarness(tester);

    await tester.enterText(
      find.byKey(const Key('login-email-field')),
      'me@quantify.dev',
    );
    await tester.enterText(find.byKey(const Key('login-code-field')), '123456');
    await tester.tap(find.byKey(const Key('login-send-code')));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.tap(find.byKey(const Key('login-submit')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('login-sheet')), findsNothing);
    expect(find.text('AI_HOME_PLACEHOLDER'), findsOneWidget);
    expect(storage.snapshot.containsKey(kSessionStorageKey), isTrue);
    expect(
      container.read(sessionControllerProvider).value?.email,
      'me@quantify.dev',
    );
  });

  testWidgets('LoginSheet close button dismisses without navigation', (
    WidgetTester tester,
  ) async {
    await _pumpSheetHarness(tester);
    await tester.tap(find.byKey(const Key('login-sheet-close')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('login-sheet')), findsNothing);
    expect(find.text('AI_HOME_PLACEHOLDER'), findsNothing);
  });

  testWidgets('LoginSheet failed login keeps sheet open', (
    WidgetTester tester,
  ) async {
    await _pumpSheetHarness(
      tester,
      authRepository: _FailingCodeAuthRepository(),
    );
    await tester.enterText(
      find.byKey(const Key('login-email-field')),
      'me@quantify.dev',
    );
    await tester.enterText(find.byKey(const Key('login-code-field')), '123456');
    await tester.tap(find.byKey(const Key('login-submit')));
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.byKey(const Key('login-sheet')), findsOneWidget);
    expect(find.textContaining('登录失败：'), findsOneWidget);
    expect(find.text('AI_HOME_PLACEHOLDER'), findsNothing);
  });
}
