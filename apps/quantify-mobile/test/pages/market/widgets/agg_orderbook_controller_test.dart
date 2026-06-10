import 'package:flutter/material.dart' show Color;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/agg_market_data.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/agg_orderbook_repository.dart';
import 'package:quantify_mobile/pages/market/widgets/agg_orderbook_controller.dart';
import 'package:riverpod/misc.dart' show Override;

const AggExchange _binance = AggExchange(
  key: 'binance',
  name: 'Binance',
  letter: 'B',
  color: Color(0xFF000000),
  fg: Color(0xFFFFFFFF),
);
const AggExchange _okx = AggExchange(
  key: 'okx',
  name: 'OKX',
  letter: 'O',
  color: Color(0xFF111111),
  fg: Color(0xFFFFFFFF),
);

// 卖盘：价格降序展示（近 mid 在末）。bid：价格降序（高价在首）。
const List<AggBookLevel> _asks = <AggBookLevel>[
  AggBookLevel(price: 102, qty: 3, exchange: 'okx'),
  AggBookLevel(price: 101, qty: 2, exchange: 'binance'),
  AggBookLevel(price: 100, qty: 1, exchange: 'binance'),
];
const List<AggBookLevel> _bids = <AggBookLevel>[
  AggBookLevel(price: 99, qty: 1, exchange: 'binance'),
  AggBookLevel(price: 98, qty: 2, exchange: 'okx'),
];

const AggMarketData _bundle = AggMarketData(
  exchanges: <AggExchange>[_binance, _okx],
  exchangeMap: <String, AggExchange>{'binance': _binance, 'okx': _okx},
  precisions: <int>[1, 10],
  asks: _asks,
  bids: _bids,
  oiCoins: <String>[],
  oiExchangeMap: <String, AggExchange>{},
  oiData: <String, OiSnapshot>{},
  volCoins: <String>[],
  volExchangeName: <String, String>{},
  volColor: <String, Color>{},
  volData: <String, VolSnapshot>{},
  coinColor: <String, Color>{},
);

class _FakeRepo implements AggOrderbookRepository {
  const _FakeRepo(this.data);
  final AggMarketData data;
  @override
  Future<AggMarketData> getMarketData({
    AggMarketRequest request = const AggMarketRequest.defaultMarket(),
  }) async => data;
}

