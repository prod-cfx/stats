import 'package:riverpod/misc.dart' show Override;
import 'package:quantify_mobile/data/providers.dart';

import '../fixtures/mock/mock_account_repository.dart';
import '../fixtures/mock/mock_agg_orderbook_repository.dart';
import '../fixtures/mock/mock_ai_chat_repository.dart';
import '../fixtures/mock/mock_api_key_repository.dart';
import '../fixtures/mock/mock_auth_repository.dart';
import '../fixtures/mock/mock_backtest_repository.dart';
import '../fixtures/mock/mock_coin_stock_repository.dart';
import '../fixtures/mock/mock_kline_repository.dart';
import '../fixtures/mock/mock_live_strategy_repository.dart';
import '../fixtures/mock/mock_long_short_repository.dart';
import '../fixtures/mock/mock_orderbook_repository.dart';
import '../fixtures/mock/mock_pred_market_repository.dart';
import '../fixtures/mock/mock_strategy_repository.dart';
import '../fixtures/mock/mock_ticker_repository.dart';
import '../fixtures/mock/mock_trades_repository.dart';
import '../fixtures/mock/mock_trading_order_repository.dart';
import '../fixtures/mock/mock_whale_extras_repository.dart';
import '../fixtures/mock/mock_whale_feed_repository.dart';
import '../fixtures/mock/mock_whale_holdings_repository.dart';
import '../fixtures/mock/mock_whale_leaderboard_repository.dart';
import '../fixtures/mock/mock_whale_profile_repository.dart';
import '../fixtures/mock/mock_whale_watch_repository.dart';

List<Override> get testRepositoryOverrides => <Override>[
  authRepositoryProvider.overrideWithValue(MockAuthRepository()),
  tickerRepositoryProvider.overrideWithValue(MockTickerRepository()),
  coinStockRepositoryProvider.overrideWithValue(
    const MockCoinStockRepository(),
  ),
  predMarketRepositoryProvider.overrideWithValue(
    const MockPredMarketRepository(),
  ),
  whaleExtrasRepositoryProvider.overrideWithValue(
    const MockWhaleExtrasRepository(),
  ),
  tradesRepositoryProvider.overrideWithValue(const MockTradesRepository()),
  aggOrderbookRepositoryProvider.overrideWithValue(
    const MockAggOrderbookRepository(),
  ),
  klineRepositoryProvider.overrideWithValue(MockKlineRepository()),
  orderbookRepositoryProvider.overrideWithValue(MockOrderbookRepository()),
  longShortRepositoryProvider.overrideWithValue(MockLongShortRepository()),
  whaleFeedRepositoryProvider.overrideWithValue(MockWhaleFeedRepository()),
  whaleProfileRepositoryProvider.overrideWithValue(
    MockWhaleProfileRepository(),
  ),
  whaleLeaderboardRepositoryProvider.overrideWithValue(
    MockWhaleLeaderboardRepository(),
  ),
  whaleHoldingsRepositoryProvider.overrideWithValue(
    MockWhaleHoldingsRepository(),
  ),
  whaleWatchRepositoryProvider.overrideWithValue(
    const MockWhaleWatchRepository(),
  ),
  strategyRepositoryProvider.overrideWithValue(MockStrategyRepository()),
  liveStrategyRepositoryProvider.overrideWithValue(
    MockLiveStrategyRepository(),
  ),
  aiChatRepositoryProvider.overrideWithValue(MockAiChatRepository()),
  backtestRepositoryProvider.overrideWithValue(MockBacktestRepository()),
  accountRepositoryProvider.overrideWithValue(MockAccountRepository()),
  apiKeyRepositoryProvider.overrideWithValue(MockApiKeyRepository()),
  tradingOrderRepositoryProvider.overrideWithValue(
    const MockTradingOrderRepository(),
  ),
];

