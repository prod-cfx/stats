import 'package:flutter_riverpod/flutter_riverpod.dart';
// `FutureProviderFamily` 在 Riverpod 3.x 未由 flutter_riverpod 公开导出，
// family provider 的显式类型注解需直连 misc。
import 'package:riverpod/misc.dart' show FutureProviderFamily;

import '../theme/theme_notifier.dart' show sharedPreferencesProvider;
import 'models/account_models.dart';
import 'models/agg_market_data.dart';
import 'models/api_key_models.dart';
import 'models/backtest_models.dart';
import 'models/coin_stock_models.dart';
import 'models/pred_market_models.dart';
import 'models/ticker_models.dart';
import 'models/trade_models.dart';
import 'models/whale_extra_models.dart';
import 'mock/fixtures/live_strategies.dart' show mockLivePositions;
import '../domain/models/live_strategy_models.dart';
import 'storage/market_favorites_persistence.dart';
import 'storage/strategy_favorites_persistence.dart';
import 'storage/strategy_search_history_persistence.dart';
import 'storage/strategy_subscription_persistence.dart';
import 'mock/mock_account_repository.dart';
import 'mock/mock_agg_orderbook_repository.dart';
import 'mock/mock_ai_chat_repository.dart';
import 'mock/mock_coin_stock_repository.dart';
import 'mock/mock_pred_market_repository.dart';
import 'mock/mock_trades_repository.dart';
import 'mock/mock_whale_extras_repository.dart';
import 'mock/mock_api_key_repository.dart';
import 'mock/mock_auth_repository.dart';
import 'mock/mock_backtest_repository.dart';
import 'mock/mock_kline_repository.dart';
import 'mock/mock_live_strategy_repository.dart';
import 'mock/mock_long_short_repository.dart';
import 'mock/mock_orderbook_repository.dart';
import 'mock/mock_strategy_repository.dart';
import 'mock/mock_ticker_repository.dart';
import 'mock/mock_whale_feed_repository.dart';
import 'mock/mock_whale_holdings_repository.dart';
import 'mock/mock_whale_leaderboard_repository.dart';
import 'mock/mock_whale_profile_repository.dart';
import 'mock/mock_whale_watch_repository.dart';
import 'api/api.dart';
import 'services/services.dart';
import '../domain/models/whale_holding_models.dart';
import '../domain/models/whale_leader_models.dart';
import 'models/whale_profile_models.dart';
import 'repositories/repositories.dart';

/// `USE_MOCK` 启动开关。
///
/// 严格解析：只有显式传入 `false`（不区分大小写）才视为关闭 mock，
/// 其它任何值（含缺省）一律视为 mock 模式。
///
/// 使用方式：`flutter run --dart-define=USE_MOCK=false`
const String _kUseMockEnv = String.fromEnvironment(
  'USE_MOCK',
  defaultValue: 'true',
);

final Provider<bool> useMockProvider = Provider<bool>((Ref ref) {
  return _kUseMockEnv.toLowerCase() != 'false';
});

/// 后端 baseUrl（`USE_MOCK=false` 时生效）。
///
/// 通过 `flutter run --dart-define=API_BASE_URL=https://...` 注入；缺省占位
/// 指向本地 quantify 服务端口。契约就绪后按环境配置校正。
const String _kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:3010',
);

/// 统一后端 HTTP 客户端（issue #2189）。所有 Service 共享一个 [ApiClient]
/// 实例。鉴权 token 由 [AuthRepository] 的会话态提供（接通登录态后可在此
/// 注入 tokenSupplier）；本迭代先保留匿名 client。
final Provider<ApiClient> apiClientProvider = Provider<ApiClient>((Ref ref) {
  return ApiClient(baseUrl: _kApiBaseUrl);
});

// ── 各域 Service（stateless，注入共享 ApiClient）─────────────────────────
final Provider<AuthService> authServiceProvider =
    Provider<AuthService>((Ref ref) => AuthService(ref.watch(apiClientProvider)));
final Provider<TickerService> tickerServiceProvider = Provider<TickerService>(
    (Ref ref) => TickerService(ref.watch(apiClientProvider)));
