import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_whale_feed_repository.dart';
import 'package:quantify_mobile/data/models/whale_models.dart';

void main() {
  test('MockWhaleFeedRepository.watchFeed 每 3 秒推一条事件', () {
    fakeAsync((FakeAsync async) {
      final MockWhaleFeedRepository repo = MockWhaleFeedRepository();
      final List<WhaleEvent> received = <WhaleEvent>[];
      final StreamSubscription<WhaleEvent> sub =
          repo.watchFeed().listen(received.add);

      // 2 秒：不足 3 秒，未推送
      async.elapse(const Duration(seconds: 2));
      expect(received, isEmpty);

      // 累计 3 秒：第 1 条到达
      async.elapse(const Duration(seconds: 1));
      expect(received.length, 1);

      // 再 6 秒：总累计 3 条
      async.elapse(const Duration(seconds: 6));
      expect(received.length, 3);

      sub.cancel();
      async.elapse(const Duration(seconds: 10));
      expect(received.length, 3);
    });
  });
}
