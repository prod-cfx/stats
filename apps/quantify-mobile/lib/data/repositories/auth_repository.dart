import '../models/auth_models.dart';

/// 鉴权 Repository 接口。
abstract class AuthRepository {
  Future<AuthSession> login({required String email, required String password});
  Future<AuthSession> register({
    required String email,
    required String password,
    String? nickname,
    String? betaCode,
  });
  Future<void> sendLoginCode({required String email});
  Future<AuthSession> loginWithCode({
    required String email,
    required String code,
  });
  Future<AuthSession> loginTelegram({
    Map<String, dynamic> payload = const <String, dynamic>{},
  });
  Future<AuthSession> loginGuest();
  Future<void> logout();
}