void main() {
  Future<ProviderContainer> makeContainer([
    AggMarketData data = _bundle,
  ]) async {
    final ProviderContainer c = ProviderContainer(
      overrides: <Override>[
        aggOrderbookRepositoryProvider.overrideWithValue(_FakeRepo(data)),
      ],
    );
    addTearDown(c.dispose);
    c.listen(aggOrderbookControllerProvider, (_, _) {});
    // 解析 FutureProvider，使 controller `.value` 取到真实 bundle。
    await c.read(aggOrderbookProvider.future);
    return c;
  }

  AggOrderbookController ctrl(ProviderContainer c) =>
      c.read(aggOrderbookControllerProvider.notifier);
  AggMarketData dataOf(ProviderContainer c) =>
      c.read(aggOrderbookProvider).value!;

  group('AggOrderbookController 输入态', () {
    test('初始态：selectedEx=null、precision=1、view=both', () async {
      final ProviderContainer c = await makeContainer();
      final AggOrderbookState s = c.read(aggOrderbookControllerProvider);
      expect(s.selectedEx, isNull);
      expect(s.precision, 1);
      expect(s.view, AggView.both);
    });

    test('selectedEx=null 时派生默认全选（首帧用全集）', () async {
      final ProviderContainer c = await makeContainer();
      final List<AggBookLevel> asks = ctrl(c).asksOf(dataOf(c));
      // 三档全留（binance + okx 均选中）。
      expect(asks.map((AggBookLevel l) => l.price), <double>[102, 101, 100]);
    });
  });

  group('setExchanges 改变过滤', () {
    test('仅选 binance 过滤掉 okx 档', () async {
      final ProviderContainer c = await makeContainer();
      ctrl(c).setExchanges(<String>{'binance'});
      final List<AggBookLevel> asks = ctrl(c).asksOf(dataOf(c));
      // okx 的 102 被过滤；剩 101、100。
      expect(asks.map((AggBookLevel l) => l.price), <double>[101, 100]);
      final List<AggBookLevel> bids = ctrl(c).bidsOf(dataOf(c));
      // okx 的 98 被过滤；剩 99。
      expect(bids.map((AggBookLevel l) => l.price), <double>[99]);
    });

    test('空选中集合 → 两侧均为空', () async {
      final ProviderContainer c = await makeContainer();
      ctrl(c).setExchanges(<String>{});
      expect(ctrl(c).asksOf(dataOf(c)), isEmpty);
      expect(ctrl(c).bidsOf(dataOf(c)), isEmpty);
    });

    test('切换市场后旧选择全部失效时回退到新市场全集', () async {
      final ProviderContainer c = await makeContainer();
      ctrl(c).setExchanges(<String>{'binance'});

      const AggExchange bybit = AggExchange(
        key: 'bybit',
        name: 'Bybit',
        letter: 'B',
        color: Color(0xFF222222),
        fg: Color(0xFFFFFFFF),
      );
      const AggMarketData next = AggMarketData(
        exchanges: <AggExchange>[bybit],
        exchangeMap: <String, AggExchange>{'bybit': bybit},
        precisions: <int>[1],
        asks: <AggBookLevel>[
          AggBookLevel(price: 103, qty: 4, exchange: 'bybit'),
        ],
        bids: <AggBookLevel>[
          AggBookLevel(price: 97, qty: 5, exchange: 'bybit'),
        ],
        oiCoins: <String>[],
        oiExchangeMap: <String, AggExchange>{},
        oiData: <String, OiSnapshot>{},
        volCoins: <String>[],
        volExchangeName: <String, String>{},
        volColor: <String, Color>{},
        volData: <String, VolSnapshot>{},
        coinColor: <String, Color>{},
      );

      expect(ctrl(c).asksOf(next).map((AggBookLevel l) => l.exchange), <String>[
        'bybit',
      ]);
      expect(ctrl(c).bidsOf(next).map((AggBookLevel l) => l.exchange), <String>[
        'bybit',
      ]);
    });
  });

  group('precision 变化触发聚合', () {
    test('precision=10 时 asks 按 10 桶向上取整聚合', () async {
      final ProviderContainer c = await makeContainer();
      ctrl(c).setPrecision(10);
      final List<AggBookLevel> asks = ctrl(c).asksOf(dataOf(c));
      // ask 向上取整：100→100 桶(qty1)；101/102→110 桶(qty2+3=5)。降序展示。
      expect(asks.map((AggBookLevel l) => (l.price, l.qty)), <(double, double)>[
        (110, 5),
        (100, 1),
      ]);
      // 累计自近 mid（末档 100）向外：100→1，110→1+5=6。
      expect(asks.map((AggBookLevel l) => l.total), <double>[6, 1]);
    });
  });

  group('原始 levels → 期望 asks/bids 派生（含累计值）', () {
    test('全选 precision=1：累计量正确填充', () async {
      final ProviderContainer c = await makeContainer();
      final List<AggBookLevel> asks = ctrl(c).asksOf(dataOf(c));
      // ask 从近 mid（末档 price=100）向外累加：100→1, 101→1+2=3, 102→3+3=6。
      expect(
        asks.map((AggBookLevel l) => (l.price, l.total)),
        <(double, double)>[(102, 6), (101, 3), (100, 1)],
      );
      final List<AggBookLevel> bids = ctrl(c).bidsOf(dataOf(c));
      // bid 从高价（首档 99）向下累加：99→1, 98→1+2=3。
      expect(
        bids.map((AggBookLevel l) => (l.price, l.total)),
        <(double, double)>[(99, 1), (98, 3)],
      );
    });
  });

  group('setView', () {
    test('setView 更新视图模式', () async {
      final ProviderContainer c = await makeContainer();
      ctrl(c).setView(AggView.asks);
      expect(c.read(aggOrderbookControllerProvider).view, AggView.asks);
    });
  });

  group('空数据边界（kEmptyAggData）', () {
    const AggMarketData empty = kEmptyAggData;

    test('exchanges 为空时 _resolveSelection 回退空集 → 两侧派生为空', () async {
      final ProviderContainer c = await makeContainer(empty);
      expect(ctrl(c).asksOf(dataOf(c)), isEmpty);
      expect(ctrl(c).bidsOf(dataOf(c)), isEmpty);
    });

    test(
      'null-data 回退：precisions/exchanges/currentSelection getter 返回空',
      () async {
        final ProviderContainer c = await makeContainer(empty);
        expect(ctrl(c).precisions, isEmpty);
        expect(ctrl(c).exchanges, isEmpty);
        expect(ctrl(c).currentSelection, isEmpty);
      },
    );
  });

  group('值相等：setExchanges/setView 同值不产生新引用', () {
    test('AggOrderbookState ==/hashCode 按值判等', () async {
      final ProviderContainer c = await makeContainer();
      ctrl(c).setExchanges(<String>{'binance'});
      final AggOrderbookState s1 = c.read(aggOrderbookControllerProvider);
      ctrl(c).setExchanges(<String>{'binance'});
      final AggOrderbookState s2 = c.read(aggOrderbookControllerProvider);
      expect(s1, s2);
      expect(s1.hashCode, s2.hashCode);
    });
  });
}
