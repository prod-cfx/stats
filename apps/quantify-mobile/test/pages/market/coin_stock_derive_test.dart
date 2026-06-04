import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/coin_stock_models.dart';
import 'package:quantify_mobile/pages/market/coin_stock_body_state.dart';

/// #2192：`coinStockShown` 纯派生（从 `CoinStockBody.build` 上移）单测。
CoinStock _stock({
  String coin = 'BTC',
  String sym = 'AAA',
  String cn = '公司',
  String ex = 'NASDAQ',
  String px = '100',
}) {
  return CoinStock(
    coin: coin,
    sym: sym,
    cn: cn,
    ex: ex,
    mnav: '1',
    mcap: '1 B',
    holdV: '1 B',
    holdQ: '1',
    hold: coin,
    px: px,
    ch: '+1%',
    up: true,
    biz: '',
    hq: '',
    listed: '',
    intro: '',
  );
}

void main() {
  final List<CoinStock> sample = <CoinStock>[
    _stock(coin: 'BTC', sym: 'MSTR', px: '300'),
    _stock(coin: 'ETH', sym: 'ETHX', px: '100'),
    _stock(coin: 'DOGE', sym: 'DOGX', px: '200'),
  ];

  test('tab=btc 仅留 BTC', () {
    final out = coinStockShown(sample, const CoinStockState(tab: CoinTab.btc));
    expect(out.map((CoinStock r) => r.coin), <String>['BTC']);
  });

  test('tab=other 排除 BTC/ETH', () {
    final out = coinStockShown(sample, const CoinStockState(tab: CoinTab.other));
    expect(out.single.coin, 'DOGE');
  });

  test('搜索词匹配 sym/cn/ex（大小写不敏感）', () {
    final out = coinStockShown(sample, const CoinStockState(filter: 'mstr'));
    expect(out.single.sym, 'MSTR');
  });

  test('dir=null 保持原序', () {
    final out = coinStockShown(
      sample,
      const CoinStockState(sort: CoinStockSort.px, dir: null),
    );
    expect(out.map((CoinStock r) => r.px).toList(),
        <String>['300', '100', '200']);
  });

  test('按 px 升序排序', () {
    final out = coinStockShown(
      sample,
      const CoinStockState(sort: CoinStockSort.px, dir: SortDir.asc),
    );
    expect(out.map((CoinStock r) => r.px).toList(),
        <String>['100', '200', '300']);
  });

  test('按 px 降序排序', () {
    final out = coinStockShown(
      sample,
      const CoinStockState(sort: CoinStockSort.px, dir: SortDir.desc),
    );
    expect(out.map((CoinStock r) => r.px).toList(),
        <String>['300', '200', '100']);
  });
}