final Provider<KlineService> klineServiceProvider = Provider<KlineService>(
    (Ref ref) => KlineService(ref.watch(apiClientProvider)));
final Provider<OrderbookService> orderbookServiceProvider =
    Provider<OrderbookService>(
        (Ref ref) => OrderbookService(ref.watch(apiClientProvider)));
final Provider<LongShortService> longShortServiceProvider =
    Provider<LongShortService>(
        (Ref ref) => LongShortService(ref.watch(apiClientProvider)));
final Provider<WhaleFeedService> whaleFeedServiceProvider =
    Provider<WhaleFeedService>(
        (Ref ref) => WhaleFeedService(ref.watch(apiClientProvider)));
final Provider<WhaleLeaderboardService> whaleLeaderboardServiceProvider =
    Provider<WhaleLeaderboardService>(
        (Ref ref) => WhaleLeaderboardService(ref.watch(apiClientProvider)));
final Provider<WhaleHoldingsService> whaleHoldingsServiceProvider =
    Provider<WhaleHoldingsService>(
        (Ref ref) => WhaleHoldingsService(ref.watch(apiClientProvider)));
final Provider<WhaleProfileService> whaleProfileServiceProvider =
    Provider<WhaleProfileService>(
        (Ref ref) => WhaleProfileService(ref.watch(apiClientProvider)));
final Provider<WhaleWatchService> whaleWatchServiceProvider =
    Provider<WhaleWatchService>(
        (Ref ref) => WhaleWatchService(ref.watch(apiClientProvider)));
final Provider<StrategyService> strategyServiceProvider =
    Provider<StrategyService>(
        (Ref ref) => StrategyService(ref.watch(apiClientProvider)));
final Provider<LiveStrategyService> liveStrategyServiceProvider =
    Provider<LiveStrategyService>(
        (Ref ref) => LiveStrategyService(ref.watch(apiClientProvider)));
final Provider<AiChatService> aiChatServiceProvider = Provider<AiChatService>(
    (Ref ref) => AiChatService(ref.watch(apiClientProvider)));
final Provider<BacktestService> backtestServiceProvider =
    Provider<BacktestService>(
        (Ref ref) => BacktestService(ref.watch(apiClientProvider)));
final Provider<AccountService> accountServiceProvider =
    Provider<AccountService>(
        (Ref ref) => AccountService(ref.watch(apiClientProvider)));
final Provider<ApiKeyService> apiKeyServiceProvider = Provider<ApiKeyService>(
    (Ref ref) => ApiKeyService(ref.watch(apiClientProvider)));

final Provider<AuthRepository> authRepositoryProvider =
    Provider<AuthRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockAuthRepository()
          : ApiAuthRepository(ref.watch(authServiceProvider));
    });

final Provider<TickerRepository> tickerRepositoryProvider =
    Provider<TickerRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockTickerRepository()
          : ApiTickerRepository(ref.watch(tickerServiceProvider));
    });

// ── market 域数据 Provider（issue #2216）──────────────────────────────────
// pages/market 不再直接 import data/mock/fixtures，统一经下列 Provider 取数。
// 后端就绪（#2189）后只需在各 repository provider 加 Api 分支，UI 不动。

/// 行情列表（#2216）。多空比页 watch 取 symbol 列表。复用 [tickerRepositoryProvider]。
final FutureProvider<List<Ticker>> tickersProvider =
    FutureProvider<List<Ticker>>((Ref ref) async {
      return ref.watch(tickerRepositoryProvider).listTickers();
    });

/// 币股 Repository（#2216）。mock 驱动；接后端属 #2189。
final Provider<CoinStockRepository> coinStockRepositoryProvider =
    Provider<CoinStockRepository>((Ref ref) {
      return const MockCoinStockRepository();
    });

/// 币股列表（#2216）。币股 hub 子屏 watch。
final FutureProvider<List<CoinStock>> coinStocksProvider =
    FutureProvider<List<CoinStock>>((Ref ref) async {
      return ref.watch(coinStockRepositoryProvider).listCoinStocks();
    });

/// 预测市场 Repository（#2216）。mock 驱动；接后端属 #2189。
final Provider<PredMarketRepository> predMarketRepositoryProvider =
    Provider<PredMarketRepository>((Ref ref) {
      return const MockPredMarketRepository();
    });

