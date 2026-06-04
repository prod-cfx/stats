import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:quantify_mobile/data/models/whale_watch_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/whale_watch_repository.dart';
import 'package:quantify_mobile/pages/whale/tabs/whale_watch_tab_controller.dart';
import 'package:quantify_mobile/pages/whale/tabs/whale_watch_tab_state.dart';

/// issue #2183 验收：监控 tab controller 异步规则加载（loading→data /
/// loading→error）+ 子 Tab 切换 + CRUD 纯态流转。
WatchRule _rule(String id, {bool muted = false}) => WatchRule(
  id: id,
  name: 'rule-$id',
  address: '0x$id',
  lastEventDisplay: '',
  tone: 'up',
  pnlDisplay: '',
  live: true,
  thresholdUsd: 0,
  channels: const <WatchRuleChannel>{WatchRuleChannel.push},
  muted: muted,
);

class _FakeRepo implements WhaleWatchRepository {
  _FakeRepo(this._rules);
  final List<WatchRule> _rules;
  @override
  Future<List<WatchRule>> listRules() async => _rules;
  @override
  Future<List<WhaleSearchResult>> search(String query) async =>
      const <WhaleSearchResult>[];
}

class _ThrowingRepo implements WhaleWatchRepository {
  @override
  Future<List<WatchRule>> listRules() async => throw Exception('boom');
  @override
  Future<List<WhaleSearchResult>> search(String query) async =>
      const <WhaleSearchResult>[];
}

void main() {
  ProviderContainer makeContainer(WhaleWatchRepository repo) {
    final ProviderContainer c = ProviderContainer(
      overrides: <Override>[
        whaleWatchRepositoryProvider.overrideWithValue(repo),
      ],
    );
    addTearDown(c.dispose);
    // autoDispose：保持订阅，避免 read 之间被回收导致异步回调 mounted=false。
    c.listen(whaleWatchTabControllerProvider, (_, _) {});
    return c;
  }

  WhaleWatchTabController ctrl(ProviderContainer c) =>
      c.read(whaleWatchTabControllerProvider.notifier);
  WhaleWatchTabState read(ProviderContainer c) =>
      c.read(whaleWatchTabControllerProvider);

  group('WhaleWatchTabController 异步加载', () {
    test('初始 loading=true', () {
      final ProviderContainer c = makeContainer(_FakeRepo(<WatchRule>[]));
      expect(read(c).loading, isTrue);
      expect(read(c).rules, isNull);
    });

    test('loading→data：加载成功落 rules、清 loading/error', () async {
      final ProviderContainer c = makeContainer(
        _FakeRepo(<WatchRule>[_rule('a'), _rule('b')]),
      );
      ctrl(c); // 触发 build → _load
      await Future<void>.delayed(Duration.zero);
      final WhaleWatchTabState s = read(c);
      expect(s.loading, isFalse);
      expect(s.rules, hasLength(2));
      expect(s.error, isNull);
    });

    test('loading→error：加载失败经 ErrorRouter.normalize 落 error', () async {
      final ProviderContainer c = makeContainer(_ThrowingRepo());
      ctrl(c);
      await Future<void>.delayed(Duration.zero);
      final WhaleWatchTabState s = read(c);
      expect(s.loading, isFalse);
      expect(s.error, isNotNull);
      expect(s.rules, isNull);
    });
  });

  group('WhaleWatchTabController 同步动作', () {
    test('setSubTab 切换子 Tab', () {
      final ProviderContainer c = makeContainer(_FakeRepo(<WatchRule>[]));
      ctrl(c).setSubTab(WhaleWatchSubTab.addresses);
      expect(read(c).subTab, WhaleWatchSubTab.addresses);
    });

    test('appendRule / replaceRule / toggleMute / removeRule', () async {
      final ProviderContainer c = makeContainer(_FakeRepo(<WatchRule>[_rule('a')]));
      ctrl(c);
      await Future<void>.delayed(Duration.zero);

      ctrl(c).appendRule(_rule('b'));
      expect(read(c).rules, hasLength(2));

      ctrl(c).toggleMute(_rule('a'));
      expect(
        read(c).rules!.firstWhere((WatchRule r) => r.id == 'a').muted,
        isTrue,
      );

      ctrl(c).replaceRule(_rule('b', muted: true));
      expect(
        read(c).rules!.firstWhere((WatchRule r) => r.id == 'b').muted,
        isTrue,
      );

      ctrl(c).removeRule(_rule('a'));
      expect(read(c).rules, hasLength(1));
      expect(read(c).rules!.single.id, 'b');
    });
  });
}
