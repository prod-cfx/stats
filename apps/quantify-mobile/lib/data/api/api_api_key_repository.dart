import '../models/api_key_models.dart';
import '../models/deploy_models.dart';
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

  Object? _payload(Object? raw) {
    final Map<String, dynamic> root = asMap(raw);
    return root.containsKey('data') ? root['data'] : raw;
  }

  ExchangeApiKey _parse(
    Map<String, dynamic> m, {
    String? maskedFallback,
    bool isTestnetFallback = false,
  }) {
    return ExchangeApiKey(
      id: asString(pick(m, <String>['id'])),
      exchange: asString(pick(m, <String>['exchangeId', 'exchange'])),
      label: asString(pick(m, <String>['name', 'label'])),
      maskedKey: asString(
        pick(m, <String>['maskedCredential', 'maskedKey']),
        fallback: maskedFallback ?? '',
      ),
      isTestnet: asBool(
        pick(m, <String>['isTestnet']),
        fallback: isTestnetFallback,
      ),
      createdAt: asDateTime(pick(m, <String>['createdAt'])),
    );
  }

  @override
  Future<List<ExchangeApiKey>> listKeys() async {
    final dynamic raw = await _service.listKeys();
    final Object? payload = _payload(raw);
    final Object? list = payload is Map
        ? pick(asMap(payload), <String>['items', 'data'])
        : payload;
    return asMapList(list ?? payload)
        .where(
          (Map<String, dynamic> m) =>
              asBool(pick(m, <String>['isBound']), fallback: true),
        )
        .map((Map<String, dynamic> m) => _parse(m))
        .where((ExchangeApiKey k) => k.id.isNotEmpty)
        .toList(growable: false);
  }

  @override
  Future<DeployPreflightResult> checkDeployPreflight({
    required String exchangeAccountId,
    required DeploymentContext deploymentContext,
  }) async {
    final List<ExchangeApiKey> keys = await listKeys();
    final bool hasAccount = keys.any(
      (ExchangeApiKey key) => key.id == exchangeAccountId,
    );
    return DeployPreflightResult.fromDeploymentContext(
      apiConnected: hasAccount,
      deploymentContext: deploymentContext,
    );
  }

  @override
  Future<ExchangeApiKey> addKey({
    required String exchange,
    required String label,
    required String apiKey,
    required String apiSecret,
    bool isTestnet = false,
    String? apiPassphrase,
  }) async {
    final dynamic raw = await _service.addKey(<String, dynamic>{
      'exchangeId': exchange.toLowerCase(),
      'label': label,
      'name': label,
      'isTestnet': isTestnet,
      'apiKey': apiKey,
      'apiSecret': apiSecret,
      'passphrase': ?apiPassphrase,
    });
    return _parse(
      asMap(_payload(raw)),
      maskedFallback: maskApiKey(apiKey),
      isTestnetFallback: isTestnet,
    );
  }

  @override
  Future<void> removeKey(String id) => _service.removeKey(id);
}
