import '../models/live_strategy_models.dart';
import '../repositories/live_strategy_repository.dart';
import 'fixtures/live_strategies.dart';

/// 实盘策略 mock 实现（#1752）。
///
/// 纯读：固定 200ms 延迟模拟网络。聚合摘要排除 stopped，与设计稿
/// `ScreenLiveStrats` 的 `active` 统计口径一致。
class MockLiveStrategyRepository implements LiveStrategyRepository {
  @override
  Future<List<LiveStrategy>> listStrategies() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return mockLiveStrategies;
  }

  @override
  Future<LiveStrategy> getStrategy(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    // 未命中即抛错：详情页据此落入 error 态渲染 liveLoadError，
    // 而非静默回退首条掩盖无效 id（与 repository 注释「调用方决定空态」一致）。
    return mockLiveStrategies.firstWhere((LiveStrategy s) => s.id == id);
  }

  @override
  Future<LiveStrategySummary> getSummary() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    final List<LiveStrategy> active =
        mockLiveStrategies.where((LiveStrategy s) => s.isActive).toList();
    double cap = 0;
    double today = 0;
    double total = 0;
    int running = 0;
    int warning = 0;
    int paused = 0;
    for (final LiveStrategy s in active) {
      cap += s.capital;
      today += s.todayPnl;
      total += s.totalPnl;
      switch (s.status) {
        case LiveStrategyStatus.running:
          running++;
        case LiveStrategyStatus.warning:
          warning++;
        case LiveStrategyStatus.paused:
          paused++;
        case LiveStrategyStatus.stopped:
          break;
      }
    }
    final int stopped = mockLiveStrategies
        .where((LiveStrategy s) => s.status == LiveStrategyStatus.stopped)
        .length;
    return LiveStrategySummary(
      totalAssets: cap + total,
      totalCapital: cap,
      todayPnl: today,
      totalPnl: total,
      runningCount: running,
      warningCount: warning,
      pausedCount: paused,
      stoppedCount: stopped,
    );
  }

  @override
  Future<LiveStrategyPosition?> getPosition(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 120));
    final LiveStrategy s =
        mockLiveStrategies.firstWhere((LiveStrategy x) => x.id == id);
    if (!s.mayHavePosition) return null;
    return mockLivePositions[id];
  }

  @override
  Future<List<LiveStrategyTrade>> listTrades(String id, {int limit = 6}) async {
    await Future<void>.delayed(const Duration(milliseconds: 150));
    return mockLiveTrades.take(limit).toList();
  }

  @override
  Future<List<LiveStrategyParam>> listParams(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 120));
    return mockLiveParams;
  }
}
