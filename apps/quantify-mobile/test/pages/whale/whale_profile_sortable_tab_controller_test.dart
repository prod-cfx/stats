import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/pages/whale/whale_profile_sortable_tab_controller.dart';
import 'package:quantify_mobile/pages/whale/whale_profile_sortable_tab_state.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_detail_sort.dart';

/// issue #2183 验收：明细 tab controller 排序三态循环 + 币种筛选 + 更多排序，
/// 并验证 family key 隔离（spot/perp 实例互不串扰）。
void main() {
  ProviderContainer makeContainer() {
    final ProviderContainer c = ProviderContainer();
    addTearDown(c.dispose);
    return c;
  }

  WhaleProfileSortableTabController ctrl(ProviderContainer c, String id) =>
      c.read(whaleProfileSortableTabControllerProvider(id).notifier);
  WhaleProfileSortableTabState read(ProviderContainer c, String id) =>
      c.read(whaleProfileSortableTabControllerProvider(id));

  group('WhaleProfileSortableTabController', () {
    test('初始态：不排序 + coin 为 null', () {
      final WhaleProfileSortableTabState s = read(makeContainer(), 'spot');
      expect(s.sort.active, isFalse);
      expect(s.coin, isNull);
    });

    test('cycleSort 三态循环 desc→asc→不排序', () {
      final ProviderContainer c = makeContainer();
      ctrl(c, 'spot').cycleSort('value');
      expect(read(c, 'spot').sort.key, 'value');
      expect(read(c, 'spot').sort.dir, WhaleSortDir.desc);
      ctrl(c, 'spot').cycleSort('value');
      expect(read(c, 'spot').sort.dir, WhaleSortDir.asc);
      ctrl(c, 'spot').cycleSort('value');
      expect(read(c, 'spot').sort.active, isFalse);
    });

    test('selectCoin 设置筛选', () {
      final ProviderContainer c = makeContainer();
      ctrl(c, 'perp').selectCoin('BTC');
      expect(read(c, 'perp').coin, 'BTC');
    });

    test('setSort 直接设定（更多排序入口）', () {
      final ProviderContainer c = makeContainer();
      const WhaleSortState s = WhaleSortState(
        key: 'funding',
        dir: WhaleSortDir.asc,
      );
      ctrl(c, 'perp').setSort(s);
      expect(read(c, 'perp').sort, s);
    });

    test('family key 隔离：spot 改动不影响 perp', () {
      final ProviderContainer c = makeContainer();
      ctrl(c, 'spot').selectCoin('ETH');
      ctrl(c, 'spot').cycleSort('value');
      expect(read(c, 'perp').coin, isNull);
      expect(read(c, 'perp').sort.active, isFalse);
    });
  });
}
