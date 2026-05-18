import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_api_key_repository.dart';
import 'package:quantify_mobile/data/models/api_key_models.dart';

void main() {
  group('MockApiKeyRepository', () {
    test('listKeys 返回 fixture，addKey 追加（raw secret 不持久化），removeKey 删除',
        () async {
      final MockApiKeyRepository repo = MockApiKeyRepository();
      final List<ExchangeApiKey> initial = await repo.listKeys();
      expect(initial, isNotEmpty);

      final ExchangeApiKey added = await repo.addKey(
        exchange: 'bybit',
        label: '新增',
        apiKey: 'BYBIT_RAW_APIKEY_12345678',
        apiSecret: 'BYBIT_RAW_SECRET_12345678',
      );
      // 仅保留 masked，无 raw secret 字段可访问（编译期约束）。
      expect(added.exchange, 'bybit');
      expect(added.label, '新增');
      expect(added.maskedKey, 'BYBI****5678');
      expect(added.id, isNotEmpty);

      final List<ExchangeApiKey> after = await repo.listKeys();
      expect(after.length, initial.length + 1);
      expect(after.any((ExchangeApiKey k) => k.id == added.id), isTrue);

      await repo.removeKey(added.id);
      final List<ExchangeApiKey> finalList = await repo.listKeys();
      expect(finalList.any((ExchangeApiKey k) => k.id == added.id), isFalse);
    });
  });
}
