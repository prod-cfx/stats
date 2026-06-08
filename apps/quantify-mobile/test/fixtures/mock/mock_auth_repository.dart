import 'package:quantify_mobile/data/models/auth_models.dart';
import 'package:quantify_mobile/data/repositories/auth_repository.dart';

const String _telegramMockEmail = 'telegram-user@mock';
const String _guestMockEmail = 'guest@quantify.local';

/// AuthRepository 的 Mock 闭环实现，作为模式示例。
/// - 任意凭据登录成功（200ms 延迟）
/// - 纯 stateless：不持有会话内存态，会话真相源为 SessionController（issue #2262）
class MockAuthRepository implements AuthRepository {
  final Set<String> _emailsWithLoginCode = <String>{};

  @override
  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return AuthSession(userId: 'mock-user', token: 'mock-token', email: email);
  }

  @override
  Future<AuthSession> register({
    required String email,
    required String password,
    String? nickname,
    String? betaCode,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return AuthSession(userId: 'mock-user', token: 'mock-token', email: email);
  }

  @override
  Future<void> sendLoginCode({required String email}) async {
    await Future<void>.delayed(const Duration(milliseconds: 120));
    _emailsWithLoginCode.add(email.trim().toLowerCase());
  }

  @override
  Future<AuthSession> loginWithCode({
    required String email,
    required String code,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    if (code.trim().isEmpty) {
      throw ArgumentError.value(code, 'code', '验证码不能为空');
    }
    final String normalizedEmail = email.trim().toLowerCase();
    if (!_emailsWithLoginCode.contains(normalizedEmail)) {
      throw StateError('请先发送验证码');
    }
    return AuthSession(userId: 'mock-user', token: 'mock-token', email: email);
  }

  @override
  Future<AuthSession> loginTelegram({
    Map<String, dynamic> payload = const <String, dynamic>{},
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return const AuthSession(
      userId: 'mock-telegram-user',
      token: 'mock-token',
      email: _telegramMockEmail,
    );
  }

  @override
  Future<AuthSession> loginGuest() async {
    await Future<void>.delayed(const Duration(milliseconds: 120));
    return const AuthSession(
      userId: 'guest-mock',
      token: 'guest-mock-token',
      email: _guestMockEmail,
      isGuest: true,
    );
  }

  @override
  Future<void> logout() async {}
}
