import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:quantify_mobile/data/providers/business_providers.dart';
import 'package:quantify_mobile/data/providers/repository_providers.dart';
import 'package:quantify_mobile/data/repositories/live_strategy_repository.dart';
import 'package:quantify_mobile/domain/models/live_strategy_models.dart';

class _FailingLiveStrategyRepository implements LiveStrategyRepository {
  final List<LiveStrategy> rows = <LiveStrategy>[
    const LiveStrategy(
      id: 'live-1',
      name: '真实策略',
      pair: 'BTCUSDT',
      timeframe: '15m',
      exchange: 'Binance',
      exchangeGlyph: 'B',
      market: '永续',
      status: LiveStrategyStatus.running,
      runFor: '1 天',
      todayPct: 0,
      todayPnl: 0,
      totalPct: 0,
      totalPnl: 0,
      capital: 1000,
      trades: 0,
      winRate: 0,
      spark: <double>[],
    ),
  ];

  @override
  Future<List<LiveStrategy>> listStrategies() async => rows;

  @override
  Future<LiveStrategy> getStrategy(String id) async => rows.first;

  @override
  Future<LiveStrategySummary> getSummary() async => const LiveStrategySummary(
    totalAssets: 1000,
    totalCapital: 1000,
    todayPnl: 0,
    totalPnl: 0,
    runningCount: 1,
    warningCount: 0,
    pausedCount: 0,
    stoppedCount: 0,
  );

  @override
  Future<LiveStrategyPosition?> getPosition(String id) async => null;

  @override
  Future<List<LiveStrategyTrade>> listTrades(
    String id, {
    int limit = 6,
  }) async => const <LiveStrategyTrade>[];

  @override
  Future<List<LiveStrategyParam>> listParams(String id) async =>
      const <LiveStrategyParam>[];

  @override
  Future<LiveStrategy> pause(String id, {bool liquidate = false}) async =>
      throw StateError('backend down');

  @override
  Future<LiveStrategy> resume(String id) async =>
      throw StateError('backend down');

  @override
  Future<void> softDelete(String id) async => throw StateError('backend down');

  @override
  Future<void> permanentDelete(String id) async =>
      throw StateError('backend down');
}

void main() {
  test(
    'LiveStrategyStore rolls back optimistic pause when repository fails',
    () async {
      final ProviderContainer container = ProviderContainer(
        overrides: <Override>[
          liveStrategyRepositoryProvider.overrideWithValue(
            _FailingLiveStrategyRepository(),
          ),
        ],
      );
      addTearDown(container.dispose);

      final List<LiveStrategy> before = await container.read(
        liveStrategyStoreProvider.future,
      );
      expect(before.single.status, LiveStrategyStatus.running);

      await expectLater(
        container.read(liveStrategyStoreProvider.notifier).pause('live-1'),
        throwsStateError,
      );

      final List<LiveStrategy> after = container
          .read(liveStrategyStoreProvider)
          .value!;
      expect(after.single.status, LiveStrategyStatus.running);
    },
  );
}
