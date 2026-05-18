import '../models/kline_models.dart';
import '../models/long_short_models.dart';
import '../repositories/long_short_repository.dart';
import 'fixtures/long_short.dart';

class MockLongShortRepository implements LongShortRepository {
  @override
  Future<LongShortRatio> getRatio({
    required String symbol,
    required KlineInterval interval,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    final List<double> pair =
        mockLongShortBySymbol[symbol] ?? const <double>[0.5, 0.5];
    return LongShortRatio(
      symbol: symbol,
      longRatio: pair[0],
      shortRatio: pair[1],
      timestamp: DateTime.fromMillisecondsSinceEpoch(1_716_000_000_000),
    );
  }
}
