import '../models/whale_models.dart';

/// 巨鲸事件 Repository 接口。
abstract class WhaleFeedRepository {
  Future<List<WhaleEvent>> listRecent({required int limit});
  Stream<WhaleEvent> watchFeed();
}
