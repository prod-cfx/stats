import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// 轻量 token 持久化抽象。
///
/// 抽出接口的唯一原因是让 widget test 能用 [InMemoryTokenStorage] 替换平台
/// 实现 —— `flutter_secure_storage` 在 widget test 默认无 mock platform
/// channel，直接调用会抛 `MissingPluginException`。
abstract class TokenStorage {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

/// 生产实现：直接代理 [FlutterSecureStorage]。
class SecureTokenStorageImpl implements TokenStorage {
  SecureTokenStorageImpl({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

/// 测试用内存实现。不写 platform channel，断言行为可观察。
class InMemoryTokenStorage implements TokenStorage {
  InMemoryTokenStorage([Map<String, String>? seed])
    : _map = <String, String>{...?seed};

  final Map<String, String> _map;

  Map<String, String> get snapshot => Map<String, String>.unmodifiable(_map);

  @override
  Future<String?> read(String key) async => _map[key];

  @override
  Future<void> write(String key, String value) async {
    _map[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    _map.remove(key);
  }
}
