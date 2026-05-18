import '../models/api_key_models.dart';

/// 交易所 API Key Repository 接口。
abstract class ApiKeyRepository {
  Future<List<ExchangeApiKey>> listKeys();
  Future<ExchangeApiKey> addKey(ExchangeApiKey key);
  Future<void> removeKey(String id);
}
