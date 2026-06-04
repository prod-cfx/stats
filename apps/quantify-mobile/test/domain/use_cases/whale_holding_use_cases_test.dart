import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/domain/models/whale_holding_models.dart';
import 'package:quantify_mobile/domain/use_cases/whale_holding_use_cases.dart';

WhaleHoldingPosition _pos({
  String symbol = 'BTC',
  WhaleHoldingSide side = WhaleHoldingSide.long,
  double value = 100,
  double pnl = 10,
  double margin = 50,
  int hoursAgo = 1,
}) {
  return WhaleHoldingPosition(
    address: '0xabc',
    symbol: symbol,
    symbolColorHex: 0xFF000000,
    mode: '全仓',
    side: side,
    leverage: 5,
    value: value,
    valueDisplay: '\$$value',
    qtyDisplay: '1 $symbol',
    pnl: pnl,
    pnlDisplay: pnl >= 0 ? '+\$$pnl' : '-\$${pnl.abs()}',
    pnlPctDisplay: '+1%',
    margin: margin,
    marginDisplay: '\$$margin',
    openDisplay: '1',
    liqDisplay: '0.5',
    liqBreached: false,
    hoursAgo: hoursAgo,
    timeDisplay: '$hoursAgo 小时前',
  );
}

void main() {
  group('filterWhaleHoldings', () {
    test('空输入返回空', () {
      expect(
        filterWhaleHoldings(const <WhaleHoldingPosition>[],
            const WhaleHoldingFilter()),
        isEmpty,
      );
    });

    test('默认 filter 不过滤', () {
      final list = <WhaleHoldingPosition>[_pos(), _pos(symbol: 'ETH')];
      expect(filterWhaleHoldings(list, const WhaleHoldingFilter()).length, 2);
    });

    test('按币种过滤', () {
      final list = <WhaleHoldingPosition>[_pos(), _pos(symbol: 'ETH')];
      final out =
          filterWhaleHoldings(list, const WhaleHoldingFilter(coin: 'ETH'));
      expect(out.single.symbol, 'ETH');
    });

    test('按方向过滤 long/short', () {
      final list = <WhaleHoldingPosition>[
        _pos(side: WhaleHoldingSide.long),
        _pos(side: WhaleHoldingSide.short),
      ];
      expect(
        filterWhaleHoldings(list,
                const WhaleHoldingFilter(dir: WhaleHoldingDirFilter.long))
            .single
            .isLong,
        isTrue,
      );
      expect(
        filterWhaleHoldings(list,
                const WhaleHoldingFilter(dir: WhaleHoldingDirFilter.short))
            .single
            .isLong,
        isFalse,
      );
    });

    test('按盈亏过滤 profit/loss', () {
      final list = <WhaleHoldingPosition>[
        _pos(pnl: 10),
        _pos(pnl: -10),
      ];
      expect(
        filterWhaleHoldings(list,
                const WhaleHoldingFilter(pnl: WhaleHoldingPnlFilter.profit))
            .single
            .isProfit,
        isTrue,
      );
      expect(
        filterWhaleHoldings(list,
                const WhaleHoldingFilter(pnl: WhaleHoldingPnlFilter.loss))
            .single
            .isProfit,
        isFalse,
      );
    });

    test('组合过滤：币种+方向+盈亏', () {
      final list = <WhaleHoldingPosition>[
        _pos(symbol: 'ETH', side: WhaleHoldingSide.long, pnl: 10),
        _pos(symbol: 'ETH', side: WhaleHoldingSide.long, pnl: -10),
        _pos(symbol: 'BTC', side: WhaleHoldingSide.long, pnl: 10),
      ];
      final out = filterWhaleHoldings(
        list,
        const WhaleHoldingFilter(
          coin: 'ETH',
          dir: WhaleHoldingDirFilter.long,
          pnl: WhaleHoldingPnlFilter.profit,
        ),
      );
      expect(out.length, 1);
      expect(out.single.symbol, 'ETH');
      expect(out.single.isProfit, isTrue);
    });

    test('不修改入参', () {
      final list = <WhaleHoldingPosition>[_pos(), _pos(symbol: 'ETH')];
      filterWhaleHoldings(list, const WhaleHoldingFilter(coin: 'BTC'));
      expect(list.length, 2);
    });
  });

  group('sortWhaleHoldings', () {
    test('空输入返回空', () {
      expect(
        sortWhaleHoldings(const <WhaleHoldingPosition>[], null),
        isEmpty,
      );
    });

    test('null sort 原序副本', () {
      final list = <WhaleHoldingPosition>[_pos(value: 1), _pos(value: 3)];
      final out = sortWhaleHoldings(list, null);
      expect(out.map((e) => e.value).toList(), <double>[1, 3]);
      expect(identical(out, list), isFalse);
    });

    test('按 value desc', () {
      final list = <WhaleHoldingPosition>[
        _pos(value: 1),
        _pos(value: 3),
        _pos(value: 2),
      ];
      final out = sortWhaleHoldings(
        list,
        const WhaleHoldingSort(
            key: WhaleHoldingSortKey.value, dir: WhaleHoldingSortDir.desc),
      );
      expect(out.map((e) => e.value).toList(), <double>[3, 2, 1]);
    });

    test('按 margin asc', () {
      final list = <WhaleHoldingPosition>[_pos(margin: 30), _pos(margin: 10)];
      final out = sortWhaleHoldings(
        list,
        const WhaleHoldingSort(
            key: WhaleHoldingSortKey.margin, dir: WhaleHoldingSortDir.asc),
      );
      expect(out.map((e) => e.margin).toList(), <double>[10, 30]);
    });

    test('按 time（hoursAgo）desc', () {
      final list = <WhaleHoldingPosition>[_pos(hoursAgo: 2), _pos(hoursAgo: 8)];
      final out = sortWhaleHoldings(
        list,
        const WhaleHoldingSort(
            key: WhaleHoldingSortKey.time, dir: WhaleHoldingSortDir.desc),
      );
      expect(out.map((e) => e.hoursAgo).toList(), <int>[8, 2]);
    });

    test('不修改入参', () {
      final list = <WhaleHoldingPosition>[_pos(value: 1), _pos(value: 3)];
      sortWhaleHoldings(
        list,
        const WhaleHoldingSort(
            key: WhaleHoldingSortKey.value, dir: WhaleHoldingSortDir.desc),
      );
      expect(list.map((e) => e.value).toList(), <double>[1, 3]);
    });
  });

  group('whaleHoldingCoins', () {
    test('空输入返回空', () {
      expect(whaleHoldingCoins(const <WhaleHoldingPosition>[]), isEmpty);
    });

    test('去重并保持首次出现顺序', () {
      final list = <WhaleHoldingPosition>[
        _pos(symbol: 'ETH'),
        _pos(symbol: 'BTC'),
        _pos(symbol: 'ETH'),
      ];
      expect(whaleHoldingCoins(list), <String>['ETH', 'BTC']);
    });
  });

  group('whaleHoldingTradeStats', () {
    test('盈利仓 tone=up，longPct=100', () {
      final stats =
          whaleHoldingTradeStats(_pos(side: WhaleHoldingSide.long, pnl: 10));
      expect(stats.pnlTone, 'up');
      expect(stats.longPct, 100);
      expect(stats.shortPct, 0);
      expect(stats.assetPerf, isEmpty);
    });

    test('亏损空头仓 tone=dn，shortPct=100', () {
      final stats =
          whaleHoldingTradeStats(_pos(side: WhaleHoldingSide.short, pnl: -5));
      expect(stats.pnlTone, 'dn');
      expect(stats.longPct, 0);
      expect(stats.shortPct, 100);
    });
  });

  group('deriveWhaleHoldingsView (#2192)', () {
    test('coins 去重保序 + rows 经筛选排序', () {
      final list = <WhaleHoldingPosition>[
        _pos(symbol: 'BTC', value: 100),
        _pos(symbol: 'ETH', value: 300),
        _pos(symbol: 'BTC', value: 200),
      ];
      final view = deriveWhaleHoldingsView(
        list,
        const WhaleHoldingFilter(),
        const WhaleHoldingSort(
          key: WhaleHoldingSortKey.value,
          dir: WhaleHoldingSortDir.desc,
        ),
      );
      expect(view.coins, <String>['BTC', 'ETH']);
      expect(
        view.rows.map((WhaleHoldingPosition e) => e.value).toList(),
        <double>[300, 200, 100],
      );
    });

    test('filter 收窄到币种后 rows 仅含该币，coins 仍全量', () {
      final list = <WhaleHoldingPosition>[
        _pos(symbol: 'BTC'),
        _pos(symbol: 'ETH'),
      ];
      final view = deriveWhaleHoldingsView(
        list,
        const WhaleHoldingFilter(coin: 'ETH'),
        null,
      );
      expect(view.rows.single.symbol, 'ETH');
      expect(view.coins, <String>['BTC', 'ETH']);
    });

    test('空输入 → 空 view', () {
      final view = deriveWhaleHoldingsView(
        const <WhaleHoldingPosition>[],
        const WhaleHoldingFilter(),
        null,
      );
      expect(view.coins, isEmpty);
      expect(view.rows, isEmpty);
    });
  });
}
