import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:quantify_mobile/data/models/whale_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/whale_feed_repository.dart';
import 'package:quantify_mobile/pages/whale/tabs/whale_live_tab_controller.dart';
import 'package:quantify_mobile/pages/whale/tabs/whale_live_tab_state.dart';

/// issue #2183 验收：实时 tab controller 异步加载（loading→data /
/// loading→error）、流推入去重、币种筛选、胜率排序循环。
WhaleEvent _ev(String id, {String symbol = 'BTC', double winRate = 50}) =>
    WhaleEvent(
      id: id,
      symbol: symbol,
      amountUsd: 1000,
      direction: 'in',
      fromLabel: 'from',
      toLabel: 'to',
      timestamp: DateTime(2024, 5),
      winRate: winRate,
    );

class _FakeFeedRepo implements WhaleFeedRepository {
  _FakeFeedRepo(this._history, this._controller);
  final List<WhaleEvent> _history;
  final StreamController<WhaleEvent> _controller;
  @override
  Future<List<WhaleEvent>> listRecent({required int limit}) async => _history;
  @override
  Stream<WhaleEvent> watchFeed() => _controller.stream;
}

class _ThrowingFeedRepo implements WhaleFeedRepository {
  @override
  Future<List<WhaleEvent>> listRecent({required int limit}) async =>
      throw Exception('boom');
  @override
  Stream<WhaleEvent> watchFeed() => const Stream<WhaleEvent>.empty();
}

void main() {
  ProviderContainer makeContainer(WhaleFeedRepository repo) {
    final ProviderContainer c = ProviderContainer(
      overrides: <Override>[
        whaleFeedRepositoryProvider.overrideWithValue(repo),
      ],
    );
    addTearDown(c.dispose);
    // autoDispose：保持订阅，避免 read 之间被回收导致异步回调 mounted=false。
    c.listen(whaleLiveTabControllerProvider, (_, _) {});
    return c;
  }

  WhaleLiveTabController ctrl(ProviderContainer c) =>
      c.read(whaleLiveTabControllerProvider.notifier);
  WhaleLiveTabState read(ProviderContainer c) =>
      c.read(whaleLiveTabControllerProvider);

  group('WhaleLiveTabController 异步加载', () {
    test('初始 loading=true', () {
      final ProviderContainer c = makeContainer(
        _FakeFeedRepo(<WhaleEvent>[], StreamController<WhaleEvent>()),
      );
      expect(read(c).loading, isTrue);
    });

    test('loading→data：历史加载完成、去重保留首次出现', () async {
      final ProviderContainer c = makeContainer(
        _FakeFeedRepo(
          <WhaleEvent>[_ev('a'), _ev('b'), _ev('a')],
          StreamController<WhaleEvent>(),
        ),
      );
      ctrl(c);
      await Future<void>.delayed(Duration.zero);
      final WhaleLiveTabState s = read(c);
      expect(s.loading, isFalse);
      expect(s.error, isNull);
      expect(s.items, hasLength(2));
    });

    test('loading→error：失败经 ErrorRouter.normalize 落 error', () async {
      final ProviderContainer c = makeContainer(_ThrowingFeedRepo());
      ctrl(c);
      await Future<void>.delayed(Duration.zero);
      final WhaleLiveTabState s = read(c);
      expect(s.loading, isFalse);
      expect(s.error, isNotNull);
    });

    test('流推入：通过筛选则插入头部并去重', () async {
      final StreamController<WhaleEvent> sc = StreamController<WhaleEvent>();
      final ProviderContainer c = makeContainer(
        _FakeFeedRepo(<WhaleEvent>[_ev('a')], sc),
      );
      ctrl(c);
      await Future<void>.delayed(Duration.zero);
      sc.add(_ev('b'));
      await Future<void>.delayed(Duration.zero);
      expect(read(c).items.first.event.id, 'b');
      expect(read(c).items, hasLength(2));
    });
  });

  group('WhaleLiveTabController 同步动作', () {
    ProviderContainer make() => makeContainer(
      _FakeFeedRepo(<WhaleEvent>[], StreamController<WhaleEvent>()),
    );

    test('setSymbolFilter 更新筛选', () {
      final ProviderContainer c = make();
      ctrl(c).setSymbolFilter('ETH');
      expect(read(c).symbolFilter, 'ETH');
    });

    test('cycleWinSort 三态循环 none→desc→asc→none', () {
      final ProviderContainer c = make();
      expect(read(c).winSort, WhaleLiveWinSort.none);
      ctrl(c).cycleWinSort();
      expect(read(c).winSort, WhaleLiveWinSort.desc);
      ctrl(c).cycleWinSort();
      expect(read(c).winSort, WhaleLiveWinSort.asc);
      ctrl(c).cycleWinSort();
      expect(read(c).winSort, WhaleLiveWinSort.none);
    });
  });
}
