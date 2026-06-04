import 'package:fake_async/fake_async.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/auth/session_controller.dart';
import 'package:quantify_mobile/data/mock/mock_auth_repository.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/auth_repository.dart';
import 'package:quantify_mobile/data/storage/secure_token_storage.dart';
import 'package:quantify_mobile/pages/auth/login_sheet_controller.dart';
import 'package:quantify_mobile/pages/auth/login_sheet_state.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart'
    show sharedPreferencesProvider;
import 'package:riverpod/misc.dart' show Override;
import 'package:shared_preferences/shared_preferences.dart';

/// 发码失败的 AuthRepository：`sendLoginCode` 抛错，覆盖「发码失败落 error」路径。
class _FailingSendCodeRepository extends MockAuthRepository {
  @override
  Future<void> sendLoginCode({required String email}) async {
    throw StateError('mock send code failed');
  }
}

/// 发码瞬时成功的 AuthRepository：去掉延迟，便于 fakeAsync 精确驱动倒计时。
class _InstantSendCodeRepository extends MockAuthRepository {
  @override
  Future<void> sendLoginCode({required String email}) async {}
}

/// issue #2187 验收：`login_sheet` controller 发码成功→codeSent=true + 倒计时
/// 递减→归零、发码失败落 error（errorEpoch++）。
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<ProviderContainer> makeContainer({
    AuthRepository? authRepository,
  }) async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final ProviderContainer c = ProviderContainer(
      overrides: <Override>[
        sharedPreferencesProvider.overrideWithValue(prefs),
        tokenStorageProvider.overrideWithValue(InMemoryTokenStorage()),
        authRepositoryProvider.overrideWithValue(
          authRepository ?? MockAuthRepository(),
        ),
      ],
    );
    addTearDown(c.dispose);
    await c.read(sessionControllerProvider.future);
    // 订阅 autoDispose provider，防止 await 期间无监听者触发自动销毁。
    c.listen(loginSheetControllerProvider, (_, _) {});
    return c;
  }

  LoginSheetController ctrl(ProviderContainer c) =>
      c.read(loginSheetControllerProvider.notifier);
  LoginSheetState read(ProviderContainer c) =>
      c.read(loginSheetControllerProvider);

  group('LoginSheetController', () {
    test('初始态：全部 loading=false，未发码，倒计时 0，无错', () async {
      final ProviderContainer c = await makeContainer();
      final LoginSheetState s = read(c);
      expect(s.emailLoading, isFalse);
      expect(s.codeLoading, isFalse);
      expect(s.telegramLoading, isFalse);
      expect(s.codeSent, isFalse);
      expect(s.codeCountdown, 0);
      expect(s.errorMessage, isNull);
      expect(s.errorEpoch, 0);
      expect(s.busy, isFalse);
    });

    test('发码成功：codeSent=true 且倒计时起始 58', () async {
      final ProviderContainer c = await makeContainer();
      await ctrl(c).sendLoginCode(email: 'me@quantify.dev');
      final LoginSheetState s = read(c);
      expect(s.codeSent, isTrue);
      expect(s.codeCountdown, 58);
      expect(s.codeLoading, isFalse);
      expect(s.errorEpoch, 0);
    });

    test('发码成功后倒计时逐秒递减并归零', () {
      SharedPreferences.setMockInitialValues(<String, Object>{});
      fakeAsync((FakeAsync async) {
        SharedPreferences? prefs;
        SharedPreferences.getInstance().then((SharedPreferences p) => prefs = p);
        async.flushMicrotasks();
        final ProviderContainer c = ProviderContainer(
          overrides: <Override>[
            sharedPreferencesProvider.overrideWithValue(prefs!),
            tokenStorageProvider.overrideWithValue(InMemoryTokenStorage()),
            authRepositoryProvider
                .overrideWithValue(_InstantSendCodeRepository()),
          ],
        );
        c.read(sessionControllerProvider.future);
        c.listen(loginSheetControllerProvider, (_, _) {});
        async.flushMicrotasks();

        ctrl(c).sendLoginCode(email: 'me@quantify.dev');
        async.flushMicrotasks();
        expect(read(c).codeCountdown, 58);

        async.elapse(const Duration(seconds: 1));
        expect(read(c).codeCountdown, 57);

        async.elapse(const Duration(seconds: 57));
        expect(read(c).codeCountdown, 0);

        // 归零后 timer 已取消，再走时间不会变负。
        async.elapse(const Duration(seconds: 5));
        expect(read(c).codeCountdown, 0);
        c.dispose();
      });
    });

    test('发码失败：落 error，errorEpoch 自增，codeSent 仍 false', () async {
      final ProviderContainer c = await makeContainer(
        authRepository: _FailingSendCodeRepository(),
      );
      await ctrl(c).sendLoginCode(email: 'me@quantify.dev');
      final LoginSheetState s = read(c);
      expect(s.codeSent, isFalse);
      expect(s.codeCountdown, 0);
      expect(s.codeLoading, isFalse);
      expect(s.errorEpoch, 1);
      expect(s.errorMessage, contains('mock send code failed'));
      expect(s.errorPrefixKind, LoginErrorKind.login);
    });

    test('邮箱登录成功（先发码）：返回 true', () async {
      final ProviderContainer c = await makeContainer();
      await ctrl(c).sendLoginCode(email: 'me@quantify.dev');
      final bool ok = await ctrl(c).submitEmailCode(
        email: 'me@quantify.dev',
        code: '123456',
      );
      expect(ok, isTrue);
      expect(read(c).emailLoading, isFalse);
    });

    test('邮箱登录失败（未发码）：返回 false 且落 error', () async {
      final ProviderContainer c = await makeContainer();
      final bool ok = await ctrl(c).submitEmailCode(
        email: 'me@quantify.dev',
        code: '123456',
      );
      expect(ok, isFalse);
      expect(read(c).errorEpoch, 1);
      expect(read(c).errorPrefixKind, LoginErrorKind.login);
      expect(read(c).emailLoading, isFalse);
    });
  });
}