List<Override> get testRepositoryOverridesWithoutAggOrderbook => <Override>[
  authRepositoryProvider.overrideWithValue(MockAuthRepository()),
  tickerRepositoryProvider.overrideWithValue(MockTickerRepository()),
  coinStockRepositoryProvider.overrideWithValue(
    const MockCoinStockRepository(),
  ),
  predMarketRepositoryProvider.overrideWithValue(
    const MockPredMarketRepository(),
  ),
  whaleExtrasRepositoryProvider.overrideWithValue(
    const MockWhaleExtrasRepository(),
  ),
  tradesRepositoryProvider.overrideWithValue(const MockTradesRepository()),
  klineRepositoryProvider.overrideWithValue(MockKlineRepository()),
  orderbookRepositoryProvider.overrideWithValue(MockOrderbookRepository()),
  longShortRepositoryProvider.overrideWithValue(MockLongShortRepository()),
  whaleFeedRepositoryProvider.overrideWithValue(MockWhaleFeedRepository()),
  whaleProfileRepositoryProvider.overrideWithValue(
    MockWhaleProfileRepository(),
  ),
  whaleLeaderboardRepositoryProvider.overrideWithValue(
    MockWhaleLeaderboardRepository(),
  ),
  whaleHoldingsRepositoryProvider.overrideWithValue(
    MockWhaleHoldingsRepository(),
  ),
  whaleWatchRepositoryProvider.overrideWithValue(
    const MockWhaleWatchRepository(),
  ),
  strategyRepositoryProvider.overrideWithValue(MockStrategyRepository()),
  liveStrategyRepositoryProvider.overrideWithValue(
    MockLiveStrategyRepository(),
  ),
  aiChatRepositoryProvider.overrideWithValue(MockAiChatRepository()),
  backtestRepositoryProvider.overrideWithValue(MockBacktestRepository()),
  accountRepositoryProvider.overrideWithValue(MockAccountRepository()),
  apiKeyRepositoryProvider.overrideWithValue(MockApiKeyRepository()),
  tradingOrderRepositoryProvider.overrideWithValue(
    const MockTradingOrderRepository(),
  ),
];

List<Override> get testRepositoryOverridesWithoutTickerKline => <Override>[
  authRepositoryProvider.overrideWithValue(MockAuthRepository()),
  coinStockRepositoryProvider.overrideWithValue(
    const MockCoinStockRepository(),
  ),
  predMarketRepositoryProvider.overrideWithValue(
    const MockPredMarketRepository(),
  ),
  whaleExtrasRepositoryProvider.overrideWithValue(
    const MockWhaleExtrasRepository(),
  ),
  tradesRepositoryProvider.overrideWithValue(const MockTradesRepository()),
  aggOrderbookRepositoryProvider.overrideWithValue(
    const MockAggOrderbookRepository(),
  ),
  orderbookRepositoryProvider.overrideWithValue(MockOrderbookRepository()),
  longShortRepositoryProvider.overrideWithValue(MockLongShortRepository()),
  whaleFeedRepositoryProvider.overrideWithValue(MockWhaleFeedRepository()),
  whaleProfileRepositoryProvider.overrideWithValue(
    MockWhaleProfileRepository(),
  ),
  whaleLeaderboardRepositoryProvider.overrideWithValue(
    MockWhaleLeaderboardRepository(),
  ),
  whaleHoldingsRepositoryProvider.overrideWithValue(
    MockWhaleHoldingsRepository(),
  ),
  whaleWatchRepositoryProvider.overrideWithValue(
    const MockWhaleWatchRepository(),
  ),
  strategyRepositoryProvider.overrideWithValue(MockStrategyRepository()),
  liveStrategyRepositoryProvider.overrideWithValue(
    MockLiveStrategyRepository(),
  ),
  aiChatRepositoryProvider.overrideWithValue(MockAiChatRepository()),
  backtestRepositoryProvider.overrideWithValue(MockBacktestRepository()),
  accountRepositoryProvider.overrideWithValue(MockAccountRepository()),
  apiKeyRepositoryProvider.overrideWithValue(MockApiKeyRepository()),
  tradingOrderRepositoryProvider.overrideWithValue(
    const MockTradingOrderRepository(),
  ),
];

List<Override> get testRepositoryOverridesWithoutTickerKlineOrderbook =>
    <Override>[
      authRepositoryProvider.overrideWithValue(MockAuthRepository()),
      coinStockRepositoryProvider.overrideWithValue(
        const MockCoinStockRepository(),
      ),
      predMarketRepositoryProvider.overrideWithValue(
        const MockPredMarketRepository(),
      ),
      whaleExtrasRepositoryProvider.overrideWithValue(
        const MockWhaleExtrasRepository(),
      ),
      tradesRepositoryProvider.overrideWithValue(const MockTradesRepository()),
      aggOrderbookRepositoryProvider.overrideWithValue(
        const MockAggOrderbookRepository(),
      ),
      longShortRepositoryProvider.overrideWithValue(MockLongShortRepository()),
      whaleFeedRepositoryProvider.overrideWithValue(MockWhaleFeedRepository()),
      whaleProfileRepositoryProvider.overrideWithValue(
        MockWhaleProfileRepository(),
      ),
      whaleLeaderboardRepositoryProvider.overrideWithValue(
        MockWhaleLeaderboardRepository(),
      ),
      whaleHoldingsRepositoryProvider.overrideWithValue(
        MockWhaleHoldingsRepository(),
      ),
      whaleWatchRepositoryProvider.overrideWithValue(
        const MockWhaleWatchRepository(),
      ),
      strategyRepositoryProvider.overrideWithValue(MockStrategyRepository()),
      liveStrategyRepositoryProvider.overrideWithValue(
        MockLiveStrategyRepository(),
      ),
      aiChatRepositoryProvider.overrideWithValue(MockAiChatRepository()),
      backtestRepositoryProvider.overrideWithValue(MockBacktestRepository()),
      accountRepositoryProvider.overrideWithValue(MockAccountRepository()),
      apiKeyRepositoryProvider.overrideWithValue(MockApiKeyRepository()),
      tradingOrderRepositoryProvider.overrideWithValue(
        const MockTradingOrderRepository(),
      ),
    ];

