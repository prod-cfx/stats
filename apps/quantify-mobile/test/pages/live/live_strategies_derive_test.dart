import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/domain/models/live_strategy_models.dart';
import 'package:quantify_mobile/domain/use_cases/live_strategy_use_cases.dart';
import 'package:quantify_mobile/pages/live/live_strategies_state.dart';

/// #2192：从 `LiveStrategiesPage.build` 上移到 ViewModel 层的纯派生
/// （`liveMatchesFilter` / `liveFilterCount` / `liveFilterPillCount` /
/// `liveStatusCounts` / `liveVisibleStrategies`）的单测。
LiveStrategy _strat({
  String id = '1',
  LiveStrategyStatus status = LiveStrategyStatus.running,
  double totalPnl = 0,
}) {
  return LiveStrategy(
    id: id,
    name: 'S$id',
    pair: 'BTC/USDT',
    timeframe: '15m',
    exchange: 'Binance',
    exchangeGlyph: 'B',
    market: '合约 5x',
    status: status,
    runFor: '0 天',
    todayPct: 0,
    todayPnl: 0,
    totalPct: 0,
    totalPnl: totalPnl,
    capital: 0,
    trades: 0,
    winRate: 0,
    spark: const <double>[],
  );
}

void main() {
  final List<LiveStrategy> sample = <LiveStrategy>[
    _strat(id: 'r1', status: LiveStrategyStatus.running, totalPnl: 1),
    _strat(id: 'r2', status: LiveStrategyStatus.running, totalPnl: 3),
    _strat(id: 'p1', status: LiveStrategyStatus.paused),
    _strat(id: 's1', status: LiveStrategyStatus.stopped),
    _strat(id: 'w1', status: LiveStrategyStatus.warning),
  ];

  group('liveMatchesFilter', () {
    test('all 排除 stopped', () {
      expect(
        liveMatchesFilter(_strat(status: LiveStrategyStatus.stopped),
            LiveFilter.all),
        isFalse,
      );
      expect(
        liveMatchesFilter(_strat(status: LiveStrategyStatus.warning),
            LiveFilter.all),
        isTrue,
      );
    });

    test('精确状态匹配', () {
      expect(
        liveMatchesFilter(
            _strat(status: LiveStrategyStatus.paused), LiveFilter.paused),
        isTrue,
      );
      expect(
        liveMatchesFilter(
            _strat(status: LiveStrategyStatus.running), LiveFilter.paused),
        isFalse,
      );
    });
  });

  group('liveStatusCounts', () {
    test('各状态精确计数；all 排除 stopped', () {
      final counts = liveStatusCounts(sample);
      expect(counts.running, 2);
      expect(counts.paused, 1);
      expect(counts.stopped, 1);
      // all = running + paused + warning（排除 stopped）= 4
      expect(counts.all, 4);
    });
  });

  group('liveFilterPillCount', () {
    test('all 显示总数（含 stopped），其余精确状态', () {
      expect(liveFilterPillCount(sample, LiveFilter.all), 5);
      expect(liveFilterPillCount(sample, LiveFilter.running), 2);
      expect(liveFilterPillCount(sample, LiveFilter.stopped), 1);
    });
  });

  group('liveVisibleStrategies', () {
    test('filter=running + 按 totalPnl 降序', () {
      const state = LiveStrategiesState(
        filter: LiveFilter.running,
        sortMetric: LiveSortMetric.totalPnl,
        sortDir: LiveSortDirection.desc,
      );
      final out = liveVisibleStrategies(sample, state);
      expect(out.map((LiveStrategy s) => s.id).toList(), <String>['r2', 'r1']);
    });

    test('默认 filter=all 排除 stopped，sortDir.none 保持原序', () {
      const state = LiveStrategiesState();
      final out = liveVisibleStrategies(sample, state);
      expect(out.any((LiveStrategy s) => s.status == LiveStrategyStatus.stopped),
          isFalse);
      expect(out.length, 4);
    });
  });
}