/// 预测市场列表（#2216）。预测市场 hub 子屏 watch。
final FutureProvider<List<PredMarket>> predMarketsProvider =
    FutureProvider<List<PredMarket>>((Ref ref) async {
      return ref.watch(predMarketRepositoryProvider).listPredMarkets();
    });

/// 巨鲸「数据」hub 附加数据 Repository（#2216）。mock 驱动；接后端属 #2189。
final Provider<WhaleExtrasRepository> whaleExtrasRepositoryProvider =
    Provider<WhaleExtrasRepository>((Ref ref) {
      return const MockWhaleExtrasRepository();
    });

/// data hub 通知列表（#2216）。data hub 控制器初始 seed。
final FutureProvider<List<WhaleNotification>> whaleExtrasProvider =
    FutureProvider<List<WhaleNotification>>((Ref ref) async {
      return ref.watch(whaleExtrasRepositoryProvider).listNotifications();
    });

/// 成交记录 Repository（#2216）。mock 驱动；接后端属 #2189。
final Provider<TradesRepository> tradesRepositoryProvider =
    Provider<TradesRepository>((Ref ref) {
      return const MockTradesRepository();
    });

/// 成交记录列表（#2216），family by `(symbol, mid)`。成交面板 watch；
/// `mid` 锚价由调用方（详情页快照价）注入，mock 据此生成滚动成交。
final FutureProviderFamily<List<Trade>, (String, double)> tradesProvider =
    FutureProvider.family<List<Trade>, (String, double)>((
      Ref ref,
      (String, double) args,
    ) async {
      return ref
          .watch(tradesRepositoryProvider)
          .listTrades(symbol: args.$1, mid: args.$2);
    });

/// 聚合市场数据 Repository（#2216）。mock 驱动；接后端属 #2189。
final Provider<AggOrderbookRepository> aggOrderbookRepositoryProvider =
    Provider<AggOrderbookRepository>((Ref ref) {
      return const MockAggOrderbookRepository();
    });

/// 聚合市场数据 bundle（#2216）。4 个 `agg_*` widget 统一 watch 此单一共享
/// Provider 取原始 levels 与各表静态数据；派生留 widget（C4 #2218 收口上移）。
final FutureProvider<AggMarketData> aggOrderbookProvider =
    FutureProvider<AggMarketData>((Ref ref) async {
      return ref.watch(aggOrderbookRepositoryProvider).getMarketData();
    });

final Provider<KlineRepository> klineRepositoryProvider =
    Provider<KlineRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockKlineRepository()
          : ApiKlineRepository(ref.watch(klineServiceProvider));
    });

final Provider<OrderbookRepository> orderbookRepositoryProvider =
    Provider<OrderbookRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockOrderbookRepository()
          : ApiOrderbookRepository(ref.watch(orderbookServiceProvider));
    });

final Provider<LongShortRepository> longShortRepositoryProvider =
    Provider<LongShortRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockLongShortRepository()
          : ApiLongShortRepository(ref.watch(longShortServiceProvider));
    });

final Provider<WhaleFeedRepository> whaleFeedRepositoryProvider =
    Provider<WhaleFeedRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockWhaleFeedRepository()
          : ApiWhaleFeedRepository(ref.watch(whaleFeedServiceProvider));
    });

final Provider<WhaleProfileRepository> whaleProfileRepositoryProvider =
    Provider<WhaleProfileRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockWhaleProfileRepository()
          : ApiWhaleProfileRepository(ref.watch(whaleProfileServiceProvider));
    });

/// 单个巨鲸地址画像（#1753）。地址详情页 watch；未命中已知地址由 mock
/// 派生 fallback，真实读路径依赖 #1682。
final FutureProviderFamily<WhaleProfile, String> whaleProfileProvider =
    FutureProvider.family<WhaleProfile, String>((
      Ref ref,
      String address,
    ) async {
      return ref.watch(whaleProfileRepositoryProvider).getProfile(address);
    });

