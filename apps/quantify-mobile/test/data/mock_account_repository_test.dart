import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_account_repository.dart';
import 'package:quantify_mobile/data/models/account_models.dart';

void main() {
  group('MockAccountRepository', () {
    test('getInfo 返回 fixture 账户', () async {
      final MockAccountRepository repo = MockAccountRepository();
      final AccountInfo info = await repo.getInfo();
      expect(info.userId, 'mock-user');
      expect(info.totalEquityUsd, greaterThan(0));
    });
  });
}
