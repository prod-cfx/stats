import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_api_key_repository.dart';
import 'package:quantify_mobile/data/models/api_key_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/api_key_repository.dart';
import 'package:quantify_mobile/pages/me/api_form_sheet_controller.dart';
import 'package:quantify_mobile/pages/me/api_form_sheet_state.dart';

/// 保存失败的 ApiKeyRepository：`addKey` 抛错，覆盖 saving 流转的失败分支。
class _FailingApiKeyRepository implements ApiKeyRepository {
  @override
  Future<ExchangeApiKey> addKey({
    required String exchange,
    required String label,
    required String apiKey,
    required String apiSecret,
    String? apiPassphrase,
  }) async {
    throw StateError('mock add key failed');
  }

  @override
  Future<List<ExchangeApiKey>> listKeys() async => <ExchangeApiKey>[];

  @override
  Future<void> removeKey(String id) async {}
}

/// issue #2187 验收：`api_form_sheet` controller 覆盖 showSecret 切换与保存
/// saving 流转（成功/失败）。
void main() {
  ProviderContainer makeContainer({ApiKeyRepository? repo}) {
    final ProviderContainer c = ProviderContainer(
      overrides: <Override>[
        apiKeyRepositoryProvider.overrideWithValue(
          repo ?? MockApiKeyRepository(),
        ),
      ],
    );
    addTearDown(c.dispose);
    // 订阅 autoDispose provider，防止 await 期间无监听者触发自动销毁
    // （销毁后 controller.mounted=false，save 会提前 return false）。
    c.listen(apiFormSheetControllerProvider, (_, _) {});
    return c;
  }

  ApiFormSheetController ctrl(ProviderContainer c) =>
      c.read(apiFormSheetControllerProvider.notifier);
  ApiFormSheetState read(ProviderContainer c) =>
      c.read(apiFormSheetControllerProvider);

  group('ApiFormSheetController', () {
    test('初始态：showSecret=false，saving=false，env=mainnet', () {
      final ProviderContainer c = makeContainer();
      final ApiFormSheetState s = read(c);
      expect(s.showSecret, isFalse);
      expect(s.saving, isFalse);
      expect(s.env, ApiEnv.mainnet);
    });

    test('toggleSecret 在 true/false 间切换', () {
      final ProviderContainer c = makeContainer();
      ctrl(c).toggleSecret();
      expect(read(c).showSecret, isTrue);
      ctrl(c).toggleSecret();
      expect(read(c).showSecret, isFalse);
    });

    test('setEnv 切换环境，不连带改其它字段', () {
      final ProviderContainer c = makeContainer();
      ctrl(c).toggleSecret();
      ctrl(c).setEnv(ApiEnv.testnet);
      final ApiFormSheetState s = read(c);
      expect(s.env, ApiEnv.testnet);
      expect(s.showSecret, isTrue);
      expect(s.saving, isFalse);
    });

    test('save 成功：saving true→false 流转，返回 true', () async {
      final ProviderContainer c = makeContainer();
      final Future<bool> future = ctrl(c).save(
        exchange: 'Binance',
        label: 'main',
        apiKey: 'k' * 20,
        apiSecret: 's' * 20,
      );
      // 异步进行中 saving=true（MockApiKeyRepository.addKey 有 200ms 延迟）。
      expect(read(c).saving, isTrue);
      final bool ok = await future;
      expect(ok, isTrue);
      expect(read(c).saving, isFalse);
    });

    test('save 失败：返回 false 且 saving 复位 false', () async {
      final ProviderContainer c = makeContainer(
        repo: _FailingApiKeyRepository(),
      );
      final bool ok = await ctrl(c).save(
        exchange: 'Binance',
        label: 'main',
        apiKey: 'k' * 20,
        apiSecret: 's' * 20,
      );
      expect(ok, isFalse);
      expect(read(c).saving, isFalse);
    });
  });
}
