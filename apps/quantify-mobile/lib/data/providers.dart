import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../theme/theme_notifier.dart' show sharedPreferencesProvider;
import 'models/account_models.dart';
import 'models/api_key_models.dart';
import 'models/live_strategy_models.dart';
import 'storage/market_favorites_persistence.dart';
import 'storage/strategy_favorites_persistence.dart';
import 'storage/strategy_subscription_persistence.dart';
import 'mock/mock_account_repository.dart';
import 'mock/mock_ai_chat_repository.dart';
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
import 'mock/mock_whale_profile_repository.dart';
import 'mock/mock_whale_watch_repository.dart';
import 'mock/unimplemented_repositories.dart';
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

final Provider<AuthRepository> authRepositoryProvider =
    Provider<AuthRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockAuthRepository()
          : UnimplementedAuthRepository();
    });

final Provider<TickerRepository> tickerRepositoryProvider =
    Provider<TickerRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockTickerRepository()
          : UnimplementedTickerRepository();
    });

final Provider<KlineRepository> klineRepositoryProvider =
    Provider<KlineRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockKlineRepository()
          : UnimplementedKlineRepository();
    });

final Provider<OrderbookRepository> orderbookRepositoryProvider =
    Provider<OrderbookRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockOrderbookRepository()
          : UnimplementedOrderbookRepository();
    });

final Provider<LongShortRepository> longShortRepositoryProvider =
    Provider<LongShortRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockLongShortRepository()
          : UnimplementedLongShortRepository();
    });

final Provider<WhaleFeedRepository> whaleFeedRepositoryProvider =
    Provider<WhaleFeedRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockWhaleFeedRepository()
          : UnimplementedWhaleFeedRepository();
    });

final Provider<WhaleProfileRepository> whaleProfileRepositoryProvider =
    Provider<WhaleProfileRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockWhaleProfileRepository()
          : UnimplementedWhaleProfileRepository();
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

/// 巨鲸搜索与地址监控（#1754）。mock 驱动；真实读写依赖 #1682/#1683。
final Provider<WhaleWatchRepository> whaleWatchRepositoryProvider =
    Provider<WhaleWatchRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? const MockWhaleWatchRepository()
          : UnimplementedWhaleWatchRepository();
    });

final Provider<StrategyRepository> strategyRepositoryProvider =
    Provider<StrategyRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockStrategyRepository()
          : UnimplementedStrategyRepository();
    });

final Provider<LiveStrategyRepository> liveStrategyRepositoryProvider =
    Provider<LiveStrategyRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockLiveStrategyRepository()
          : UnimplementedLiveStrategyRepository();
    });

final Provider<AiChatRepository> aiChatRepositoryProvider =
    Provider<AiChatRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockAiChatRepository()
          : UnimplementedAiChatRepository();
    });

final Provider<BacktestRepository> backtestRepositoryProvider =
    Provider<BacktestRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockBacktestRepository()
          : UnimplementedBacktestRepository();
    });

final Provider<AccountRepository> accountRepositoryProvider =
    Provider<AccountRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockAccountRepository()
          : UnimplementedAccountRepository();
    });

final Provider<ApiKeyRepository> apiKeyRepositoryProvider =
    Provider<ApiKeyRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? MockApiKeyRepository()
          : UnimplementedApiKeyRepository();
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

/// 实盘策略列表（#1752）。列表页 watch；含 stopped。
final FutureProvider<List<LiveStrategy>> liveStrategiesProvider =
    FutureProvider<List<LiveStrategy>>((Ref ref) async {
      return ref.watch(liveStrategyRepositoryProvider).listStrategies();
    });

/// 实盘策略聚合摘要（#1752）。列表页顶部卡 watch。
final FutureProvider<LiveStrategySummary> liveStrategySummaryProvider =
    FutureProvider<LiveStrategySummary>((Ref ref) async {
      return ref.watch(liveStrategyRepositoryProvider).getSummary();
    });

/// 单个实盘策略详情（#1752）。
final FutureProviderFamily<LiveStrategy, String> liveStrategyDetailProvider =
    FutureProvider.family<LiveStrategy, String>((Ref ref, String id) async {
      return ref.watch(liveStrategyRepositoryProvider).getStrategy(id);
    });

/// 单个实盘策略持仓（#1752）。null 表示无持仓（已暂停/停止）。
final FutureProviderFamily<LiveStrategyPosition?, String>
liveStrategyPositionProvider =
    FutureProvider.family<LiveStrategyPosition?, String>((
      Ref ref,
      String id,
    ) async {
      return ref.watch(liveStrategyRepositoryProvider).getPosition(id);
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
