import '../mock/fixtures/backtest.dart';
import '../models/backtest_models.dart';
import '../repositories/backtest_repository.dart';
import '../services/json_codec.dart';
import '../services/strategy_services.dart';

/// [BacktestRepository] 真实现（issue #2189）。
///
/// 走真实 HTTP 发起/查询回测。[BacktestResult] 含深层图表/交易/风险明细，后端
/// 完整形态契约未定——以 [mockBacktestResult] 作明细骨架，覆盖 JSON 中可得的
/// 顶层核心指标（收益/回撤/夏普/胜率/交易数 等）。完整明细映射属子 issue B。
class ApiBacktestRepository implements BacktestRepository {
  ApiBacktestRepository(this._service);

  final BacktestService _service;

  BacktestResult _merge(dynamic raw) {
    final Map<String, dynamic> m = asMap(raw);
    final BacktestResult base = mockBacktestResult;
    if (m.isEmpty) return base;
    return BacktestResult(
      id: asString(pick(m, <String>['id']), fallback: base.id),
      totalReturnPercent: asDouble(
        pick(m, <String>['totalReturnPercent']),
        fallback: base.totalReturnPercent,
      ),
      cagrPercent:
          asDouble(pick(m, <String>['cagrPercent']), fallback: base.cagrPercent),
      maxDrawdownPercent: asDouble(
        pick(m, <String>['maxDrawdownPercent']),
        fallback: base.maxDrawdownPercent,
      ),
      sharpe: asDouble(pick(m, <String>['sharpe']), fallback: base.sharpe),
      calmar: asDouble(pick(m, <String>['calmar']), fallback: base.calmar),
      winRatePercent: asDouble(
        pick(m, <String>['winRatePercent']),
        fallback: base.winRatePercent,
      ),
      profitLossRatio: asDouble(
        pick(m, <String>['profitLossRatio']),
        fallback: base.profitLossRatio,
      ),
      avgHoldDuration: asString(
        pick(m, <String>['avgHoldDuration']),
        fallback: base.avgHoldDuration,
      ),
      totalTrades:
          asInt(pick(m, <String>['totalTrades']), fallback: base.totalTrades),
      rangeStart:
          asDateTime(pick(m, <String>['rangeStart']), fallback: base.rangeStart),
      rangeEnd: asDateTime(pick(m, <String>['rangeEnd']), fallback: base.rangeEnd),
      equityCurve: base.equityCurve,
      drawdownMarkers: base.drawdownMarkers,
      monthlyRows: base.monthlyRows,
      trades: base.trades,
      riskRows: base.riskRows,
      aiAssessment:
          asString(pick(m, <String>['aiAssessment']), fallback: base.aiAssessment),
    );
  }

  @override
  Future<BacktestResult> run(BacktestRequest request) async {
    final dynamic raw = await _service.run(<String, dynamic>{
      'strategyId': request.strategyId,
      'symbol': request.symbol,
      'startTime': request.startTime.toIso8601String(),
      'endTime': request.endTime.toIso8601String(),
      'params': request.params,
    });
    return _merge(raw);
  }

  @override
  Future<BacktestResult> getResult(String id) async {
    return _merge(await _service.getResult(id));
  }
}
