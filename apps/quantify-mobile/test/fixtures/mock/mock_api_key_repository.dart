import 'package:quantify_mobile/data/models/api_key_models.dart';
import 'package:quantify_mobile/data/models/deploy_models.dart';
import 'package:quantify_mobile/data/repositories/api_key_repository.dart';
import 'package:quantify_mobile/data/utils/mask_helpers.dart';
import 'fixtures/api_key.dart';

class MockApiKeyRepository implements ApiKeyRepository {
  final List<ExchangeApiKey> _keys = <ExchangeApiKey>[...mockApiKeys];

  @override
  Future<List<ExchangeApiKey>> listKeys() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return List<ExchangeApiKey>.unmodifiable(_keys);
  }

  @override
  Future<DeployPreflightResult> checkDeployPreflight({
    required String exchangeAccountId,
    required DeploymentContext deploymentContext,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    final bool hasAccount = _keys.any(
      (ExchangeApiKey key) => key.id == exchangeAccountId,
    );
    if (!hasAccount) return const DeployPreflightResult.failed();
    return const DeployPreflightResult(
      apiConnected: true,
      balanceReady: true,
      latencyReady: true,
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
    await Future<void>.delayed(const Duration(milliseconds: 200));
    // 函数签名要求 apiSecret 必传（编译期约束调用方提供完整凭据），但
    // 实现层故意不持久化 raw secret —— 与生产「凭据只在调用 API 时存在」
    // 一致。引用一次防止 unused_element 警告，运行期即丢弃。passphrase 同理。
    apiSecret.hashCode;
    apiPassphrase?.hashCode;
    final ExchangeApiKey entry = ExchangeApiKey(
      id: 'key-${DateTime.now().microsecondsSinceEpoch}',
      exchange: exchange,
      label: label,
      maskedKey: maskApiKey(apiKey),
      isTestnet: isTestnet,
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
