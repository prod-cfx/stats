import '../../domain/models/models.dart';
import '../models/models.dart';
import '../repositories/repositories.dart';

/// 统一抛出 Dart 内置 [UnimplementedError]，消息携带 Repository 名称，
/// 在 `USE_MOCK=false` 真实 API 接入前作为占位实现。
Never _todo(String repoName) =>
    throw UnimplementedError('真实 API 待接入: $repoName');

class UnimplementedAuthRepository implements AuthRepository {
  @override
  Future<AuthSession> login({
    required String email,
    required String password,
  }) => _todo('AuthRepository');
  @override
  Future<void> sendLoginCode({required String email}) =>
      _todo('AuthRepository');
  @override
  Future<AuthSession> loginWithCode({
    required String email,
    required String code,
  }) => _todo('AuthRepository');
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
  }) => _todo('KlineRepository');
  @override
  Stream<Candle> watchCandles({
    required String symbol,
    required KlineInterval interval,
  }) => _todo('KlineRepository');
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
  }) => _todo('LongShortRepository');

  @override
  Future<MarketLongShortSnapshot> getSnapshot({required String symbol}) =>
      _todo('LongShortRepository');
}

class UnimplementedWhaleFeedRepository implements WhaleFeedRepository {
  @override
  Future<List<WhaleEvent>> listRecent({required int limit}) =>
      _todo('WhaleFeedRepository');
  @override
  Stream<WhaleEvent> watchFeed() => _todo('WhaleFeedRepository');
}

class UnimplementedWhaleLeaderboardRepository
    implements WhaleLeaderboardRepository {
  @override
  Future<List<WhaleLeaderEntry>> getLeaderboard() =>
      _todo('WhaleLeaderboardRepository');
}

class UnimplementedWhaleHoldingsRepository implements WhaleHoldingsRepository {
  @override
  Future<List<WhaleHoldingPosition>> getHoldings() =>
      _todo('WhaleHoldingsRepository');
}

class UnimplementedWhaleProfileRepository implements WhaleProfileRepository {
  @override
  Future<WhaleProfile> getProfile(String address) =>
      _todo('WhaleProfileRepository');
}

class UnimplementedWhaleWatchRepository implements WhaleWatchRepository {
  @override
  Future<List<WatchRule>> listRules() => _todo('WhaleWatchRepository');
  @override
  Future<List<WhaleSearchResult>> search(String query) =>
      _todo('WhaleWatchRepository');
}

class UnimplementedLiveStrategyRepository implements LiveStrategyRepository {
  @override
  Future<List<LiveStrategy>> listStrategies() =>
      _todo('LiveStrategyRepository');
  @override
  Future<LiveStrategy> getStrategy(String id) =>
      _todo('LiveStrategyRepository');
  @override
  Future<LiveStrategySummary> getSummary() => _todo('LiveStrategyRepository');
  @override
  Future<LiveStrategyPosition?> getPosition(String id) =>
      _todo('LiveStrategyRepository');
  @override
  Future<List<LiveStrategyTrade>> listTrades(String id, {int limit = 6}) =>
      _todo('LiveStrategyRepository');
  @override
  Future<List<LiveStrategyParam>> listParams(String id) =>
      _todo('LiveStrategyRepository');
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
  }) => _todo('StrategyRepository');
  @override
  Future<StrategyMarketItem> getFeaturedHero() => _todo('StrategyRepository');
  @override
  Future<StrategyDetail> getStrategyDetail(String id) =>
      _todo('StrategyRepository');
  @override
  Future<List<StrategySignal>> listStrategySignals(
    String id, {
    int limit = 20,
  }) => _todo('StrategyRepository');
  @override
  Future<List<double>> getEquityCurve(String id, EquityTimeframe timeframe) =>
      _todo('StrategyRepository');
}

class UnimplementedAiChatRepository implements AiChatRepository {
  @override
  Future<List<AiSession>> listSessions() => _todo('AiChatRepository');
  @override
  Future<AiSession> createSession({String? title}) => _todo('AiChatRepository');
  @override
  Future<void> deleteSession(String sessionId) => _todo('AiChatRepository');
  @override
  Future<ChatTurn> sendMessageTo(String sessionId, ChatTurn turn) =>
      _todo('AiChatRepository');
  @override
  Stream<ChatTurn> watchSession(String sessionId) => _todo('AiChatRepository');
  @override
  Future<BacktestSummary?> latestBacktest(String sessionId) =>
      _todo('AiChatRepository');
  @override
  Future<AiSession?> markDeployed(String sessionId, String instanceId) =>
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
  Future<ExchangeApiKey> addKey({
    required String exchange,
    required String label,
    required String apiKey,
    required String apiSecret,
    String? apiPassphrase,
  }) => _todo('ApiKeyRepository');
  @override
  Future<void> removeKey(String id) => _todo('ApiKeyRepository');
}
