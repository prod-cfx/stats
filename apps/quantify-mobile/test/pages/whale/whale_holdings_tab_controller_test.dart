import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/domain/models/whale_holding_models.dart';
import 'package:quantify_mobile/pages/whale/tabs/whale_holdings_tab_controller.dart';
import 'package:quantify_mobile/pages/whale/tabs/whale_holdings_tab_state.dart';

/// issue #2182 验收：controller 纯同步动作 selectCoin/setDir/setPnl/setSort 的
/// 状态流转，含 selectCoin(null)（filter `_noCoin` 哨兵）与 setSort(null)
/// （state `_unset` 哨兵）置空路径。
void main() {
  ProviderContainer makeContainer() {
    final ProviderContainer c = ProviderContainer();
    addTearDown(c.dispose);
    return c;
  }

  WhaleHoldingsTabController ctrl(ProviderContainer c) =>
      c.read(whaleHoldingsTabControllerProvider.notifier);

  WhaleHoldingsTabState read(ProviderContainer c) =>
      c.read(whaleHoldingsTabControllerProvider);

  group('WhaleHoldingsTabController', () {
    test('初始态：默认 filter + sort 为 null', () {
      final ProviderContainer c = makeContainer();
      final WhaleHoldingsTabState s = read(c);
      expect(s.filter.coin, isNull);
      expect(s.filter.dir, WhaleHoldingDirFilter.all);
      expect(s.filter.pnl, WhaleHoldingPnlFilter.all);
      expect(s.sort, isNull);
    });

    test('selectCoin 设置与清空（null 经 _noCoin 哨兵置空）', () {
      final ProviderContainer c = makeContainer();
      ctrl(c).selectCoin('BTC');
      expect(read(c).filter.coin, 'BTC');

      ctrl(c).selectCoin(null);
      expect(read(c).filter.coin, isNull);
    });

    test('setDir 更新方向，不影响其它字段', () {
      final ProviderContainer c = makeContainer();
      ctrl(c).selectCoin('ETH');
      ctrl(c).setDir(WhaleHoldingDirFilter.long);
      final WhaleHoldingsTabState s = read(c);
      expect(s.filter.dir, WhaleHoldingDirFilter.long);
      expect(s.filter.coin, 'ETH');
      expect(s.filter.pnl, WhaleHoldingPnlFilter.all);
    });

    test('setPnl 更新盈亏，不影响其它字段', () {
      final ProviderContainer c = makeContainer();
      ctrl(c).setDir(WhaleHoldingDirFilter.short);
      ctrl(c).setPnl(WhaleHoldingPnlFilter.profit);
      final WhaleHoldingsTabState s = read(c);
      expect(s.filter.pnl, WhaleHoldingPnlFilter.profit);
      expect(s.filter.dir, WhaleHoldingDirFilter.short);
    });

    test('setSort 设置与清空（null 经 state _unset 哨兵置空）', () {
      final ProviderContainer c = makeContainer();
      const WhaleHoldingSort sort = WhaleHoldingSort(
        key: WhaleHoldingSortKey.value,
        dir: WhaleHoldingSortDir.desc,
      );
      ctrl(c).setSort(sort);
      expect(read(c).sort, sort);

      ctrl(c).setSort(null);
      expect(read(c).sort, isNull);
    });

    test('setSort 置空不连带改 filter（_unset 与 filter 解耦）', () {
      final ProviderContainer c = makeContainer();
      ctrl(c).selectCoin('SOL');
      ctrl(c).setDir(WhaleHoldingDirFilter.long);
      ctrl(c).setSort(
        const WhaleHoldingSort(
          key: WhaleHoldingSortKey.margin,
          dir: WhaleHoldingSortDir.asc,
        ),
      );
      ctrl(c).setSort(null);
      final WhaleHoldingsTabState s = read(c);
      expect(s.sort, isNull);
      expect(s.filter.coin, 'SOL');
      expect(s.filter.dir, WhaleHoldingDirFilter.long);
    });

    test('连续动作组合流转', () {
      final ProviderContainer c = makeContainer();
      ctrl(c)
        ..selectCoin('BTC')
        ..setDir(WhaleHoldingDirFilter.long)
        ..setPnl(WhaleHoldingPnlFilter.loss)
        ..setSort(
          const WhaleHoldingSort(
            key: WhaleHoldingSortKey.time,
            dir: WhaleHoldingSortDir.desc,
          ),
        );
      final WhaleHoldingsTabState s = read(c);
      expect(s.filter.coin, 'BTC');
      expect(s.filter.dir, WhaleHoldingDirFilter.long);
      expect(s.filter.pnl, WhaleHoldingPnlFilter.loss);
      expect(s.sort?.key, WhaleHoldingSortKey.time);
      expect(s.sort?.dir, WhaleHoldingSortDir.desc);
    });
  });
}
