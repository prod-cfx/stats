import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_api_key_repository.dart';
import 'package:quantify_mobile/data/models/api_key_models.dart';

void main() {
  group('MockApiKeyRepository', () {
    test('listKeys 返回 fixture，addKey 追加，removeKey 删除', () async {
      final MockApiKeyRepository repo = MockApiKeyRepository();
      final List<ExchangeApiKey> initial = await repo.listKeys();
      expect(initial, isNotEmpty);

      final ExchangeApiKey added = ExchangeApiKey(
        id: 'key-new',
        exchange: 'bybit',
        label: '新增',
        maskedKey: 'BYB-****0000',
        createdAt: DateTime.fromMillisecondsSinceEpoch(0),
      );
      await repo.addKey(added);
      final List<ExchangeApiKey> after = await repo.listKeys();
      expect(after.length, initial.length + 1);
      expect(after.any((ExchangeApiKey k) => k.id == 'key-new'), isTrue);

      await repo.removeKey('key-new');
      final List<ExchangeApiKey> finalList = await repo.listKeys();
      expect(finalList.any((ExchangeApiKey k) => k.id == 'key-new'), isFalse);
    });
  });
}
