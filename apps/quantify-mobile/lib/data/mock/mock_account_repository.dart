import 'dart:async';

import '../models/account_models.dart';
import '../repositories/account_repository.dart';
import 'fixtures/account.dart';

class MockAccountRepository implements AccountRepository {
  @override
  Future<AccountInfo> getInfo() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return mockAccountInfo;
  }

  /// 每 5 秒推一次当前账户快照（内容稳定，只更新引用）。
  @override
  Stream<AccountInfo> watchInfo() {
    return Stream<AccountInfo>.periodic(
      const Duration(seconds: 5),
      (int _) => mockAccountInfo,
    );
  }
}
