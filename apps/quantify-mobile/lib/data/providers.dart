import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dart:math';

import '../theme/theme_notifier.dart' show sharedPreferencesProvider;
import 'models/account_models.dart';
import 'models/api_key_models.dart';
import 'storage/strategy_favorites_persistence.dart';
import 'storage/strategy_subscription_persistence.dart';
import 'mock/mock_account_repository.dart';
import 'mock/mock_ai_chat_repository.dart';
import 'mock/mock_api_key_repository.dart';
import 'mock/mock_auth_repository.dart';
import 'mock/mock_backtest_repository.dart';
import 'mock/mock_kline_repository.dart';
import 'mock/mock_long_short_repository.dart';
import 'mock/mock_orderbook_repository.dart';
import 'mock/mock_strategy_repository.dart';
import 'mock/mock_ticker_repository.dart';
import 'mock/mock_whale_feed_repository.dart';
import 'mock/unimplemented_repositories.dart';
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

final Provider<StrategyRepository> strategyRepositoryProvider =
    Provider<StrategyRepository>((Ref ref) {
  return ref.watch(useMockProvider)
      ? MockStrategyRepository()
      : UnimplementedStrategyRepository();
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

/// API 配置表单的「测试连接」回调签名。
typedef ApiConnectionTester = Future<bool> Function();

/// 默认实现：1s loading 后随机成功/失败。
///
/// Random 在 provider 创建时实例化，复用同一个种子；widget test 可通过
/// `apiConnectionTesterProvider.overrideWithValue(() async => true)` 注入
/// 固定结果以避免 fake clock 与 Future.delayed 的同步问题。
final Provider<ApiConnectionTester> apiConnectionTesterProvider =
    Provider<ApiConnectionTester>((Ref ref) {
  final Random r = Random();
  return () async {
    await Future<void>.delayed(const Duration(seconds: 1));
    return r.nextBool();
  };
});

final Provider<StrategySubscriptionPersistence>
    strategySubscriptionPersistenceProvider =
    Provider<StrategySubscriptionPersistence>((Ref ref) {
  return StrategySubscriptionPersistence(ref.watch(sharedPreferencesProvider));
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
        StrategySubscriptionsNotifier.new);

final Provider<StrategyFavoritesPersistence>
    strategyFavoritesPersistenceProvider =
    Provider<StrategyFavoritesPersistence>((Ref ref) {
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
        StrategyFavoritesNotifier.new);
