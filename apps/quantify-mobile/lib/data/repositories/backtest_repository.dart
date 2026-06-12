import '../models/backtest_models.dart';

/// 回测 Repository 接口。
abstract class BacktestRepository {
  Future<BacktestSymbolSupportResult> checkSymbolSupport(
    BacktestSymbolSupportRequest request,
  );

  Future<BacktestResult> run(BacktestRequest request);
  Future<BacktestResult> getResult(String id);
}
