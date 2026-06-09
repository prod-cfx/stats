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
import '../api/api.dart';
import '../repositories/repositories.dart';
import 'service_providers.dart';

final Provider<AuthRepository> authRepositoryProvider =
    Provider<AuthRepository>((Ref ref) {
      return ApiAuthRepository(ref.watch(authServiceProvider));
    });

final Provider<TickerRepository> tickerRepositoryProvider =
    Provider<TickerRepository>((Ref ref) {
      return ApiTickerRepository(ref.watch(generatedBackendApiProvider));
    });

// ── market 域数据 Provider（issue #2216）──────────────────────────────────
// pages/market 不再直接 import test fixtures，统一经下列 Provider 取数。
// 后端就绪（#2189）后只需在各 repository provider 加 Api 分支，UI 不动。

/// 行情列表（#2216）。多空比页 watch 取 symbol 列表。复用 [tickerRepositoryProvider]。
final FutureProvider<List<Ticker>> tickersProvider =
    FutureProvider<List<Ticker>>((Ref ref) async {
      return ref.watch(tickerRepositoryProvider).listTickers();
    });

/// 币股 Repository（#2216）。走真实契约（#2270，依赖 #2268）。
final Provider<CoinStockRepository> coinStockRepositoryProvider =
    Provider<CoinStockRepository>((Ref ref) {
      return ApiCoinStockRepository(ref.watch(generatedBackendApiProvider));
    });

/// 币股列表（#2216）。币股 hub 子屏 watch。
final FutureProvider<List<CoinStock>> coinStocksProvider =
    FutureProvider<List<CoinStock>>((Ref ref) async {
      return ref.watch(coinStockRepositoryProvider).listCoinStocks();
    });

/// 预测市场 Repository（#2216）。走真实契约（#2270）。
final Provider<PredMarketRepository> predMarketRepositoryProvider =
    Provider<PredMarketRepository>((Ref ref) {
      return ApiPredMarketRepository(ref.watch(generatedBackendApiProvider));
    });

/// 预测市场列表（#2216）。预测市场 hub 子屏 watch。
final FutureProvider<List<PredMarket>> predMarketsProvider =
    FutureProvider<List<PredMarket>>((Ref ref) async {
      return ref.watch(predMarketRepositoryProvider).listPredMarkets();
    });

/// 预测市场列表（按 locale 请求后端本地化文案）。
final FutureProviderFamily<List<PredMarket>, String>
predMarketsByLocaleProvider = FutureProvider.family<List<PredMarket>, String>((
  Ref ref,
  String locale,
) async {
  return ref
      .watch(predMarketRepositoryProvider)
      .listPredMarkets(locale: locale);
});

/// 巨鲸「数据」hub 附加数据 Repository（#2216）。走真实通知收件箱契约（#2270）。
final Provider<WhaleExtrasRepository> whaleExtrasRepositoryProvider =
    Provider<WhaleExtrasRepository>((Ref ref) {
      return ApiWhaleExtrasRepository(ref.watch(generatedBackendApiProvider));
    });

/// data hub 通知列表（#2216）。data hub 控制器初始 seed。
final FutureProvider<List<WhaleNotification>> whaleExtrasProvider =
    FutureProvider<List<WhaleNotification>>((Ref ref) async {
      return ref.watch(whaleExtrasRepositoryProvider).listNotifications();
    });

/// 成交记录 Repository（#2216）。走真实契约（#2270）。
final Provider<TradesRepository> tradesRepositoryProvider =
    Provider<TradesRepository>((Ref ref) {
      return ApiTradesRepository(ref.watch(generatedBackendApiProvider));
    });

/// 成交记录列表（#2216），family by `(symbol, mid)`。成交面板 watch；
/// `mid` 锚价由调用方（详情页快照价）注入，fixture 据此生成滚动成交。
final FutureProviderFamily<List<Trade>, (String, double)> tradesProvider =
    FutureProvider.family<List<Trade>, (String, double)>((
      Ref ref,
      (String, double) args,
    ) async {
      return ref
          .watch(tradesRepositoryProvider)
          .listTrades(symbol: args.$1, mid: args.$2);
    });

/// 聚合市场数据 Repository（#2216）。聚合挂单 / 持仓量 / 成交量均走真实契约，
/// 不回退 test fixture。
final Provider<AggOrderbookRepository> aggOrderbookRepositoryProvider =
    Provider<AggOrderbookRepository>((Ref ref) {
      return ApiAggOrderbookRepository(ref.watch(generatedBackendApiProvider));
    });

/// 聚合市场数据 bundle（#2216）。4 个 `agg_*` widget 统一 watch 此单一共享
/// Provider 取原始 levels 与各表真实快照；派生留 widget（C4 #2218 收口上移）。
final FutureProvider<AggMarketData> aggOrderbookProvider =
    FutureProvider<AggMarketData>((Ref ref) async {
      return ref.watch(aggOrderbookRepositoryProvider).getMarketData();
    });

final Provider<KlineRepository> klineRepositoryProvider =
    Provider<KlineRepository>((Ref ref) {
      return ApiKlineRepository(ref.watch(klineServiceProvider));
    });

final Provider<OrderbookRepository> orderbookRepositoryProvider =
    Provider<OrderbookRepository>((Ref ref) {
      return ApiOrderbookRepository(ref.watch(generatedBackendApiProvider));
    });

