import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'mock/mock_auth_repository.dart';
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

// AuthRepository：PR1 即提供完整 Mock 闭环作为模式示例。
final Provider<AuthRepository> authRepositoryProvider =
    Provider<AuthRepository>((Ref ref) {
  return ref.watch(useMockProvider)
      ? MockAuthRepository()
      : UnimplementedAuthRepository();
});

// 以下 10 个 Repository：PR1 仅落 Unimplemented stub，不读 useMockProvider。
// PR2 会引入 MockXxxRepository 并在此处加入 `ref.watch(useMockProvider) ? Mock : Unimplemented`。
// 由于 pages 当前未调用任何 Repository 方法，PR1 合并不会触发 UnimplementedError。

final Provider<TickerRepository> tickerRepositoryProvider =
    Provider<TickerRepository>((Ref ref) => UnimplementedTickerRepository());

final Provider<KlineRepository> klineRepositoryProvider =
    Provider<KlineRepository>((Ref ref) => UnimplementedKlineRepository());

final Provider<OrderbookRepository> orderbookRepositoryProvider =
    Provider<OrderbookRepository>(
        (Ref ref) => UnimplementedOrderbookRepository());

final Provider<LongShortRepository> longShortRepositoryProvider =
    Provider<LongShortRepository>(
        (Ref ref) => UnimplementedLongShortRepository());

final Provider<WhaleFeedRepository> whaleFeedRepositoryProvider =
    Provider<WhaleFeedRepository>(
        (Ref ref) => UnimplementedWhaleFeedRepository());

final Provider<StrategyRepository> strategyRepositoryProvider =
    Provider<StrategyRepository>(
        (Ref ref) => UnimplementedStrategyRepository());

final Provider<AiChatRepository> aiChatRepositoryProvider =
    Provider<AiChatRepository>((Ref ref) => UnimplementedAiChatRepository());

final Provider<BacktestRepository> backtestRepositoryProvider =
    Provider<BacktestRepository>(
        (Ref ref) => UnimplementedBacktestRepository());

final Provider<AccountRepository> accountRepositoryProvider =
    Provider<AccountRepository>((Ref ref) => UnimplementedAccountRepository());

final Provider<ApiKeyRepository> apiKeyRepositoryProvider =
    Provider<ApiKeyRepository>((Ref ref) => UnimplementedApiKeyRepository());
