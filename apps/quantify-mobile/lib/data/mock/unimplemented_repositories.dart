import '../models/models.dart';
import '../repositories/repositories.dart';

/// 统一抛出 Dart 内置 [UnimplementedError]，消息携带 Repository 名称，
/// 在 `USE_MOCK=false` 真实 API 接入前作为占位实现。
Never _todo(String repoName) =>
    throw UnimplementedError('真实 API 待接入: $repoName');

class UnimplementedAuthRepository implements AuthRepository {
  @override
  Future<AuthSession> login({required String email, required String password}) =>
      _todo('AuthRepository');
  @override
  Future<void> logout() => _todo('AuthRepository');
  @override
  Stream<AuthSession?> watchSession() => _todo('AuthRepository');
}

class UnimplementedTickerRepository implements TickerRepository {
  @override
  Future<List<Ticker>> listTickers() => _todo('TickerRepository');
  @override
  Stream<Ticker> watchTicker(String symbol) => _todo('TickerRepository');
}

class UnimplementedKlineRepository implements KlineRepository {
  @override
  Future<List<Candle>> listCandles({
    required String symbol,
    required KlineInterval interval,
    required int limit,
  }) =>
      _todo('KlineRepository');
  @override
  Stream<Candle> watchCandles({
    required String symbol,
    required KlineInterval interval,
  }) =>
      _todo('KlineRepository');
}

class UnimplementedOrderbookRepository implements OrderbookRepository {
  @override
  Future<OrderbookSnapshot> getSnapshot(String symbol) =>
      _todo('OrderbookRepository');
  @override
  Stream<OrderbookSnapshot> watchOrderbook(String symbol) =>
      _todo('OrderbookRepository');
}

class UnimplementedLongShortRepository implements LongShortRepository {
  @override
  Future<LongShortRatio> getRatio({
    required String symbol,
    required KlineInterval interval,
  }) =>
      _todo('LongShortRepository');
}

class UnimplementedWhaleFeedRepository implements WhaleFeedRepository {
  @override
  Future<List<WhaleEvent>> listRecent({required int limit}) =>
      _todo('WhaleFeedRepository');
  @override
  Stream<WhaleEvent> watchFeed() => _todo('WhaleFeedRepository');
}

class UnimplementedStrategyRepository implements StrategyRepository {
  @override
  Future<List<StrategyCard>> listFeatured() => _todo('StrategyRepository');
  @override
  Future<List<StrategyCard>> listMine() => _todo('StrategyRepository');
  @override
  Future<StrategyCard> getDetail(String id) => _todo('StrategyRepository');
  @override
  Future<StrategyMarketPage> listMarket({
    int page = 1,
    int pageSize = 10,
    String? query,
    StrategyCategory? category,
  }) =>
      _todo('StrategyRepository');
}

class UnimplementedAiChatRepository implements AiChatRepository {
  @override
  Future<ChatTurn> sendMessage(ChatTurn turn) => _todo('AiChatRepository');
  @override
  Stream<ChatTurn> watchSession(String sessionId) => _todo('AiChatRepository');
  @override
  Future<BacktestSummary?> latestBacktest(String sessionId) =>
      _todo('AiChatRepository');
}

class UnimplementedBacktestRepository implements BacktestRepository {
  @override
  Future<BacktestResult> run(BacktestRequest request) =>
      _todo('BacktestRepository');
  @override
  Future<BacktestResult> getResult(String id) => _todo('BacktestRepository');
}

class UnimplementedAccountRepository implements AccountRepository {
  @override
  Future<AccountInfo> getInfo() => _todo('AccountRepository');
  @override
  Stream<AccountInfo> watchInfo() => _todo('AccountRepository');
}

class UnimplementedApiKeyRepository implements ApiKeyRepository {
  @override
  Future<List<ExchangeApiKey>> listKeys() => _todo('ApiKeyRepository');
  @override
  Future<ExchangeApiKey> addKey(ExchangeApiKey key) =>
      _todo('ApiKeyRepository');
  @override
  Future<void> removeKey(String id) => _todo('ApiKeyRepository');
}
