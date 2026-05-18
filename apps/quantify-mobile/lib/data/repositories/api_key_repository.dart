import '../models/api_key_models.dart';

/// 交易所 API Key Repository 接口。
///
/// **addKey 签名说明**：表单收到的 `apiKey` / `apiSecret` 是 raw 字符串，
/// repository 内部负责生成脱敏后的 `maskedKey` 写入 `ExchangeApiKey`。
/// raw secret 不在 model 中保留——这与生产实现「凭据只在调用 API 时存在」
/// 语义对齐，避免后续接真实 API 时改契约。
abstract class ApiKeyRepository {
  Future<List<ExchangeApiKey>> listKeys();

  /// 新增一个交易所 API 凭据。
  ///
  /// 实现内部应：① `maskApiKey(apiKey)` 生成 `ExchangeApiKey.maskedKey`；
  /// ② 自行生成 `id` / `createdAt`。
  Future<ExchangeApiKey> addKey({
    required String exchange,
    required String label,
    required String apiKey,
    required String apiSecret,
  });

  Future<void> removeKey(String id);
}