/// 巨鲸「发现」tab 排行榜 repository（#1789）。mock 驱动；真实读路径依赖 #1682。
final Provider<WhaleLeaderboardRepository> whaleLeaderboardRepositoryProvider =
    Provider<WhaleLeaderboardRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockWhaleLeaderboardRepository()
          : ApiWhaleLeaderboardRepository(
              ref.watch(whaleLeaderboardServiceProvider),
            );
    });

/// 巨鲸排行榜列表（#1789）。发现 tab watch；排序在 tab 本地态完成。
final FutureProvider<List<WhaleLeaderEntry>> whaleLeaderboardProvider =
    FutureProvider<List<WhaleLeaderEntry>>((Ref ref) async {
      return ref.watch(whaleLeaderboardRepositoryProvider).getLeaderboard();
    });

/// 巨鲸「持仓」tab 持仓明细 repository（#1790）。mock 驱动；真实读路径依赖 #1682。
final Provider<WhaleHoldingsRepository> whaleHoldingsRepositoryProvider =
    Provider<WhaleHoldingsRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockWhaleHoldingsRepository()
          : ApiWhaleHoldingsRepository(
              ref.watch(whaleHoldingsServiceProvider),
            );
    });

/// 巨鲸持仓明细列表（#1790）。持仓 tab watch；筛选与排序在 tab 本地态完成。
final FutureProvider<List<WhaleHoldingPosition>> whaleHoldingsProvider =
    FutureProvider<List<WhaleHoldingPosition>>((Ref ref) async {
      return ref.watch(whaleHoldingsRepositoryProvider).getHoldings();
    });

/// 巨鲸搜索与地址监控（#1754）。mock 驱动；真实读写依赖 #1682/#1683。
final Provider<WhaleWatchRepository> whaleWatchRepositoryProvider =
    Provider<WhaleWatchRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? const MockWhaleWatchRepository()
          : ApiWhaleWatchRepository(ref.watch(whaleWatchServiceProvider));
    });

final Provider<StrategyRepository> strategyRepositoryProvider =
    Provider<StrategyRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockStrategyRepository()
          : ApiStrategyRepository(ref.watch(strategyServiceProvider));
    });

final Provider<LiveStrategyRepository> liveStrategyRepositoryProvider =
    Provider<LiveStrategyRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockLiveStrategyRepository()
          : ApiLiveStrategyRepository(ref.watch(liveStrategyServiceProvider));
    });

final Provider<AiChatRepository> aiChatRepositoryProvider =
    Provider<AiChatRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockAiChatRepository()
          : ApiAiChatRepository(ref.watch(aiChatServiceProvider));
    });

final Provider<BacktestRepository> backtestRepositoryProvider =
    Provider<BacktestRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockBacktestRepository()
          : ApiBacktestRepository(ref.watch(backtestServiceProvider));
    });

/// 回测结果（#2215）。结果页 watch；mock-first 阶段固定 scenario id `'mock'`
/// 收敛于此处一处，View 不再在 build() 里硬编码或新建 future。真实回测 id
/// 参数化（改 family + 页面入参）依赖后端接入 #2189，本 Issue 不做。
final FutureProvider<BacktestResult> backtestResultProvider =
    FutureProvider<BacktestResult>((Ref ref) async {
      return ref.watch(backtestRepositoryProvider).getResult('mock');
    });

final Provider<AccountRepository> accountRepositoryProvider =
    Provider<AccountRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockAccountRepository()
          : ApiAccountRepository(ref.watch(accountServiceProvider));
    });

final Provider<ApiKeyRepository> apiKeyRepositoryProvider =
    Provider<ApiKeyRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockApiKeyRepository()
          : ApiApiKeyRepository(ref.watch(apiKeyServiceProvider));
    });

/// 当前账户概要。从 `/me` 主页 watch；写入路径走 repository。
final FutureProvider<AccountInfo> accountInfoProvider =
    FutureProvider<AccountInfo>((Ref ref) async {
      return ref.watch(accountRepositoryProvider).getInfo();
    });

/// 交易所凭据列表。被「我的」首页摘要、API 表单 sheet、一键部署弹层共同
/// watch；新增/删除后调用方应 `ref.invalidate(apiKeysProvider)` 让各处同步
/// 刷新（issue #1648：入口统一为 bottom sheet 后无独立列表页）。
final FutureProvider<List<ExchangeApiKey>> apiKeysProvider =
    FutureProvider<List<ExchangeApiKey>>((Ref ref) async {
      return ref.watch(apiKeyRepositoryProvider).listKeys();
    });

