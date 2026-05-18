import '../models/api_key_models.dart';
import '../repositories/api_key_repository.dart';
import 'fixtures/api_key.dart';

class MockApiKeyRepository implements ApiKeyRepository {
  final List<ExchangeApiKey> _keys = <ExchangeApiKey>[...mockApiKeys];

  @override
  Future<List<ExchangeApiKey>> listKeys() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return List<ExchangeApiKey>.unmodifiable(_keys);
  }

  @override
  Future<ExchangeApiKey> addKey(ExchangeApiKey key) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    _keys.add(key);
    return key;
  }

  @override
  Future<void> removeKey(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    _keys.removeWhere((ExchangeApiKey k) => k.id == id);
  }
}
