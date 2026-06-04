import '../models/whale_extra_models.dart';

/// 巨鲸「数据」hub 附加数据 Repository 接口（issue #2216）。
///
/// 当前 data hub 仅消费通知列表（`mockWhaleNotifications`）。
abstract class WhaleExtrasRepository {
  Future<List<WhaleNotification>> listNotifications();
}