final Provider<StrategySubscriptionPersistence>
strategySubscriptionPersistenceProvider =
    Provider<StrategySubscriptionPersistence>((Ref ref) {
      return StrategySubscriptionPersistence(
        ref.watch(sharedPreferencesProvider),
      );
    });

/// 已订阅策略 id 集合。
///
/// `build()` 同步从 SharedPreferences 读取（与 ThemeNotifier 同模式：上层
/// `main()` 已 override `sharedPreferencesProvider` 为 resolved 实例）。
/// `toggle(id)` 会乐观更新内存状态，再写盘；写盘失败回滚到先前快照避免
/// 内存与磁盘漂移。
class StrategySubscriptionsNotifier extends Notifier<Set<String>> {
  @override
  Set<String> build() {
    return ref.watch(strategySubscriptionPersistenceProvider).read();
  }

  bool isSubscribed(String id) => state.contains(id);

  Future<void> toggle(String id) async {
    final Set<String> previous = state;
    final Set<String> next = <String>{...previous};
    if (!next.add(id)) next.remove(id);
    state = next;
    try {
      await ref.read(strategySubscriptionPersistenceProvider).write(next);
    } catch (_) {
      state = previous;
      rethrow;
    }
  }
}

final NotifierProvider<StrategySubscriptionsNotifier, Set<String>>
strategySubscriptionsProvider =
    NotifierProvider<StrategySubscriptionsNotifier, Set<String>>(
      StrategySubscriptionsNotifier.new,
    );

final Provider<StrategyFavoritesPersistence>
strategyFavoritesPersistenceProvider = Provider<StrategyFavoritesPersistence>((
  Ref ref,
) {
  return StrategyFavoritesPersistence(ref.watch(sharedPreferencesProvider));
});

/// 已收藏（星标）策略 id 集合（#1565）。
///
/// 与 [StrategySubscriptionsNotifier] 同 toggle/写盘/回滚模式：乐观更新内存，
/// 写盘失败回滚保证内存与磁盘一致。
class StrategyFavoritesNotifier extends Notifier<Set<String>> {
  @override
  Set<String> build() {
    return ref.watch(strategyFavoritesPersistenceProvider).read();
  }

  bool isFavorite(String id) => state.contains(id);

  Future<void> toggle(String id) async {
    final Set<String> previous = state;
    final Set<String> next = <String>{...previous};
    if (!next.add(id)) next.remove(id);
    state = next;
    try {
      await ref.read(strategyFavoritesPersistenceProvider).write(next);
    } catch (_) {
      state = previous;
      rethrow;
    }
  }
}

final NotifierProvider<StrategyFavoritesNotifier, Set<String>>
strategyFavoritesProvider =
    NotifierProvider<StrategyFavoritesNotifier, Set<String>>(
      StrategyFavoritesNotifier.new,
    );

final Provider<StrategySearchHistoryPersistence>
strategySearchHistoryPersistenceProvider =
    Provider<StrategySearchHistoryPersistence>((Ref ref) {
      return StrategySearchHistoryPersistence(
        ref.watch(sharedPreferencesProvider),
      );
    });

/// 策略广场搜索历史（最近在前，去重置顶，cap=[StrategySearchHistoryPersistence.kMax]）。
///
/// 与 [StrategyFavoritesNotifier] 同乐观写盘模式：内存先更新，写盘失败回滚。
class StrategySearchHistoryNotifier extends Notifier<List<String>> {
  @override
  List<String> build() {
    return ref.watch(strategySearchHistoryPersistenceProvider).read();
  }

  /// 记录一次搜索词：去重后置顶，截断到上限。空白串忽略。
  Future<void> push(String term) async {
    final String t = term.trim();
    if (t.isEmpty) return;
    final List<String> previous = state;
    final List<String> next = <String>[
      t,
      ...previous.where((String x) => x != t),
    ].take(StrategySearchHistoryPersistence.kMax).toList(growable: false);
    state = next;
    try {
      await ref.read(strategySearchHistoryPersistenceProvider).write(next);
    } catch (_) {
      state = previous;
      rethrow;
    }
  }

