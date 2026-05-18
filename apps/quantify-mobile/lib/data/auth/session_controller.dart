import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/auth_models.dart';
import '../providers.dart' show authRepositoryProvider;
import '../repositories/auth_repository.dart';
import '../storage/secure_token_storage.dart';

/// secure storage 中保存当前 session 的 key。
const String kSessionStorageKey = 'auth_session';

/// Telegram 一键登录在 mock 模式下的占位 email。
/// 真实模式应替换为后端返回的真实身份。
const String kTelegramMockEmail = 'telegram-user@mock';

/// 管理当前用户 session，桥接 [AuthRepository] 与持久化层。
///
/// - `build()` 从 [TokenStorage] 恢复上次 session；启动时 `main()` 必须
///   `await` 一次该 provider 的 `future`，让 GoRouter 同步 redirect 看到的
///   状态稳定。
/// - `loginEmail` / `loginTelegram` 调 repository 后写盘并广播。
/// - `logout` 清盘 + 重置 state。
class SessionController extends AsyncNotifier<AuthSession?> {
  @override
  Future<AuthSession?> build() async {
    final TokenStorage storage = ref.read(tokenStorageProvider);
    final String? raw = await storage.read(kSessionStorageKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      final Map<String, dynamic> map =
          jsonDecode(raw) as Map<String, dynamic>;
      return AuthSession.fromMap(map);
    } on FormatException {
      // 旧数据/损坏 token：清掉，避免每次启动都炸。
      await storage.delete(kSessionStorageKey);
      return null;
    }
  }

  AuthRepository get _repo => ref.read(authRepositoryProvider);
  TokenStorage get _storage => ref.read(tokenStorageProvider);

  Future<void> loginEmail({
    required String email,
    required String password,
  }) async {
    state = const AsyncLoading<AuthSession?>();
    state = await AsyncValue.guard<AuthSession?>(() async {
      final AuthSession session =
          await _repo.login(email: email, password: password);
      await _storage.write(
        kSessionStorageKey,
        jsonEncode(session.toMap()),
      );
      return session;
    });
  }

  Future<void> loginTelegram() async {
    await loginEmail(email: kTelegramMockEmail, password: '');
  }

  Future<void> logout() async {
    state = const AsyncLoading<AuthSession?>();
    state = await AsyncValue.guard<AuthSession?>(() async {
      await _repo.logout();
      await _storage.delete(kSessionStorageKey);
      return null;
    });
  }
}

/// TokenStorage provider —— 测试通过 override 注入 [InMemoryTokenStorage]。
final Provider<TokenStorage> tokenStorageProvider = Provider<TokenStorage>(
  (Ref ref) => SecureTokenStorageImpl(),
);

final AsyncNotifierProvider<SessionController, AuthSession?>
sessionControllerProvider =
    AsyncNotifierProvider<SessionController, AuthSession?>(
  SessionController.new,
);
