import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/domain/models/live_strategy_models.dart';
import 'package:quantify_mobile/domain/use_cases/live_strategy_use_cases.dart';

LiveStrategy _strat({
  String id = '1',
  double todayPnl = 0,
  double totalPnl = 0,
  double totalPct = 0,
  double winRate = 0,
  double capital = 0,
  String runFor = '0 天',
}) {
  return LiveStrategy(
    id: id,
    name: 'S$id',
    pair: 'BTC/USDT',
    timeframe: '15m',
    exchange: 'Binance',
    exchangeGlyph: 'B',
    market: '合约 5x',
    status: LiveStrategyStatus.running,
    runFor: runFor,
    todayPct: 0,
    todayPnl: todayPnl,
    totalPct: totalPct,
    totalPnl: totalPnl,
    capital: capital,
    trades: 0,
    winRate: winRate,
    spark: const <double>[],
  );
}

void main() {
  group('sortStrategies', () {
    test('空输入返回空', () {
      expect(sortStrategies(const <LiveStrategy>[], LiveSortMetric.todayPnl,
              LiveSortDirection.desc),
          isEmpty);
    });

    test('metric=null 原序副本', () {
      final list = <LiveStrategy>[_strat(id: 'a'), _strat(id: 'b')];
      final out = sortStrategies(list, null, LiveSortDirection.desc);
      expect(out.map((e) => e.id).toList(), <String>['a', 'b']);
      expect(identical(out, list), isFalse);
    });

    test('dir=none 原序副本', () {
      final list = <LiveStrategy>[_strat(id: 'a'), _strat(id: 'b')];
      final out =
          sortStrategies(list, LiveSortMetric.todayPnl, LiveSortDirection.none);
      expect(out.map((e) => e.id).toList(), <String>['a', 'b']);
    });

    test('按 totalPnl desc', () {
      final list = <LiveStrategy>[
        _strat(id: 'a', totalPnl: 1),
        _strat(id: 'b', totalPnl: 3),
        _strat(id: 'c', totalPnl: 2),
      ];
      final out =
          sortStrategies(list, LiveSortMetric.totalPnl, LiveSortDirection.desc);
      expect(out.map((e) => e.id).toList(), <String>['b', 'c', 'a']);
    });

    test('按 capital asc', () {
      final list = <LiveStrategy>[
        _strat(id: 'a', capital: 30),
        _strat(id: 'b', capital: 10),
      ];
      final out =
          sortStrategies(list, LiveSortMetric.capital, LiveSortDirection.asc);
      expect(out.map((e) => e.id).toList(), <String>['b', 'a']);
    });

    test('按 winRate desc', () {
      final list = <LiveStrategy>[
        _strat(id: 'a', winRate: 40),
        _strat(id: 'b', winRate: 80),
      ];
      final out =
          sortStrategies(list, LiveSortMetric.winRate, LiveSortDirection.desc);
      expect(out.map((e) => e.id).toList(), <String>['b', 'a']);
    });

    test('runForDays 解析前导数字排序', () {
      final list = <LiveStrategy>[
        _strat(id: 'a', runFor: '3 天'),
        _strat(id: 'b', runFor: '14 天'),
        _strat(id: 'c', runFor: '无效'),
      ];
      final out = sortStrategies(
          list, LiveSortMetric.runForDays, LiveSortDirection.desc);
      expect(out.map((e) => e.id).toList(), <String>['b', 'a', 'c']);
    });

    test('不修改入参', () {
      final list = <LiveStrategy>[
        _strat(id: 'a', totalPnl: 1),
        _strat(id: 'b', totalPnl: 3),
      ];
      sortStrategies(list, LiveSortMetric.totalPnl, LiveSortDirection.desc);
      expect(list.map((e) => e.id).toList(), <String>['a', 'b']);
    });
  });
}