  Future<void> clear() async {
    final List<String> previous = state;
    if (previous.isEmpty) return;
    state = const <String>[];
    try {
      await ref
          .read(strategySearchHistoryPersistenceProvider)
          .write(const <String>[]);
    } catch (_) {
      state = previous;
      rethrow;
    }
  }
}

final NotifierProvider<StrategySearchHistoryNotifier, List<String>>
strategySearchHistoryProvider =
    NotifierProvider<StrategySearchHistoryNotifier, List<String>>(
      StrategySearchHistoryNotifier.new,
    );

final Provider<MarketFavoritesPersistence> marketFavoritesPersistenceProvider =
    Provider<MarketFavoritesPersistence>((Ref ref) {
      return MarketFavoritesPersistence(ref.watch(sharedPreferencesProvider));
    });

/// 已收藏（自选）行情 symbol 集合（#1755）。
///
/// 与 [StrategyFavoritesNotifier] 同 toggle/写盘/回滚模式：乐观更新内存，
/// 写盘失败回滚保证内存与磁盘一致。详情页与行情列表自选 tab 共享此 provider，
/// 使收藏状态在两个入口间保持一致。
class MarketFavoritesNotifier extends Notifier<Set<String>> {
  /// 首次启动（键从未写盘）时的默认自选集合，对齐行情列表自选 tab 的
  /// mock 种子。用户一旦增删即以持久化为准；显式清空后不再被种子填充。
  static const Set<String> kDefaultSymbols = <String>{
    'BTCUSDT',
    'ETHUSDT',
    'SOLUSDT',
    'BNBUSDT',
    'XRPUSDT',
  };

  @override
  Set<String> build() {
    // null = 键从未写盘 → 填种子；空集 = 用户已清空 → 保持空，不复活。
    final Set<String>? stored =
        ref.watch(marketFavoritesPersistenceProvider).read();
    return stored ?? <String>{...kDefaultSymbols};
  }

  bool isFavorite(String symbol) => state.contains(symbol);

  /// 写盘进行中标志：串行化 toggle，避免快速双击时回滚快照交错丢值。
  bool _writing = false;

  Future<void> toggle(String symbol) async {
    if (_writing) return;
    final Set<String> previous = state;
    final Set<String> next = <String>{...previous};
    if (!next.add(symbol)) next.remove(symbol);
    state = next;
    _writing = true;
    try {
      await ref.read(marketFavoritesPersistenceProvider).write(next);
    } catch (_) {
      state = previous;
      rethrow;
    } finally {
      _writing = false;
    }
  }
}

final NotifierProvider<MarketFavoritesNotifier, Set<String>>
marketFavoritesProvider =
    NotifierProvider<MarketFavoritesNotifier, Set<String>>(
      MarketFavoritesNotifier.new,
    );

/// 实盘策略有状态 store（#1773）。
///
/// 单一可变真源：初始 seed 自 repository，暂停/恢复/删除等操作在客户端就地
/// 转换状态（mock-first）。列表/摘要/详情/持仓 provider 均从此派生，保证一次
/// 操作后全端一致刷新。真实实例接口（#1682/#1683）接通后此 store 退役。
class LiveStrategyStore extends AsyncNotifier<List<LiveStrategy>> {
  @override
  Future<List<LiveStrategy>> build() async {
    return ref.watch(liveStrategyRepositoryProvider).listStrategies();
  }

  /// 暂停：running / warning -> paused，附「等待恢复」状态注。
  void pause(String id) {
    _mutate(
      id,
      (LiveStrategy s) => s.copyWith(
        status: LiveStrategyStatus.paused,
        statusNote: '已暂停 · 等待恢复',
      ),
    );
  }

  /// 恢复：任意非 running -> running，清状态注。
  void resume(String id) {
    _mutate(
      id,
      (LiveStrategy s) => s.copyWith(
        status: LiveStrategyStatus.running,
        statusNote: null,
      ),
    );
  }

