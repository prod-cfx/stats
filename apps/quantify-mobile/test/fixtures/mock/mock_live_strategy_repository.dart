import 'package:quantify_mobile/domain/models/live_strategy_models.dart';
import 'package:quantify_mobile/data/repositories/live_strategy_repository.dart';
import 'fixtures/live_strategies.dart';

/// 实盘策略 mock 实现（#1752）。
///
/// 纯读：固定 200ms 延迟模拟网络。聚合摘要排除 stopped，与设计稿
/// `ScreenLiveStrats` 的 `active` 统计口径一致。
class MockLiveStrategyRepository implements LiveStrategyRepository {
  final List<LiveStrategy> _strategies = List<LiveStrategy>.of(
    mockLiveStrategies,
  );

  int listStrategiesCalls = 0;
  int getStrategyCalls = 0;
  int getPositionCalls = 0;
  int listTradesCalls = 0;
  int listParamsCalls = 0;
  final Set<String> _failingDetailIds = <String>{};

  void upsertForTest(LiveStrategy strategy) {
    final int index = _strategies.indexWhere(
      (LiveStrategy s) => s.id == strategy.id,
    );
    if (index < 0) {
      _strategies.add(strategy);
      return;
    }
    _strategies[index] = strategy;
  }

  void failDetailForTest(String id) {
    _failingDetailIds.add(id);
  }

  @override
  Future<List<LiveStrategy>> listStrategies() async {
    listStrategiesCalls++;
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return List<LiveStrategy>.of(_strategies);
  }

  @override
  Future<LiveStrategy> getStrategy(String id) async {
    getStrategyCalls++;
    await Future<void>.delayed(const Duration(milliseconds: 200));
    if (_failingDetailIds.contains(id)) {
      throw StateError('detail unavailable: $id');
    }
    // 未命中即抛错：详情页据此落入 error 态渲染 liveLoadError，
    // 而非静默回退首条掩盖无效 id（与 repository 注释「调用方决定空态」一致）。
    return _strategies.firstWhere((LiveStrategy s) => s.id == id);
  }

  @override
  Future<LiveStrategySummary> getSummary() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    final List<LiveStrategy> active = _strategies
        .where((LiveStrategy s) => s.isActive)
        .toList();
    double cap = 0;
    double today = 0;
    double total = 0;
    double returnPctTotal = 0;
    double winRateTotal = 0;
    int running = 0;
    int warning = 0;
    int paused = 0;
    double winRateWeighted = 0;
    int tradesTotal = 0;
    for (final LiveStrategy s in active) {
      cap += s.capital;
      today += s.todayPnl;
      total += s.totalPnl;
      returnPctTotal += s.totalPct;
      winRateTotal += s.winRate;
      winRateWeighted += s.winRate * s.trades;
      tradesTotal += s.trades;
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
    final int stopped = _strategies
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
      winRate: tradesTotal == 0 ? 0 : winRateWeighted / tradesTotal,
      averageReturnPct: active.isEmpty ? 0 : returnPctTotal / active.length,
      averageWinRatePct: active.isEmpty ? 0 : winRateTotal / active.length,
    );
  }

  @override
  Future<LiveStrategyPosition?> getPosition(String id) async {
    getPositionCalls++;
    await Future<void>.delayed(const Duration(milliseconds: 120));
    final LiveStrategy s = _strategies.firstWhere(
      (LiveStrategy x) => x.id == id,
    );
    if (!s.mayHavePosition) return null;
    return mockLivePositions[id];
  }

  @override
  Future<List<LiveStrategyTrade>> listTrades(String id, {int limit = 6}) async {
    listTradesCalls++;
    await Future<void>.delayed(const Duration(milliseconds: 150));
    return mockLiveTrades.take(limit).toList();
  }

  @override
  Future<List<LiveStrategyParam>> listParams(String id) async {
    listParamsCalls++;
    await Future<void>.delayed(const Duration(milliseconds: 120));
    return mockLiveParams;
  }

  @override
  Future<LiveStrategy> pause(String id, {bool liquidate = false}) async {
    await Future<void>.delayed(const Duration(milliseconds: 120));
    return _replace(
      id,
      (LiveStrategy s) => s.copyWith(
        status: LiveStrategyStatus.stopped,
        statusNote: '已停止 · 等待恢复',
      ),
    );
  }

  @override
  Future<LiveStrategy> resume(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 120));
    return _replace(
      id,
      (LiveStrategy s) =>
          s.copyWith(status: LiveStrategyStatus.running, statusNote: null),
    );
  }

  @override
  Future<void> softDelete(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 120));
    _replace(
      id,
      (LiveStrategy s) => s.copyWith(
        status: LiveStrategyStatus.stopped,
        statusNote: '已停止 · 28 天后永久删除',
      ),
    );
  }

  @override
  Future<void> permanentDelete(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 120));
    _strategies.removeWhere((LiveStrategy s) => s.id == id);
  }

  LiveStrategy _replace(
    String id,
    LiveStrategy Function(LiveStrategy) transform,
  ) {
    final int index = _strategies.indexWhere((LiveStrategy s) => s.id == id);
    if (index < 0) throw StateError('Live strategy not found: $id');
    final LiveStrategy next = transform(_strategies[index]);
    _strategies[index] = next;
    return next;
  }
}
