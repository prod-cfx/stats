import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/services.dart';

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
