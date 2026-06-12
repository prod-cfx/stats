import 'package:quantify_mobile/data/models/backtest_models.dart';
import 'package:quantify_mobile/data/repositories/backtest_repository.dart';
import 'fixtures/backtest.dart';

class MockBacktestRepository implements BacktestRepository {
  @override
  Future<BacktestSymbolSupportResult> checkSymbolSupport(
    BacktestSymbolSupportRequest request,
  ) async {
    return const BacktestSymbolSupportResult(supported: true);
  }

  @override
  Future<BacktestResult> run(BacktestRequest request) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return mockBacktestResult;
  }

  @override
  Future<BacktestResult> getResult(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return mockBacktestResult;
  }
}
