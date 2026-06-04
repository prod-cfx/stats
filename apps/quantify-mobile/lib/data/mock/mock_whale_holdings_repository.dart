import '../../domain/models/whale_holding_models.dart';
import '../repositories/whale_holdings_repository.dart';
import 'fixtures/whale_holdings.dart';

/// 巨鲸「持仓」tab 持仓明细 mock 实现（issue #1790）。
///
/// 返回 [mockWhaleHoldings]；真实读路径依赖 #1682，接通后整体替换。
class MockWhaleHoldingsRepository implements WhaleHoldingsRepository {
  @override
  Future<List<WhaleHoldingPosition>> getHoldings() async => mockWhaleHoldings;
}