List<Override> get testRepositoryOverridesWithoutRouterStubs => <Override>[
  coinStockRepositoryProvider.overrideWithValue(
    const MockCoinStockRepository(),
  ),
  predMarketRepositoryProvider.overrideWithValue(
    const MockPredMarketRepository(),
  ),
  whaleExtrasRepositoryProvider.overrideWithValue(
    const MockWhaleExtrasRepository(),
  ),
  tradesRepositoryProvider.overrideWithValue(const MockTradesRepository()),
  aggOrderbookRepositoryProvider.overrideWithValue(
    const MockAggOrderbookRepository(),
  ),
  longShortRepositoryProvider.overrideWithValue(MockLongShortRepository()),
  whaleFeedRepositoryProvider.overrideWithValue(MockWhaleFeedRepository()),
  whaleProfileRepositoryProvider.overrideWithValue(
    MockWhaleProfileRepository(),
  ),
  whaleLeaderboardRepositoryProvider.overrideWithValue(
    MockWhaleLeaderboardRepository(),
  ),
  whaleHoldingsRepositoryProvider.overrideWithValue(
    MockWhaleHoldingsRepository(),
  ),
  whaleWatchRepositoryProvider.overrideWithValue(
    const MockWhaleWatchRepository(),
  ),
  strategyRepositoryProvider.overrideWithValue(MockStrategyRepository()),
  liveStrategyRepositoryProvider.overrideWithValue(
    MockLiveStrategyRepository(),
  ),
  aiChatRepositoryProvider.overrideWithValue(MockAiChatRepository()),
  accountRepositoryProvider.overrideWithValue(MockAccountRepository()),
  apiKeyRepositoryProvider.overrideWithValue(MockApiKeyRepository()),
  tradingOrderRepositoryProvider.overrideWithValue(
    const MockTradingOrderRepository(),
  ),
];

List<Override> get testRepositoryOverridesWithoutAuth => <Override>[
  tickerRepositoryProvider.overrideWithValue(MockTickerRepository()),
  coinStockRepositoryProvider.overrideWithValue(
    const MockCoinStockRepository(),
  ),
  predMarketRepositoryProvider.overrideWithValue(
    const MockPredMarketRepository(),
  ),
  whaleExtrasRepositoryProvider.overrideWithValue(
    const MockWhaleExtrasRepository(),
  ),
  tradesRepositoryProvider.overrideWithValue(const MockTradesRepository()),
  aggOrderbookRepositoryProvider.overrideWithValue(
    const MockAggOrderbookRepository(),
  ),
  klineRepositoryProvider.overrideWithValue(MockKlineRepository()),
  orderbookRepositoryProvider.overrideWithValue(MockOrderbookRepository()),
  longShortRepositoryProvider.overrideWithValue(MockLongShortRepository()),
  whaleFeedRepositoryProvider.overrideWithValue(MockWhaleFeedRepository()),
  whaleProfileRepositoryProvider.overrideWithValue(
    MockWhaleProfileRepository(),
  ),
  whaleLeaderboardRepositoryProvider.overrideWithValue(
    MockWhaleLeaderboardRepository(),
  ),
  whaleHoldingsRepositoryProvider.overrideWithValue(
    MockWhaleHoldingsRepository(),
  ),
  whaleWatchRepositoryProvider.overrideWithValue(
    const MockWhaleWatchRepository(),
  ),
  strategyRepositoryProvider.overrideWithValue(MockStrategyRepository()),
  liveStrategyRepositoryProvider.overrideWithValue(
    MockLiveStrategyRepository(),
  ),
  aiChatRepositoryProvider.overrideWithValue(MockAiChatRepository()),
  backtestRepositoryProvider.overrideWithValue(MockBacktestRepository()),
  accountRepositoryProvider.overrideWithValue(MockAccountRepository()),
  apiKeyRepositoryProvider.overrideWithValue(MockApiKeyRepository()),
  tradingOrderRepositoryProvider.overrideWithValue(
    const MockTradingOrderRepository(),
  ),
];

