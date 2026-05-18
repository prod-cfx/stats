/// 鉴权相关值对象。
class AuthSession {
  final String userId;
  final String token;
  final String email;

  const AuthSession({
    required this.userId,
    required this.token,
    required this.email,
  });

  Map<String, dynamic> toMap() => <String, dynamic>{
    'userId': userId,
    'token': token,
    'email': email,
  };

  factory AuthSession.fromMap(Map<String, dynamic> map) => AuthSession(
    userId: map['userId'] as String,
    token: map['token'] as String,
    email: map['email'] as String,
  );
}

class Credentials {
  final String email;
  final String password;

  const Credentials({required this.email, required this.password});
}