final Provider<LongShortRepository> longShortRepositoryProvider =
    Provider<LongShortRepository>((Ref ref) {
      return ApiLongShortRepository(ref.watch(generatedBackendApiProvider));
    });

final Provider<WhaleFeedRepository> whaleFeedRepositoryProvider =
    Provider<WhaleFeedRepository>((Ref ref) {
      return ApiWhaleFeedRepository(ref.watch(generatedBackendApiProvider));
    });

final Provider<WhaleProfileRepository> whaleProfileRepositoryProvider =
    Provider<WhaleProfileRepository>((Ref ref) {
      return ApiWhaleProfileRepository(ref.watch(whaleProfileServiceProvider));
    });

/// 单个巨鲸地址画像（#1753）。地址详情页 watch；未命中已知地址由 fixture
/// 派生 fallback，真实读路径依赖 #1682。
final FutureProviderFamily<WhaleProfile, String> whaleProfileProvider =
    FutureProvider.family<WhaleProfile, String>((
      Ref ref,
      String address,
    ) async {
      return ref.watch(whaleProfileRepositoryProvider).getProfile(address);
    });

/// 巨鲸「发现」tab 排行榜 repository（#1789）。API 驱动；真实读路径依赖 #1682。
final Provider<WhaleLeaderboardRepository> whaleLeaderboardRepositoryProvider =
    Provider<WhaleLeaderboardRepository>((Ref ref) {
      return ApiWhaleLeaderboardRepository(
        ref.watch(generatedBackendApiProvider),
      );
    });

/// 巨鲸排行榜列表（#1789）。发现 tab watch；排序在 tab 本地态完成。
final FutureProvider<List<WhaleLeaderEntry>> whaleLeaderboardProvider =
    FutureProvider<List<WhaleLeaderEntry>>((Ref ref) async {
      return ref.watch(whaleLeaderboardRepositoryProvider).getLeaderboard();
    });

/// 巨鲸「持仓」tab 持仓明细 repository（#1790）。API 驱动；真实读路径依赖 #1682。
final Provider<WhaleHoldingsRepository> whaleHoldingsRepositoryProvider =
    Provider<WhaleHoldingsRepository>((Ref ref) {
      return ApiWhaleHoldingsRepository(
        ref.watch(whaleHoldingsServiceProvider),
      );
    });

/// 巨鲸持仓明细列表（#1790）。持仓 tab watch；筛选与排序在 tab 本地态完成。
final FutureProvider<List<WhaleHoldingPosition>> whaleHoldingsProvider =
    FutureProvider<List<WhaleHoldingPosition>>((Ref ref) async {
      return ref.watch(whaleHoldingsRepositoryProvider).getHoldings();
    });

/// 巨鲸搜索与地址监控（#1754）。API 驱动；真实读写依赖 #1682/#1683。
final Provider<WhaleWatchRepository> whaleWatchRepositoryProvider =
    Provider<WhaleWatchRepository>((Ref ref) {
      return ApiWhaleWatchRepository(ref.watch(generatedBackendApiProvider));
    });

final Provider<StrategyRepository> strategyRepositoryProvider =
    Provider<StrategyRepository>((Ref ref) {
      return ApiStrategyRepository(ref.watch(strategyServiceProvider));
    });

final Provider<LiveStrategyRepository> liveStrategyRepositoryProvider =
    Provider<LiveStrategyRepository>((Ref ref) {
      return ApiLiveStrategyRepository(ref.watch(liveStrategyServiceProvider));
    });

final Provider<AiChatRepository> aiChatRepositoryProvider =
    Provider<AiChatRepository>((Ref ref) {
      return ApiAiChatRepository(ref.watch(aiChatServiceProvider));
    });

final Provider<BacktestRepository> backtestRepositoryProvider =
    Provider<BacktestRepository>((Ref ref) {
      return ApiBacktestRepository(ref.watch(backtestServiceProvider));
    });

/// 回测结果（#2215/#2310）。结果页按真实回测 job id 拉取结果；测试替身环境
/// 也走同一 `getResult(jobId)` 合约，View 不再硬编码固定 id。
final FutureProviderFamily<BacktestResult, String> backtestResultProvider =
    FutureProvider.family<BacktestResult, String>((
      Ref ref,
      String jobId,
    ) async {
      return ref.watch(backtestRepositoryProvider).getResult(jobId);
    });

final Provider<AccountRepository> accountRepositoryProvider =
    Provider<AccountRepository>((Ref ref) {
      return ApiAccountRepository(ref.watch(generatedBackendApiProvider));
    });

final Provider<ApiKeyRepository> apiKeyRepositoryProvider =
    Provider<ApiKeyRepository>((Ref ref) {
      return ApiApiKeyRepository(ref.watch(apiKeyServiceProvider));
    });

/// 交易下单 Repository（#2307 PR1）。fixture 保留当前 sheet 的原型体验；真实模式
/// 从账户仓库读取余额，并通过后端下单接口决定提交成功/失败。
final Provider<TradingOrderRepository> tradingOrderRepositoryProvider =
    Provider<TradingOrderRepository>((Ref ref) {
      return ApiTradingOrderRepository(
        apiClient: ref.watch(apiClientProvider),
        accountRepository: ref.watch(accountRepositoryProvider),
      );
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