List<Override> get testRepositoryOverridesWithoutWhaleFeed => <Override>[
  authRepositoryProvider.overrideWithValue(MockAuthRepository()),
  tickerRepositoryProvider.overrideWithValue(MockTickerRepository()),
  coinStockRepositoryProvider.overrideWithValue(
    const MockCoinStockRepository(),
  ),
  predMarketRepositoryProvider.overrideWithValue(
    const MockPredMarketRepository(),
  ),
  whaleExtrasRepositoryProvider.overrideWithValue(
    const MockWhaleExtrasRepository(),
  ),
  tradesRepositoryProvider.overrideWithValue(const MockTradesRepository()),
  aggOrderbookRepositoryProvider.overrideWithValue(
    const MockAggOrderbookRepository(),
  ),
  klineRepositoryProvider.overrideWithValue(MockKlineRepository()),
  orderbookRepositoryProvider.overrideWithValue(MockOrderbookRepository()),
  longShortRepositoryProvider.overrideWithValue(MockLongShortRepository()),
  whaleProfileRepositoryProvider.overrideWithValue(
    MockWhaleProfileRepository(),
  ),
  whaleLeaderboardRepositoryProvider.overrideWithValue(
    MockWhaleLeaderboardRepository(),
  ),
  whaleHoldingsRepositoryProvider.overrideWithValue(
    MockWhaleHoldingsRepository(),
  ),
  whaleWatchRepositoryProvider.overrideWithValue(
    const MockWhaleWatchRepository(),
  ),
  strategyRepositoryProvider.overrideWithValue(MockStrategyRepository()),
  liveStrategyRepositoryProvider.overrideWithValue(
    MockLiveStrategyRepository(),
  ),
  aiChatRepositoryProvider.overrideWithValue(MockAiChatRepository()),
  backtestRepositoryProvider.overrideWithValue(MockBacktestRepository()),
  accountRepositoryProvider.overrideWithValue(MockAccountRepository()),
  apiKeyRepositoryProvider.overrideWithValue(MockApiKeyRepository()),
  tradingOrderRepositoryProvider.overrideWithValue(
    const MockTradingOrderRepository(),
  ),
];

List<Override> get testRepositoryOverridesWithoutWhaleProfile => <Override>[
  authRepositoryProvider.overrideWithValue(MockAuthRepository()),
  tickerRepositoryProvider.overrideWithValue(MockTickerRepository()),
  coinStockRepositoryProvider.overrideWithValue(
    const MockCoinStockRepository(),
  ),
  predMarketRepositoryProvider.overrideWithValue(
    const MockPredMarketRepository(),
  ),
  whaleExtrasRepositoryProvider.overrideWithValue(
    const MockWhaleExtrasRepository(),
  ),
  tradesRepositoryProvider.overrideWithValue(const MockTradesRepository()),
  aggOrderbookRepositoryProvider.overrideWithValue(
    const MockAggOrderbookRepository(),
  ),
  klineRepositoryProvider.overrideWithValue(MockKlineRepository()),
  orderbookRepositoryProvider.overrideWithValue(MockOrderbookRepository()),
  longShortRepositoryProvider.overrideWithValue(MockLongShortRepository()),
  whaleFeedRepositoryProvider.overrideWithValue(MockWhaleFeedRepository()),
  whaleLeaderboardRepositoryProvider.overrideWithValue(
    MockWhaleLeaderboardRepository(),
  ),
  whaleHoldingsRepositoryProvider.overrideWithValue(
    MockWhaleHoldingsRepository(),
  ),
  whaleWatchRepositoryProvider.overrideWithValue(
    const MockWhaleWatchRepository(),
  ),
  strategyRepositoryProvider.overrideWithValue(MockStrategyRepository()),
  liveStrategyRepositoryProvider.overrideWithValue(
    MockLiveStrategyRepository(),
  ),
  aiChatRepositoryProvider.overrideWithValue(MockAiChatRepository()),
  backtestRepositoryProvider.overrideWithValue(MockBacktestRepository()),
  accountRepositoryProvider.overrideWithValue(MockAccountRepository()),
  apiKeyRepositoryProvider.overrideWithValue(MockApiKeyRepository()),
  tradingOrderRepositoryProvider.overrideWithValue(
    const MockTradingOrderRepository(),
  ),
];
