import 'dart:async';
import 'dart:math';

import '../models/whale_models.dart';
import '../repositories/whale_feed_repository.dart';
import 'fixtures/whale_events.dart';

class MockWhaleFeedRepository implements WhaleFeedRepository {
  @override
  Future<List<WhaleEvent>> listRecent({required int limit}) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    // fixture 内是 timestamp 升序，业务期待"最新在前"——倒序后再 take。
    final List<WhaleEvent> sortedDesc = mockWhaleEvents.reversed.toList();
    final int take =
        limit > sortedDesc.length ? sortedDesc.length : limit;
    return sortedDesc.sublist(0, take);
  }

  /// 每 3 秒从 fixture pool 随机抽一条推流。
  @override
  Stream<WhaleEvent> watchFeed() {
    final Random rng = Random(42);
    return Stream<WhaleEvent>.periodic(const Duration(seconds: 3), (int _) {
      return mockWhaleEvents[rng.nextInt(mockWhaleEvents.length)];
    });
  }
}
