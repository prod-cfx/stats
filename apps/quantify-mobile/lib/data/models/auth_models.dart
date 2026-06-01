/// 鉴权相关值对象。
class AuthSession {
  final String userId;
  final String token;
  final String email;

  /// 游客会话标记。`true` 表示走 [SessionController.loginGuest] 创建的本地
  /// 临时身份，路由保护、付费功能、退出按钮文案据此区分；默认 false。
  final bool isGuest;

  const AuthSession({
    required this.userId,
    required this.token,
    required this.email,
    this.isGuest = false,
  });

  Map<String, dynamic> toMap() => <String, dynamic>{
    'userId': userId,
    'token': token,
    'email': email,
    'isGuest': isGuest,
  };

  factory AuthSession.fromMap(Map<String, dynamic> map) => AuthSession(
    userId: map['userId'] as String,
    token: map['token'] as String,
    email: map['email'] as String,
    // 兼容旧数据：缺字段视为非游客。
    isGuest: (map['isGuest'] as bool?) ?? false,
  );
}

class Credentials {
  final String email;
  final String password;

  const Credentials({required this.email, required this.password});
}

class LoginCodeCredentials {
  final String email;
  final String code;

  const LoginCodeCredentials({required this.email, required this.code});
}
