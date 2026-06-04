import 'dart:async';

import '../models/account_models.dart';
import '../repositories/account_repository.dart';
import '../services/account_services.dart';
import '../services/json_codec.dart';

/// [AccountRepository] 真实现（issue #2189）。
///
/// `watchInfo` 后端暂无推送契约，用周期轮询取最新账户快照。
class ApiAccountRepository implements AccountRepository {
  ApiAccountRepository(this._service);

  final AccountService _service;

  AccountInfo _parse(dynamic raw) {
    final Map<String, dynamic> m = asMap(raw);
    return AccountInfo(
      userId: asString(pick(m, <String>['userId', 'id'])),
      email: asString(pick(m, <String>['email'])),
      uid: asString(pick(m, <String>['uid'])),
      totalEquityUsd: asDouble(pick(m, <String>['totalEquityUsd'])),
      availableBalanceUsd: asDouble(pick(m, <String>['availableBalanceUsd'])),
      unrealizedPnlUsd: asDouble(pick(m, <String>['unrealizedPnlUsd'])),
    );
  }

  @override
  Future<AccountInfo> getInfo() async => _parse(await _service.getInfo());

  @override
  Stream<AccountInfo> watchInfo() async* {
    yield await getInfo();
    yield* Stream<void>.periodic(const Duration(seconds: 5))
        .asyncMap((_) => getInfo());
  }
}
