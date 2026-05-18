import '../models/account_models.dart';

/// 账户 Repository 接口。
abstract class AccountRepository {
  Future<AccountInfo> getInfo();
  Stream<AccountInfo> watchInfo();
}
