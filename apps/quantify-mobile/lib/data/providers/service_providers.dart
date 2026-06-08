import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/session_controller.dart';
import '../services/generated_backend_api.dart';
import '../services/services.dart';

/// 后端 baseUrl（真实 API 模式使用）。
///
/// 通过 `flutter run --dart-define=API_BASE_URL=https://...` 注入；缺省占位
/// 指向本地 quantify 服务端口。契约就绪后按环境配置校正。
const String _kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://cfx-backend-staging.devbase.cloud/api/v1',
);

/// 统一后端 HTTP 客户端（issue #2189 / #2260）。所有 Service 共享一个
/// [ApiClient] 实例。
///
/// 注入 `tokenSupplier`：每次请求经 `ref.read` 读最新 [SessionController] 会话
/// token，登录态变化无需重建网络栈（用 `ref.read` 而非 `ref.watch` 避免 token
/// 刷新触发整栈重建）。supplier 闭包在请求期才求值，故 `apiClientProvider` 与
/// `sessionControllerProvider`（其 build 仅读 storage）无构建期循环。
final Provider<ApiClient> apiClientProvider = Provider<ApiClient>((Ref ref) {
  return ApiClient(
    baseUrl: _kApiBaseUrl,
    tokenSupplier: () => ref.read(sessionControllerProvider).value?.token ?? '',
  );
});

/// generated backend SDK provider。复用 [apiClientProvider] 的底层 [Dio]
/// （`.raw`），确保 generated SDK 与手写 [ApiClient] 共享 baseUrl、Bearer token
/// 与 [ApiException] 归一行为。
final Provider<GeneratedBackendApi> generatedBackendApiProvider =
    Provider<GeneratedBackendApi>((Ref ref) {
      return GeneratedBackendApi(dio: ref.watch(apiClientProvider).raw);
    });

// ── 各域 Service（stateless，注入共享 ApiClient）─────────────────────────
final Provider<AuthService> authServiceProvider = Provider<AuthService>(
  (Ref ref) => AuthService(ref.watch(apiClientProvider)),
);
final Provider<TickerService> tickerServiceProvider = Provider<TickerService>(
  (Ref ref) => TickerService(ref.watch(apiClientProvider)),
);
final Provider<KlineService> klineServiceProvider = Provider<KlineService>(
  (Ref ref) => KlineService(ref.watch(apiClientProvider)),
);
final Provider<OrderbookService> orderbookServiceProvider =
    Provider<OrderbookService>(
      (Ref ref) => OrderbookService(ref.watch(apiClientProvider)),
    );
final Provider<LongShortService> longShortServiceProvider =
    Provider<LongShortService>(
      (Ref ref) => LongShortService(ref.watch(apiClientProvider)),
    );
final Provider<WhaleFeedService> whaleFeedServiceProvider =
    Provider<WhaleFeedService>(
      (Ref ref) => WhaleFeedService(ref.watch(apiClientProvider)),
    );
final Provider<WhaleHoldingsService> whaleHoldingsServiceProvider =
    Provider<WhaleHoldingsService>(
      (Ref ref) => WhaleHoldingsService(ref.watch(apiClientProvider)),
    );
final Provider<WhaleProfileService> whaleProfileServiceProvider =
    Provider<WhaleProfileService>(
      (Ref ref) => WhaleProfileService(ref.watch(apiClientProvider)),
    );
final Provider<WhaleWatchService> whaleWatchServiceProvider =
    Provider<WhaleWatchService>(
      (Ref ref) => WhaleWatchService(ref.watch(apiClientProvider)),
    );
final Provider<StrategyService> strategyServiceProvider =
    Provider<StrategyService>(
      (Ref ref) => StrategyService(ref.watch(apiClientProvider)),
    );
final Provider<LiveStrategyService> liveStrategyServiceProvider =
    Provider<LiveStrategyService>(
      (Ref ref) => LiveStrategyService(ref.watch(apiClientProvider)),
    );
final Provider<AiChatService> aiChatServiceProvider = Provider<AiChatService>(
  (Ref ref) => AiChatService(ref.watch(apiClientProvider)),
);
final Provider<BacktestService> backtestServiceProvider =
    Provider<BacktestService>(
      (Ref ref) => BacktestService(ref.watch(apiClientProvider)),
    );
final Provider<AccountService> accountServiceProvider =
    Provider<AccountService>(
      (Ref ref) => AccountService(ref.watch(apiClientProvider)),
    );
final Provider<ApiKeyService> apiKeyServiceProvider = Provider<ApiKeyService>(
  (Ref ref) => ApiKeyService(ref.watch(apiClientProvider)),
);
