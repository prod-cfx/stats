import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_whale_feed_repository.dart';
import 'package:quantify_mobile/data/models/whale_models.dart';

void main() {
  group('MockWhaleFeedRepository', () {
    test('listRecent 返回不超过 limit 的事件子集', () async {
      final MockWhaleFeedRepository repo = MockWhaleFeedRepository();
      final List<WhaleEvent> list = await repo.listRecent(limit: 3);
      expect(list.length, 3);
    });

    test('listRecent limit 超过总量返回全集', () async {
      final MockWhaleFeedRepository repo = MockWhaleFeedRepository();
      final List<WhaleEvent> list = await repo.listRecent(limit: 999);
      expect(list, isNotEmpty);
    });
  });
}
