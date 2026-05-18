import '../models/auth_models.dart';

/// 鉴权 Repository 接口。
abstract class AuthRepository {
  Future<AuthSession> login({required String email, required String password});
  Future<void> logout();
  Stream<AuthSession?> watchSession();
}
