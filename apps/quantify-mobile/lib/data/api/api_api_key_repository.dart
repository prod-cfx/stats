import '../models/api_key_models.dart';
import '../repositories/api_key_repository.dart';
import '../services/account_services.dart';
import '../services/json_codec.dart';
import '../utils/mask_helpers.dart';

/// [ApiKeyRepository] 真实现（issue #2189）。
///
/// 与 mock 同约定：raw secret 不进 model，仅在 addKey 请求体中带给后端；
/// 响应缺 maskedKey 时本地用 [maskApiKey] 兜底脱敏。
class ApiApiKeyRepository implements ApiKeyRepository {
  ApiApiKeyRepository(this._service);

  final ApiKeyService _service;

  ExchangeApiKey _parse(Map<String, dynamic> m, {String? maskedFallback}) {
    return ExchangeApiKey(
      id: asString(pick(m, <String>['id'])),
      exchange: asString(pick(m, <String>['exchange'])),
      label: asString(pick(m, <String>['label'])),
      maskedKey: asString(
        pick(m, <String>['maskedKey']),
        fallback: maskedFallback ?? '',
      ),
      createdAt: asDateTime(pick(m, <String>['createdAt'])),
    );
  }

  @override
  Future<List<ExchangeApiKey>> listKeys() async {
    final dynamic raw = await _service.listKeys();
    final Object? list =
        raw is Map ? pick(asMap(raw), <String>['items', 'data']) : raw;
    return asMapList(list ?? raw)
        .map((Map<String, dynamic> m) => _parse(m))
        .toList(growable: false);
  }

  @override
  Future<ExchangeApiKey> addKey({
    required String exchange,
    required String label,
    required String apiKey,
    required String apiSecret,
    String? apiPassphrase,
  }) async {
    final dynamic raw = await _service.addKey(<String, dynamic>{
      'exchange': exchange,
      'label': label,
      'apiKey': apiKey,
      'apiSecret': apiSecret,
      'apiPassphrase': ?apiPassphrase,
    });
    return _parse(asMap(raw), maskedFallback: maskApiKey(apiKey));
  }

  @override
  Future<void> removeKey(String id) => _service.removeKey(id);
}
