import 'package:flutter_riverpod/flutter_riverpod.dart';

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
