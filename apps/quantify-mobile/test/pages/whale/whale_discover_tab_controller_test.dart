import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/domain/models/whale_leader_models.dart';
import 'package:quantify_mobile/pages/whale/tabs/whale_discover_tab_controller.dart';
import 'package:quantify_mobile/pages/whale/tabs/whale_discover_tab_state.dart';

/// issue #2183 验收：发现 tab controller 排序态 setSort 流转，含 setSort(null)
/// 经 state `_unset` 哨兵的置空路径。
void main() {
  ProviderContainer makeContainer() {
    final ProviderContainer c = ProviderContainer();
    addTearDown(c.dispose);
    return c;
  }

  WhaleDiscoverTabController ctrl(ProviderContainer c) =>
      c.read(whaleDiscoverTabControllerProvider.notifier);
  WhaleDiscoverTabState read(ProviderContainer c) =>
      c.read(whaleDiscoverTabControllerProvider);

  group('WhaleDiscoverTabController', () {
    test('初始排序：胜率降序', () {
      final WhaleDiscoverTabState s = read(makeContainer());
      expect(s.sort?.key, WhaleLeaderSortKey.winRate);
      expect(s.sort?.dir, WhaleLeaderSortDir.desc);
    });

    test('setSort 切换排序键/方向', () {
      final ProviderContainer c = makeContainer();
      const WhaleLeaderSort next = WhaleLeaderSort(
        key: WhaleLeaderSortKey.aum,
        dir: WhaleLeaderSortDir.asc,
      );
      ctrl(c).setSort(next);
      expect(read(c).sort, next);
    });

    test('setSort(null) 经 _unset 哨兵置空为不排序', () {
      final ProviderContainer c = makeContainer();
      ctrl(c).setSort(null);
      expect(read(c).sort, isNull);
    });
  });
}
