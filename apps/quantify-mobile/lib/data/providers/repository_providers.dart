import 'package:flutter_riverpod/flutter_riverpod.dart';
// `FutureProviderFamily` 在 Riverpod 3.x 未由 flutter_riverpod 公开导出，
// family provider 的显式类型注解需直连 misc。
import 'package:riverpod/misc.dart' show FutureProviderFamily;

import '../models/account_models.dart';
import '../models/agg_market_data.dart';
import '../models/api_key_models.dart';
import '../models/backtest_models.dart';
import '../models/coin_stock_models.dart';
import '../models/pred_market_models.dart';
import '../models/ticker_models.dart';
import '../models/trade_models.dart';
import '../models/whale_extra_models.dart';
import '../models/whale_profile_models.dart';
import '../../domain/models/whale_holding_models.dart';
import '../../domain/models/whale_leader_models.dart';
import '../mock/mock_account_repository.dart';
import '../mock/mock_agg_orderbook_repository.dart';
import '../mock/mock_ai_chat_repository.dart';
import '../mock/mock_coin_stock_repository.dart';
import '../mock/mock_pred_market_repository.dart';
import '../mock/mock_trades_repository.dart';
import '../mock/mock_whale_extras_repository.dart';
import '../mock/mock_api_key_repository.dart';
import '../mock/mock_auth_repository.dart';
import '../mock/mock_backtest_repository.dart';
import '../mock/mock_kline_repository.dart';
import '../mock/mock_live_strategy_repository.dart';
import '../mock/mock_long_short_repository.dart';
import '../mock/mock_orderbook_repository.dart';
import '../mock/mock_strategy_repository.dart';
import '../mock/mock_ticker_repository.dart';
import '../mock/mock_whale_feed_repository.dart';
import '../mock/mock_whale_holdings_repository.dart';
import '../mock/mock_whale_leaderboard_repository.dart';
import '../mock/mock_whale_profile_repository.dart';
import '../mock/mock_whale_watch_repository.dart';
import '../api/api.dart';
import '../repositories/repositories.dart';
import 'env_providers.dart';
import 'service_providers.dart';

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
          : ApiTickerRepository(ref.watch(generatedBackendApiProvider));
    });

// ── market 域数据 Provider（issue #2216）──────────────────────────────────
// pages/market 不再直接 import data/mock/fixtures，统一经下列 Provider 取数。
// 后端就绪（#2189）后只需在各 repository provider 加 Api 分支，UI 不动。

/// 行情列表（#2216）。多空比页 watch 取 symbol 列表。复用 [tickerRepositoryProvider]。
final FutureProvider<List<Ticker>> tickersProvider =
    FutureProvider<List<Ticker>>((Ref ref) async {
      return ref.watch(tickerRepositoryProvider).listTickers();
    });

/// 币股 Repository（#2216）。`USE_MOCK=false` 走真实契约（#2270，依赖 #2268）。
final Provider<CoinStockRepository> coinStockRepositoryProvider =
    Provider<CoinStockRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? const MockCoinStockRepository()
          : ApiCoinStockRepository(ref.watch(generatedBackendApiProvider));
    });

/// 币股列表（#2216）。币股 hub 子屏 watch。
final FutureProvider<List<CoinStock>> coinStocksProvider =
    FutureProvider<List<CoinStock>>((Ref ref) async {
      return ref.watch(coinStockRepositoryProvider).listCoinStocks();
    });

/// 预测市场 Repository（#2216）。`USE_MOCK=false` 走真实契约（#2270）。
final Provider<PredMarketRepository> predMarketRepositoryProvider =
    Provider<PredMarketRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? const MockPredMarketRepository()
          : ApiPredMarketRepository(ref.watch(generatedBackendApiProvider));
    });

/// 预测市场列表（#2216）。预测市场 hub 子屏 watch。
final FutureProvider<List<PredMarket>> predMarketsProvider =
    FutureProvider<List<PredMarket>>((Ref ref) async {
      return ref.watch(predMarketRepositoryProvider).listPredMarkets();
    });

/// 巨鲸「数据」hub 附加数据 Repository（#2216）。`USE_MOCK=false` 走真实
/// 通知收件箱契约（#2270）。
final Provider<WhaleExtrasRepository> whaleExtrasRepositoryProvider =
    Provider<WhaleExtrasRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? const MockWhaleExtrasRepository()
          : ApiWhaleExtrasRepository(ref.watch(generatedBackendApiProvider));
    });

/// data hub 通知列表（#2216）。data hub 控制器初始 seed。
final FutureProvider<List<WhaleNotification>> whaleExtrasProvider =
    FutureProvider<List<WhaleNotification>>((Ref ref) async {
      return ref.watch(whaleExtrasRepositoryProvider).listNotifications();
    });

/// 成交记录 Repository（#2216）。`USE_MOCK=false` 走真实契约（#2270）。
final Provider<TradesRepository> tradesRepositoryProvider =
    Provider<TradesRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? const MockTradesRepository()
          : ApiTradesRepository(ref.watch(generatedBackendApiProvider));
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

/// 聚合市场数据 Repository（#2216）。`USE_MOCK=false` 时盘口接真实契约
/// （#2270）；OI/volume 暂复用 mock 常量（待后端 #2269）。
final Provider<AggOrderbookRepository> aggOrderbookRepositoryProvider =
    Provider<AggOrderbookRepository>((Ref ref) {
      return ref.watch(useMockProvider)
          ? const MockAggOrderbookRepository()
          : ApiAggOrderbookRepository(ref.watch(generatedBackendApiProvider));
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