  /// 软删：-> stopped，保留 30 天。
  void softDelete(String id) {
    _mutate(
      id,
      (LiveStrategy s) => s.copyWith(
        status: LiveStrategyStatus.stopped,
        statusNote: '已停止 · 28 天后永久删除',
      ),
    );
  }

  /// 永久删除：从列表移除。
  void permanentDelete(String id) {
    final List<LiveStrategy>? current = state.value;
    if (current == null) return;
    state = AsyncData<List<LiveStrategy>>(
      current.where((LiveStrategy s) => s.id != id).toList(growable: false),
    );
  }

  void _mutate(String id, LiveStrategy Function(LiveStrategy) transform) {
    final List<LiveStrategy>? current = state.value;
    if (current == null) return;
    state = AsyncData<List<LiveStrategy>>(
      current
          .map((LiveStrategy s) => s.id == id ? transform(s) : s)
          .toList(growable: false),
    );
  }
}

/// 实盘策略 store provider（#1773）。
final AsyncNotifierProvider<LiveStrategyStore, List<LiveStrategy>>
liveStrategyStoreProvider =
    AsyncNotifierProvider<LiveStrategyStore, List<LiveStrategy>>(
      LiveStrategyStore.new,
    );

/// 实盘策略列表（#1752）。列表页 watch；含 stopped。派生自 store。
final FutureProvider<List<LiveStrategy>> liveStrategiesProvider =
    FutureProvider<List<LiveStrategy>>((Ref ref) async {
      return ref.watch(liveStrategyStoreProvider.future);
    });

/// 实盘策略聚合摘要（#1752）。列表页顶部卡 watch。从 store 当前列表重算
/// （排除 stopped），口径与设计稿 `active` 统计一致。
final FutureProvider<LiveStrategySummary> liveStrategySummaryProvider =
    FutureProvider<LiveStrategySummary>((Ref ref) async {
      final List<LiveStrategy> all =
          await ref.watch(liveStrategyStoreProvider.future);
      final List<LiveStrategy> active =
          all.where((LiveStrategy s) => s.isActive).toList();
      double cap = 0;
      double today = 0;
      double total = 0;
      int running = 0;
      int warning = 0;
      int paused = 0;
      double winRateWeighted = 0;
      int tradesTotal = 0;
      for (final LiveStrategy s in active) {
        cap += s.capital;
        today += s.todayPnl;
        total += s.totalPnl;
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
      final int stopped = all
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
      );
    });

/// 单个实盘策略详情（#1752）。派生自 store；未命中抛错（详情页落 error 态）。
final FutureProviderFamily<LiveStrategy, String> liveStrategyDetailProvider =
    FutureProvider.family<LiveStrategy, String>((Ref ref, String id) async {
      final List<LiveStrategy> all =
          await ref.watch(liveStrategyStoreProvider.future);
      return all.firstWhere((LiveStrategy s) => s.id == id);
    });

/// 单个实盘策略持仓（#1752）。null 表示无持仓（已暂停/停止）。
/// 从 store 取最新 status 判断 mayHavePosition，确保暂停后持仓即时消失。
final FutureProviderFamily<LiveStrategyPosition?, String>
liveStrategyPositionProvider =
    FutureProvider.family<LiveStrategyPosition?, String>((
      Ref ref,
      String id,
    ) async {
      final List<LiveStrategy> all =
          await ref.watch(liveStrategyStoreProvider.future);
      final LiveStrategy s = all.firstWhere((LiveStrategy x) => x.id == id);
      if (!s.mayHavePosition) return null;
      return mockLivePositions[id];
    });

/// 单个实盘策略历史成交（#1752）。
final FutureProviderFamily<List<LiveStrategyTrade>, String>
liveStrategyTradesProvider =
    FutureProvider.family<List<LiveStrategyTrade>, String>((
      Ref ref,
      String id,
    ) async {
      return ref.watch(liveStrategyRepositoryProvider).listTrades(id);
    });

/// 单个实盘策略参数（#1752）。
final FutureProviderFamily<List<LiveStrategyParam>, String>
liveStrategyParamsProvider =
    FutureProvider.family<List<LiveStrategyParam>, String>((
      Ref ref,
      String id,
    ) async {
      return ref.watch(liveStrategyRepositoryProvider).listParams(id);
    });
