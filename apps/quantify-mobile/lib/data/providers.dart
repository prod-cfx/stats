import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dart:math';

import 'models/account_models.dart';
import 'models/api_key_models.dart';
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

/// 交易所凭据列表。从 `/me` 摘要与 `/me/api` 列表同时 watch；新增/删除后
/// 调用方应 `ref.invalidate(apiKeysProvider)` 让两处同步刷新。
final FutureProvider<List<ExchangeApiKey>> apiKeysProvider =
    FutureProvider<List<ExchangeApiKey>>((Ref ref) async {
  return ref.watch(apiKeyRepositoryProvider).listKeys();
});

/// `/me/api` 表单的「测试连接」回调签名。
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
