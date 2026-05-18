import '../models/backtest_models.dart';
import '../repositories/backtest_repository.dart';
import 'fixtures/backtest.dart';

class MockBacktestRepository implements BacktestRepository {
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
