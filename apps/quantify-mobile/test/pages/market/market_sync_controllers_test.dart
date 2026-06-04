import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/coin_stock_models.dart';
import 'package:quantify_mobile/data/models/whale_extra_models.dart';
import 'package:quantify_mobile/pages/market/agg_orders_body_controller.dart';
import 'package:quantify_mobile/pages/market/agg_orders_body_state.dart';
import 'package:quantify_mobile/pages/market/coin_stock_body_controller.dart';
import 'package:quantify_mobile/pages/market/coin_stock_body_state.dart';
import 'package:quantify_mobile/pages/market/data_hub_page_controller.dart';
import 'package:quantify_mobile/pages/market/pred_market_body_controller.dart';
import 'package:quantify_mobile/pages/market/widgets/data_hub_header.dart';

void main() {
  ProviderContainer makeContainer() {
    final ProviderContainer c = ProviderContainer();
    addTearDown(c.dispose);
    return c;
  }

  group('AggOrdersController', () {
    test('初始 tab=orders；selectTab 切换', () {
      final ProviderContainer c = makeContainer();
      expect(c.read(aggOrdersControllerProvider).tab, AggSubTab.orders);
      c.read(aggOrdersControllerProvider.notifier).selectTab(AggSubTab.volume);
      expect(c.read(aggOrdersControllerProvider).tab, AggSubTab.volume);
    });
  });

  group('PredMarketController', () {
    test('初始 filter 空；setFilter 设/清', () {
      final ProviderContainer c = makeContainer();
      expect(c.read(predMarketControllerProvider).filter, '');
      c.read(predMarketControllerProvider.notifier).setFilter('btc');
      expect(c.read(predMarketControllerProvider).filter, 'btc');
      c.read(predMarketControllerProvider.notifier).setFilter('');
      expect(c.read(predMarketControllerProvider).filter, '');
    });
  });

  group('CoinStockController', () {
    test('初始默认 tab/sort/dir', () {
      final ProviderContainer c = makeContainer();
      final CoinStockState s = c.read(coinStockControllerProvider);
      expect(s.tab, CoinTab.all);
      expect(s.sort, CoinStockSort.mcap);
      expect(s.dir, SortDir.desc);
      expect(s.filter, '');
    });

    test('selectTab / setFilter 独立更新', () {
      final ProviderContainer c = makeContainer();
      c.read(coinStockControllerProvider.notifier).selectTab(CoinTab.btc);
      c.read(coinStockControllerProvider.notifier).setFilter('micro');
      final CoinStockState s = c.read(coinStockControllerProvider);
      expect(s.tab, CoinTab.btc);
      expect(s.filter, 'micro');
    });

    test('setSort 设方向；置 null 经 _unset 哨兵表示不排序', () {
      final ProviderContainer c = makeContainer();
      c
          .read(coinStockControllerProvider.notifier)
          .setSort(CoinStockSort.px, SortDir.asc);
      CoinStockState s = c.read(coinStockControllerProvider);
      expect(s.sort, CoinStockSort.px);
      expect(s.dir, SortDir.asc);

      c.read(coinStockControllerProvider.notifier).setSort(CoinStockSort.px, null);
      s = c.read(coinStockControllerProvider);
      expect(s.dir, isNull);
    });
  });

  group('DataHubController (family)', () {
    test('初始 current 取 family arg；select 切换', () {
      final ProviderContainer c = makeContainer();
      final provider = dataHubControllerProvider(DataHubScreen.longShort);
      expect(c.read(provider).current, DataHubScreen.longShort);
      c.read(provider.notifier).select(DataHubScreen.coinStock);
      expect(c.read(provider).current, DataHubScreen.coinStock);
    });

    test('setNotifications 更新列表与 unreadCount', () {
      final ProviderContainer c = makeContainer();
      final provider = dataHubControllerProvider(DataHubScreen.market);
      // seed 通知非空（mock）。
      final int seeded = c.read(provider).unreadCount;
      expect(seeded, greaterThanOrEqualTo(0));
      c.read(provider.notifier).setNotifications(const <WhaleNotification>[]);
      expect(c.read(provider).notifications, isEmpty);
      expect(c.read(provider).unreadCount, 0);
    });
  });
}
