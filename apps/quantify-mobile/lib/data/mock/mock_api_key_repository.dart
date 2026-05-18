import '../models/api_key_models.dart';
import '../repositories/api_key_repository.dart';
import '../utils/mask_helpers.dart';
import 'fixtures/api_key.dart';

class MockApiKeyRepository implements ApiKeyRepository {
  final List<ExchangeApiKey> _keys = <ExchangeApiKey>[...mockApiKeys];

  @override
  Future<List<ExchangeApiKey>> listKeys() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return List<ExchangeApiKey>.unmodifiable(_keys);
  }

  @override
  Future<ExchangeApiKey> addKey({
    required String exchange,
    required String label,
    required String apiKey,
    required String apiSecret,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    // 函数签名要求 apiSecret 必传（编译期约束调用方提供完整凭据），但
    // 实现层故意不持久化 raw secret —— 与生产「凭据只在调用 API 时存在」
    // 一致。引用一次防止 unused_element 警告，运行期即丢弃。
    apiSecret.hashCode;
    final ExchangeApiKey entry = ExchangeApiKey(
      id: 'key-${DateTime.now().microsecondsSinceEpoch}',
      exchange: exchange,
      label: label,
      maskedKey: maskApiKey(apiKey),
      createdAt: DateTime.now(),
    );
    _keys.add(entry);
    return entry;
  }

  @override
  Future<void> removeKey(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    _keys.removeWhere((ExchangeApiKey k) => k.id == id);
  }
}
