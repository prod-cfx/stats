// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Quantify';

  @override
  String get commonCancel => 'Cancel';

  @override
  String get commonAll => 'All';

  @override
  String get commonOr => 'or';

  @override
  String get commonLoadError => 'Load failed';

  @override
  String get commonRetry => 'Retry';

  @override
  String get commonStart => 'Start';

  @override
  String get commonEnd => 'End';

  @override
  String get commonView => 'View';

  @override
  String get commonYes => 'Yes';

  @override
  String get commonNo => 'No';

  @override
  String get devPreviewPrimaryButton => 'Primary';

  @override
  String get devPreviewSoftBubble => 'Soft bubble';

  @override
  String get aiEmptyHint =>
      'Describe the strategy you want, and I\'ll generate and backtest it.';

  @override
  String get aiInputHint => 'Type a message…';

  @override
  String get aiBacktestButton => 'Backtest';

  @override
  String get aiSendButton => 'Send';

  @override
  String get aiAppBarHistoryTooltip => 'Sessions';

  @override
  String get aiAppBarNewSessionTooltip => 'New session';

  @override
  String get aiAppBarParamsTooltip => 'Params';

  @override
  String get aiAppBarParamsButton => 'Params';

  @override
  String get aiSessionDrawerTitle => 'Strategies';

  @override
  String get aiSessionDrawerSubtitle => 'Each session has its own context';

  @override
  String get aiSessionNewButton => 'New Strategy';

  @override
  String get aiSessionEmptyHint =>
      'No sessions yet. Tap \"New Strategy\" to begin.';

  @override
  String get aiSessionStatusLive => 'Live';

  @override
  String get aiSessionStatusPending => 'Pending';

  @override
  String get aiSessionPrivacyFooter =>
      'Strategy contexts are isolated and never interfere';

  @override
  String get aiSessionUntitled => 'Untitled';

  @override
  String get aiQuickReply1 => 'Run backtest again';

  @override
  String get aiQuickReply2 => 'Set stop loss to 1.5%';

  @override
  String get aiQuickReply3 => 'Try ETH instead';

  @override
  String get aiQuickReply4 => 'Deploy to Binance';

  @override
  String get backtestSheetTitle => 'Backtest Settings';

  @override
  String get backtestSheetSubtitle =>
      'Strategy params come from the chat context';

  @override
  String get backtestFieldCapital => 'Initial Capital';

  @override
  String get backtestFieldRange => 'Historical Range';

  @override
  String get backtestRangeCustom => 'Custom';

  @override
  String get backtestFieldSlippage => 'Slippage';

  @override
  String get backtestFieldFee => 'Fee';

  @override
  String get backtestFieldFillSource => 'Fill Price Source';

  @override
  String get backtestFillOpen => 'Open';

  @override
  String get backtestFillClose => 'Close';

  @override
  String get backtestFillMid => 'Mid Price';

  @override
  String get backtestFieldPartialData => 'Allow partial data coverage';

  @override
  String get backtestShieldHint =>
      'Backtest results are for reference only and not investment advice. Strategy parameters stay tied to this chat — edit the conversation to change them.';

  @override
  String get backtestCollapseButton => 'Back';

  @override
  String get backtestStartButton => 'Start Backtest';

  @override
  String get backtestErrorInvalidDate =>
      'Please enter valid start/end date (YYYY-MM-DD)';

  @override
  String get backtestErrorEndBeforeStart => 'End time must be after start time';

  @override
  String get backtestErrorInvalidCapital =>
      'Please enter a positive capital amount';

  @override
  String get backtestErrorInvalidSlippage =>
      'Slippage must be a non-negative number (bps)';

  @override
  String get backtestErrorInvalidFee =>
      'Fee must be a non-negative number (bps)';

  @override
  String get backtestErrorFailedPrefix => 'Backtest failed: ';

  @override
  String backtestRecap(Object strategy) {
    return 'Configuring backtest parameters for \"$strategy\"';
  }

  @override
  String backtestRangeDataLabel(Object start, Object end) {
    return 'Data range: $start → $end';
  }

  @override
  String backtestRangeCustomSummary(Object days, Object bars) {
    return '$days days · $bars 15m candles';
  }

  @override
  String get backtestCapitalPresetHint =>
      'Simulated capital, used only for this backtest, does not affect live trading';

  @override
  String get backtestFieldMarket => 'Market';

  @override
  String get backtestMarketSpot => 'Spot';

  @override
  String get backtestMarketFutures => 'Futures';

  @override
  String get backtestFieldLeverage => 'Leverage';

  @override
  String get backtestLeverageHint =>
      'Backtest amplifies P&L and margin usage accordingly';

  @override
  String get backtestLeverageWarn =>
      'High leverage greatly amplifies liquidation risk; confirm your risk tolerance';

  @override
  String get backtestSectionMatching => 'Matching Parameters';

  @override
  String get backtestSectionMatchingRight => 'Affects fill simulation';

  @override
  String get backtestHintSlippage => 'Simulate order deviation in bps';

  @override
  String get backtestHintFee => 'One-way rate (taker)';

  @override
  String get backtestHintFillSource => 'Fill price within the candle';

  @override
  String get backtestHintPartialData => 'How to handle gaps in historical data';

  @override
  String get backtestPartialAllow => 'Allow';

  @override
  String get backtestPartialDisallow => 'Disallow';

  @override
  String get backtestSummaryTitle => 'This Backtest Setup';

  @override
  String get backtestSummaryRange => 'Range';

  @override
  String get backtestSummaryCapital => 'Capital';

  @override
  String get backtestSummaryMarket => 'Market';

  @override
  String get backtestSummaryMatching => 'Matching';

  @override
  String get backtestSummaryData => 'Data';

  @override
  String get backtestSummaryMarketSpot => 'Spot';

  @override
  String backtestSummaryMarketFutures(Object leverage) {
    return 'Futures · $leverage';
  }

  @override
  String backtestSummaryMatchingValue(
    Object slippage,
    Object fee,
    Object fillSource,
  ) {
    return '$slippage/$fee bps · $fillSource';
  }

  @override
  String get backtestSummaryDataAllow => 'Allow gaps, keep running';

  @override
  String get backtestSummaryDataStrict => 'Require complete data';

  @override
  String get backtestResultTitle => 'Backtest Result';

  @override
  String get backtestResultTotalReturn => 'Total Return';

  @override
  String get backtestResultMaxDrawdown => 'Max Drawdown';

  @override
  String get backtestResultSharpe => 'Sharpe';

  @override
  String get backtestResultTrades => 'Trades';

  @override
  String get backtestResultTradesSuffix => '';

  @override
  String get backtestResultStatusDone => 'Backtest Complete';

  @override
  String get backtestResultStatusDeployable => 'Deployable';

  @override
  String get backtestResultCumulativeNetValue => 'Cumulative Return';

  @override
  String get backtestResultCagrInline => 'CAGR';

  @override
  String get backtestResultDownloadLabel => 'Download backtest report';

  @override
  String get backtestResultMetricCagr => 'CAGR';

  @override
  String get backtestResultMetricCagrSub => 'Annualized compound return';

  @override
  String get backtestResultMetricSharpeSub => 'Risk-adjusted return';

  @override
  String get backtestResultMetricMaxDrawdownSub => 'Peak-to-trough drop';

  @override
  String get backtestResultMetricCalmar => 'Calmar';

  @override
  String get backtestResultMetricCalmarSub => 'CAGR / |MDD|';

  @override
  String get backtestResultMetricWinRate => 'Win Rate';

  @override
  String get backtestResultMetricWinRateSub => 'Share of winning trades';

  @override
  String get backtestResultMetricProfitLoss => 'Profit/Loss';

  @override
  String get backtestResultMetricProfitLossSub => 'Avg win / avg loss';

  @override
  String get backtestResultMetricTotalTrades => 'Total Trades';

  @override
  String get backtestResultMetricTotalTradesSub => 'Entries over 5 years';

  @override
  String get backtestResultMetricAvgHold => 'Avg Hold';

  @override
  String get backtestResultMetricAvgHoldSub => 'Duration per trade';

  @override
  String get backtestResultTabMonthly => 'Monthly Return';

  @override
  String get backtestResultTabTrades => 'Trades';

  @override
  String get backtestResultTabRisk => 'Risk';

  @override
  String get backtestResultMonthlyLegendLabel => 'Monthly % return';

  @override
  String get backtestResultTradeSideLong => 'L';

  @override
  String get backtestResultTradeSideShort => 'S';

  @override
  String get backtestResultTradeHoldPrefix => 'Hold';

  @override
  String get backtestResultAiPrefix => 'AI assessment: ';

  @override
  String get backtestProgressTitle => 'Backtesting in Progress';

  @override
  String get backtestProgressSubtitle =>
      'Replaying historical candles, please wait…';

  @override
  String get backtestProgressCancel => 'Cancel Backtest';

  @override
  String backtestRunEta(Object seconds) {
    return '${seconds}s remaining';
  }

  @override
  String backtestRunReplayingPeriod(Object period) {
    return 'Replaying · $period';
  }

  @override
  String get backtestRunCounterProcessedBars => 'Candles Processed';

  @override
  String backtestRunCounterProcessedBarsSub(Object total) {
    return '/ $total';
  }

  @override
  String get backtestRunCounterTrades => 'Trades Generated';

  @override
  String backtestRunCounterTradesSub(Object wins, Object losses) {
    return '${wins}W · ${losses}L';
  }

  @override
  String get backtestRunCounterMaxDrawdown => 'Current Max Drawdown';

  @override
  String get backtestRunCounterCumReturn => 'Current Cumulative Return';

  @override
  String get backtestRunSectionEquity => 'Live Equity';

  @override
  String get backtestRunSectionLog => 'Engine Log';

  @override
  String get backtestRunPrivacyNote =>
      'The backtest runs locally on your device; data and strategy are never uploaded. You can keep asking the AI to tune parameters when it\'s done.';

  @override
  String get backtestRunLogLoad => 'Loaded BTC/USDT 15m candles · 52,416 bars';

  @override
  String get backtestRunLogIndex => 'Indexed fast_MA(5) / slow_MA(20) ... ✓';

  @override
  String get backtestRunLogReplay =>
      'Replay started · slippage 5bps · fee 2bps';

  @override
  String get backtestRunLogOpenLong1 => 'Long opened @ 41,820.50 · size 100%';

  @override
  String get backtestRunLogCloseLong1 => 'Long closed @ 43,108.00 · +3.08%';

  @override
  String get backtestRunLogOpenLong2 => 'Long opened @ 44,260.00 · size 100%';

  @override
  String get backtestRunLogStopLoss => 'Stop-loss @ 43,375.00 · -2.00%';

  @override
  String get deployButton => 'One-click Deploy';

  @override
  String get deploySheetTitleExchange => 'Select Exchange';

  @override
  String get deploySheetTitleAuthorize => 'Authorize Deployment';

  @override
  String get deploySheetTitleDeploying => 'Deploying…';

  @override
  String get deploySheetTitleDone => 'Deployed';

  @override
  String get deployExchangeConfigured => 'Configured';

  @override
  String get deployExchangeNotConfigured => 'Not configured';

  @override
  String get deployExchangeEmptyHint =>
      'No exchange API configured yet. Add one to continue.';

  @override
  String get deployGoConfigureButton => 'Add API';

  @override
  String get deployAuthorizePermissionTitle =>
      'The exchange will be asked for:';

  @override
  String get deployAuthorizePermissionSpot => 'Spot trading';

  @override
  String get deployAuthorizePermissionFutures => 'Futures trading';

  @override
  String get deployAuthorizePermissionBalance => 'Read balance';

  @override
  String get deployAuthorizeConfirmButton => 'Agree & deploy';

  @override
  String get deployRiskBannerOk => 'Risk check passed · executes per plan';

  @override
  String get deployFooterSafety =>
      'We never hold your keys; signing happens only on your device';

  @override
  String get deployExchangeTagOnchain => 'On-chain';

  @override
  String get deployExchangeTagRecommended => 'Recommended';

  @override
  String get deployUnauthorizedTitle => 'Authorization steps';

  @override
  String get deployUnauthorizedSubtitle => '3 steps, end-to-end encrypted';

  @override
  String get deployUnauthorizedIdentityWarning =>
      'Not authorized · cannot accept orders';

  @override
  String get deployUnauthorizedStep1Title =>
      'Create an API key on the exchange';

  @override
  String get deployUnauthorizedStep1Sub =>
      'Sign in → API management → create new key';

  @override
  String get deployUnauthorizedStep2Title =>
      'Only enable Read + Spot/Futures trading';

  @override
  String get deployUnauthorizedStep2Sub =>
      'Always disable Withdraw; the server will double-check';

  @override
  String get deployUnauthorizedStep3Title =>
      'Paste API Key / Secret into Quantify';

  @override
  String get deployUnauthorizedStep3Sub =>
      'Stored encrypted on your device, never uploaded';

  @override
  String get deployUnauthorizedWithdrawWarning =>
      'Withdraw permission MUST be disabled. We re-check and reject keys with withdraw enabled.';

  @override
  String get deployUnauthorizedConsent =>
      'I understand: the API key will only be used to execute trades per this plan, and can be revoked at My → API Management at any time.';

  @override
  String get deployUnauthorizedOpenFormButton => 'Open API form';

  @override
  String get deployUnauthorizedCancelButton => 'Cancel';

  @override
  String get deployDoneToast => 'Strategy deployed';

  @override
  String get deployDoneCloseButton => 'Done';

  @override
  String get deploySystemMessagePrefix => 'Strategy deployed to ';

  @override
  String get deploySystemMessageInstanceInfix => ' · instance ID ';

  @override
  String deployedBubbleStrategyId(Object id) {
    return 'Strategy ID $id · running';
  }

  @override
  String get deployedBubbleArchivedNotice =>
      'This conversation is archived. To adjust, create a new plan or manage it in live strategies.';

  @override
  String get deploySheetTitleAllocate => 'Allocate Funds';

  @override
  String get deploySheetTitlePreflight => 'Preflight Checks';

  @override
  String deployStepIndicator(Object current, Object total) {
    return '$current/$total';
  }

  @override
  String get deployAllocateAmountLabel => 'Investment amount';

  @override
  String get deployAllocateAmountHint =>
      'Tip: keep your first deployment under 30% of total funds';

  @override
  String get deployAllocatePerTradeLabel => 'Max position per trade';

  @override
  String get deployAllocatePerTradeCaption => 'Max share per trade';

  @override
  String get deployAllocateMaxDailyLossLabel => 'Max daily loss';

  @override
  String get deployAllocateMaxDailyLossCaption =>
      'Pauses today\'s trading once hit';

  @override
  String get deployAllocateNotifySectionLabel => 'Notifications';

  @override
  String get deployAllocateNotifyOpenLabel => 'Notify on open';

  @override
  String get deployAllocateNotifyOpenCaption => 'Push + in-app message';

  @override
  String get deployAllocateNotifyCloseLabel => 'Notify on close';

  @override
  String get deployAllocateNotifyCloseCaption => 'Push + in-app message';

  @override
  String get deployAllocateNotifyStopLossLabel => 'Notify on stop-loss';

  @override
  String get deployAllocateNotifyStopLossCaption => 'Push + email';

  @override
  String get deployAllocateNextButton => 'Next';

  @override
  String get deployPreflightStrategyName => 'BTC Trend · Dual MA';

  @override
  String get deployPreflightStrategyMeta => 'BTC/USDT · 15m · Perp · 5x';

  @override
  String deployPreflightScanning(Object done, Object total) {
    return 'Checking $done/$total';
  }

  @override
  String deployPreflightPassed(Object pass, Object total) {
    return '$pass/$total passed';
  }

  @override
  String deployPreflightFailed(Object fail, Object total) {
    return '$fail/$total failed';
  }

  @override
  String get deployPreflightRecheck => 'Re-check';

  @override
  String get deployPreflightRechecking => 'Checking…';

  @override
  String deployPreflightApiOkTitle(Object exchange) {
    return '$exchange API connected';
  }

  @override
  String get deployPreflightApiOkSub =>
      'Read + spot + perp · withdraw disabled (safe)';

  @override
  String get deployPreflightBalanceOkTitle => 'Sufficient balance';

  @override
  String get deployPreflightBalanceOkSub =>
      'Available funds cover the deployment with headroom';

  @override
  String get deployPreflightLatencyOkTitle =>
      'Network & exchange latency normal';

  @override
  String get deployPreflightLatencyOkSub =>
      'Order latency < 200ms · stable data feed';

  @override
  String get deployPreflightBackButton => 'Back';

  @override
  String get deployPreflightConfirmButton => 'Confirmed, deploy now';

  @override
  String get deployPreflightApiFailTitle => 'Exchange API not bound';

  @override
  String get deployPreflightApiFailSub =>
      'No usable key detected, bind API and retry';

  @override
  String get deployPreflightBalanceFailTitle => 'Insufficient account balance';

  @override
  String get deployPreflightBalanceFailSub =>
      'Available funds below deploy requirement, top up or lower the amount';

  @override
  String get deployPreflightLatencyFailTitle =>
      'Network or exchange latency abnormal';

  @override
  String get deployPreflightLatencyFailSub =>
      'High order latency · unstable feed, retry later';

  @override
  String get deployConfirmSummaryReturn => 'Cumulative net value';

  @override
  String get deployConfirmSummarySharpe => 'Sharpe';

  @override
  String get deployConfirmSummaryMaxDrawdown => 'Max drawdown';

  @override
  String get deployConfirmFieldExchange => 'Exchange';

  @override
  String get deployConfirmFieldMarketType => 'Market type';

  @override
  String get deployConfirmFieldAccount => 'Account';

  @override
  String get deployConfirmFieldLeverage => 'Deploy leverage';

  @override
  String get deployConfirmMarketPerp => 'Perpetual';

  @override
  String get deployConfirmFootnote =>
      'Exchange, market, and leverage are decided in the AI chat; account can switch among bound accounts on the same exchange. The live strategy will deploy per this plan.';

  @override
  String deployingTitle(Object exchange) {
    return 'Deploying to $exchange';
  }

  @override
  String get deployingCaption =>
      'Please keep this page open, usually 3-5 seconds';

  @override
  String get deployingStepAuthTitle => 'Verify API permissions';

  @override
  String get deployingStepAuthSub =>
      'Confirm withdraw off · spot + futures trading on';

  @override
  String get deployingStepPushTitle => 'Push strategy to cloud';

  @override
  String get deployingStepPushSub =>
      'Encrypted upload of strategy params and risk rules';

  @override
  String get deployingStepNodeTitle => 'Start execution node';

  @override
  String get deployingStepNodeSub =>
      'Allocate dedicated node · sync exchange time';

  @override
  String get deployingStepFeedTitle => 'Subscribe to live market';

  @override
  String get deployingStepFeedSub => 'BTC/USDT 15m · WebSocket connected';

  @override
  String get deployingStepReadyTitle => 'Ready';

  @override
  String get deployingStepReadySub => 'Waiting for the first signal';

  @override
  String get deployDoneTitle => 'Deployed';

  @override
  String deployDoneSubtitle(Object exchange) {
    return 'Your strategy is live on $exchange; we\'ll push you when the first signal fires';
  }

  @override
  String get deployDoneDetailStrategyId => 'Strategy ID';

  @override
  String get deployDoneDetailExchange => 'Exchange';

  @override
  String get deployDoneDetailSymbol => 'Pair';

  @override
  String get deployDoneDetailAmount => 'Initial funds';

  @override
  String get deployDoneDetailLeverage => 'Leverage';

  @override
  String get deployDoneDetailStartedAt => 'Started at';

  @override
  String get deployDoneDetailStatus => 'Status';

  @override
  String get deployDoneStatusRunning => 'Running';

  @override
  String get deployDoneNextStepsLabel => 'Next you can';

  @override
  String get deployDoneNextLiveTitle => 'View live strategy';

  @override
  String get deployDoneNextLiveSub =>
      'Track positions and PnL in My → Live Strategies';

  @override
  String get deployDoneNextNotifyTitle => 'Enable price alerts';

  @override
  String get deployDoneNextNotifySub =>
      'Get notified the moment BTC breaks key levels';

  @override
  String get deployDoneNextTuneTitle => 'Keep tuning in AI';

  @override
  String get deployDoneNextTuneSub =>
      'Return to the chat anytime to adjust stops or params';

  @override
  String get authLoginTitle => 'Login';

  @override
  String get authLoginWelcome => 'Welcome back';

  @override
  String get authLoginWelcomeSubtitle => 'Continue with email or Telegram';

  @override
  String get authLoginOr => 'or';

  @override
  String get authLoginEmailLabel => 'Email';

  @override
  String get authLoginPasswordLabel => 'Password';

  @override
  String get authLoginPasswordHint => 'At least 6 characters';

  @override
  String get authLoginCodeLabel => 'Verification code';

  @override
  String get authLoginCodeHint => '6-digit code';

  @override
  String get authLoginSendCode => 'Send code';

  @override
  String get authLoginResend => 'Resend';

  @override
  String authLoginCountdown(Object secs) {
    return 'Resend in ${secs}s';
  }

  @override
  String get authLoginCodeRequired => 'Please enter the verification code';

  @override
  String get authLoginCodeInvalid => 'Verification code must be 6 digits';

  @override
  String get authLoginButton => 'Log In';

  @override
  String get authLoginTelegramButton => 'Login with Telegram';

  @override
  String get authLoginEmailRequired => 'Please enter your email';

  @override
  String get authLoginEmailInvalid => 'Invalid email format';

  @override
  String get authLoginPasswordRequired => 'Please enter your password';

  @override
  String get authLoginPasswordTooShort =>
      'Password must be at least 6 characters';

  @override
  String get authLoginFailedPrefix => 'Login failed: ';

  @override
  String get authTelegramLoginFailedPrefix => 'Telegram login failed: ';

  @override
  String get authLoginHeroTitleLine1 => 'Turn trading ideas';

  @override
  String get authLoginHeroTitleLine2 => 'into backtestable strategies';

  @override
  String get authLoginHeroSubtitle => 'Chat · Backtest · Deploy via API';

  @override
  String get authLoginTermsPrefix => 'By continuing you agree to our ';

  @override
  String get authLoginTermsLink => 'Terms of Service';

  @override
  String get authLoginTermsAnd => ' and ';

  @override
  String get authLoginPrivacyLink => 'Privacy Policy';

  @override
  String get marketHomeTabWatchlist => 'Watchlist';

  @override
  String get marketHomeTabSpot => 'Spot';

  @override
  String get marketHomeTabPerp => 'Perp';

  @override
  String get marketHomeTabGainers => 'Gainers';

  @override
  String get marketHomeTabLosers => 'Losers';

  @override
  String get marketHomeLoadError => 'Market data load failed';

  @override
  String get marketHomeEmpty => 'No market data';

  @override
  String get marketHomeWatchlistEmpty => 'No watchlist items';

  @override
  String get marketHomeSearchEmpty => 'No matching symbols';

  @override
  String get marketHomeSearchTooltip => 'Search';

  @override
  String get marketHomeSearchClose => 'Close search';

  @override
  String get marketHomeSearchPlaceholder => 'Search symbol · BTC, ETH, SOL…';

  @override
  String get dataHubTitle => 'Data';

  @override
  String get dataHubTabMarket => 'Market';

  @override
  String get dataHubTabLongShort => 'Long/Short';

  @override
  String get dataHubTabAggOrders => 'Agg. Orders';

  @override
  String get dataHubTabPredict => 'Prediction';

  @override
  String get dataHubTabCoinStock => 'Coin Stocks';

  @override
  String get dataHubHintMarket => 'Watchlist · Movers';

  @override
  String get dataHubHintLongShort => 'Perps L/S';

  @override
  String get dataHubHintAggOrders => 'Cross-venue depth';

  @override
  String get dataHubHintPredict => 'On-chain odds';

  @override
  String get dataHubHintCoinStock => 'Crypto-linked stocks';

  @override
  String get dataHubNotificationTooltip => 'Notifications';

  @override
  String get dataHubPlaceholderTitle => 'Coming soon';

  @override
  String get marketHomeColumnName => 'Name / 24H Vol';

  @override
  String get marketHomeColumnPrice => 'Last';

  @override
  String get marketHomeColumnChange => '24H Chg';

  @override
  String get marketLongShortTitle => 'Long/Short';

  @override
  String get marketLongShortLoadError => 'Long/short data load failed';

  @override
  String get marketLongShortHistory => 'History';

  @override
  String get marketLongShortHistorySection => 'Historical long/short';

  @override
  String get marketLongShortHeroSuffix => 'market';

  @override
  String marketLongShortTotalNotional(String total) {
    return '$total open interest · 4H data';
  }

  @override
  String get marketLongShortLongHolding => 'Long open';

  @override
  String get marketLongShortShortHolding => 'Short open';

  @override
  String get marketLongShortExchangesTitle => 'Exchange split';

  @override
  String get marketLongShortExchangesSortBy => 'Sorted by long size';

  @override
  String get marketLongShortRefreshTooltip => 'Refresh';

  @override
  String get marketLongShortLive => 'LIVE';

  @override
  String marketLongShortRowLongPct(String pct) {
    return 'Long $pct%';
  }

  @override
  String marketLongShortRowShortPct(String pct) {
    return 'Short $pct%';
  }

  @override
  String get marketDetailSymbolNotFound => 'Symbol not found';

  @override
  String get marketDetailTickerPrefix => 'Market Detail: ';

  @override
  String get marketDetailSectionOrderbook => 'Order Book';

  @override
  String get marketDetailBuyButton => 'Buy / Long';

  @override
  String get marketDetailBuySubLabel => 'Open long · 10x';

  @override
  String get marketDetailSellButton => 'Sell / Short';

  @override
  String get marketDetailSellSubLabel => 'Open short · 10x';

  @override
  String get marketDetailSubtitlePerpBinance => 'Perp · Binance';

  @override
  String get marketDetail24hHigh => '24H High';

  @override
  String get marketDetail24hLow => '24H Low';

  @override
  String get marketDetail24hVolume => '24H Volume';

  @override
  String get marketDetailOpenInterest => 'Open Interest';

  @override
  String get marketDetailPanelOrderbook => 'Order Book';

  @override
  String get marketDetailPanelTrades => 'Trades';

  @override
  String get marketDetailPanelDepth => 'Depth';

  @override
  String get marketDetailColTime => 'Time';

  @override
  String get marketDetailColPrice => 'Price';

  @override
  String get marketDetailColQty => 'Qty';

  @override
  String get marketDetailDepthBid => 'BID';

  @override
  String get marketDetailDepthSpread => 'SPREAD';

  @override
  String get marketDetailDepthAsk => 'ASK';

  @override
  String get orderbookViewBoth => 'Both';

  @override
  String get orderbookViewAsks => 'Asks';

  @override
  String get orderbookViewBids => 'Bids';

  @override
  String get orderbookPrecisionTitle => 'Price precision';

  @override
  String get orderbookRefreshFuture => 'Refresh (coming soon)';

  @override
  String get orderbookSortFuture => 'Sort (coming soon)';

  @override
  String get aggSubTabOrders => 'Agg Orders';

  @override
  String get aggSubTabOpenInterest => 'Open Interest';

  @override
  String get aggSubTabVolume => 'Volume';

  @override
  String get predMarketSubtitle =>
      'Future trend forecasts based on on-chain data';

  @override
  String get predMarketSearchHint => 'Search prediction markets';

  @override
  String get predMarketSearchHotLabel => 'Hot topics';

  @override
  String get predMarketEmpty => 'No matching markets';

  @override
  String get predMarketDetailTitle => 'Market detail';

  @override
  String get predMarketRules => 'Rules';

  @override
  String get predMarketResolutionSource => 'Resolution source';

  @override
  String get predMarketEventWindow => 'Event window';

  @override
  String get predMarketCreatedAt => 'Created at';

  @override
  String get predMarketVolumeLabel => 'Volume';

  @override
  String get predMarketStatusOpen => 'OPEN';

  @override
  String get predMarketStatusClosed => 'CLOSED';

  @override
  String get coinStockTabAll => 'All';

  @override
  String get coinStockTabOther => 'Other';

  @override
  String get coinStockSearchHint => 'Search company / ticker';

  @override
  String get coinStockSearchHotLabel => 'Popular tickers';

  @override
  String get coinStockSearchEmpty => 'No matching companies';

  @override
  String get coinStockEmpty => 'No matching companies';

  @override
  String get coinStockStatMnav => 'MNAV';

  @override
  String get coinStockStatMcap => 'Market cap';

  @override
  String get coinStockStatHoldValue => 'Holdings value';

  @override
  String get coinStockStatHoldQty => 'Holdings';

  @override
  String get coinStockSortPrice => 'Price';

  @override
  String get coinStockSortChange => '24h change';

  @override
  String get coinStockSortBy => 'Sort by';

  @override
  String get coinStockSortTitle => 'Filter & sort';

  @override
  String get coinStockSortMetricLabel => 'Metric';

  @override
  String get coinStockSortDirectionLabel => 'Order';

  @override
  String get coinStockSortAsc => 'Ascending';

  @override
  String get coinStockSortDesc => 'Descending';

  @override
  String get coinStockSortNone => 'Unsorted';

  @override
  String coinStockSortApply(int count) {
    return 'View $count results';
  }

  @override
  String get coinStockDetailPrice => 'Current price · USD';

  @override
  String get coinStockDetailOverview => 'Overview';

  @override
  String get coinStockDetailMetrics => 'Key metrics';

  @override
  String get coinStockChipListed => 'Listed';

  @override
  String get coinStockChipRelated => 'Related';

  @override
  String get aggModeFutures => 'Futures';

  @override
  String get aggModeSpot => 'Spot';

  @override
  String get aggStat24hVolume => '24h Volume';

  @override
  String get aggStat24hTurnover => '24h Turnover';

  @override
  String aggOrderbookTitle(String coin, String mode) {
    return '$coin/USD Live Orders ($mode)';
  }

  @override
  String get aggColPrice => 'Price (USDT)';

  @override
  String aggColQty(String coin) {
    return 'Qty ($coin)';
  }

  @override
  String aggColTotal(String coin) {
    return 'Total ($coin)';
  }

  @override
  String get aggViewBoth => 'Both';

  @override
  String get aggViewAsks => 'Asks';

  @override
  String get aggViewBids => 'Bids';

  @override
  String get aggBestBidAsk => 'Bid / Ask';

  @override
  String get aggPrecisionTitle => 'Price Precision';

  @override
  String get aggExchangeSourceTitle => 'Exchange Sources';

  @override
  String get aggExchangeSourceTooltip => 'Exchange source settings';

  @override
  String get aggSelectAll => 'Select all';

  @override
  String get aggClearAll => 'Clear';

  @override
  String get aggCancel => 'Cancel';

  @override
  String get aggDepthTitle => 'Order Depth';

  @override
  String get aggLiquidityHeatmap => 'Liquidity Heatmap';

  @override
  String get aggDepthLegendBids => 'Cumulative bids';

  @override
  String get aggDepthLegendAsks => 'Cumulative asks';

  @override
  String aggUnit(String coin) {
    return 'Unit: $coin';
  }

  @override
  String get aggOiColExchange => 'Exchange';

  @override
  String get aggOiColShare => 'Share';

  @override
  String get aggOiColPosition => 'Open Interest';

  @override
  String get aggOiCol24hChange => '24H Change';

  @override
  String get aggOiRowAll => 'All';

  @override
  String get aggCoinSearchHint => 'Search coin';

  @override
  String get aggCoinSearchHot => 'Popular coins';

  @override
  String get aggCoinSearchEmpty => 'No matching coin';

  @override
  String get aggNoData => 'No data';

  @override
  String get aggNoMatchExchange => 'No matching exchange';

  @override
  String get aggVolumeTotal => 'Total';

  @override
  String get tradesTabLatest => 'Latest';

  @override
  String get tradesTabBig => 'Big trades';

  @override
  String get tradesSortTooltip => 'Sort';

  @override
  String get marketDetailStarTooltip => 'Favorite';

  @override
  String get marketDetailMoreTooltip => 'More';

  @override
  String get marketDetailFavoriteAddedToast => 'Added to watchlist';

  @override
  String get marketDetailFavoriteRemovedToast => 'Removed from watchlist';

  @override
  String get marketDetailMoreSheetTitle => 'More actions';

  @override
  String get marketDetailMoreCopySymbol => 'Copy symbol';

  @override
  String get marketDetailMoreCopiedToast => 'Symbol copied';

  @override
  String get marketDetailMoreShare => 'Share';

  @override
  String get marketDetailMoreAlert => 'Price alert';

  @override
  String get marketDetailMoreSwitchExchange => 'Switch exchange';

  @override
  String get marketDetailMoreComingSoon => 'Coming soon';

  @override
  String get tradeOrderSheetTabLimit => 'Limit';

  @override
  String get tradeOrderSheetTabMarket => 'Market';

  @override
  String get tradeOrderSheetTabConditional => 'Conditional';

  @override
  String get tradeOrderSheetMarginCross => 'Cross';

  @override
  String get tradeOrderSheetMarginIsolated => 'Isolated';

  @override
  String get tradeOrderSheetFieldPrice => 'Price';

  @override
  String get tradeOrderSheetFieldAmount => 'Amount';

  @override
  String get tradeOrderSheetFieldTriggerPrice => 'Trigger Price';

  @override
  String get tradeOrderSheetFieldTakeProfit => 'Take Profit';

  @override
  String get tradeOrderSheetFieldStopLoss => 'Stop Loss';

  @override
  String get tradeOrderSheetMarketPriceHint => 'Market';

  @override
  String get tradeOrderSheetLeverageLabel => 'Leverage';

  @override
  String get tradeOrderSheetEstLiqPrice => 'Est. Liq. Price';

  @override
  String get tradeOrderSheetEstLiqPlaceholder => '—';

  @override
  String get tradeOrderSheetErrorPriceRequired => 'Enter a valid price';

  @override
  String get tradeOrderSheetErrorAmountRequired => 'Enter a valid amount';

  @override
  String get tradeOrderSheetErrorTriggerRequired =>
      'Enter a valid trigger price';

  @override
  String get tradeOrderSheetSubmitBuyPrefix => 'Buy ';

  @override
  String get tradeOrderSheetSubmitSellPrefix => 'Sell ';

  @override
  String get tradeOrderSheetSuccessToast => 'Order placed';

  @override
  String tradeOrderSheetHeaderTitleBuy(Object symbol) {
    return 'Buy / Long $symbol';
  }

  @override
  String tradeOrderSheetHeaderTitleSell(Object symbol) {
    return 'Sell / Short $symbol';
  }

  @override
  String tradeOrderSheetHeaderSubtitle(Object pair, Object exchange) {
    return '$pair · Perp · $exchange';
  }

  @override
  String get tradeOrderSheetCloseTooltip => 'Close';

  @override
  String get tradeOrderSheetLeverageGridTitle => 'Select leverage';

  @override
  String get tradeOrderSheetReferenceLatest => 'Last';

  @override
  String get tradeOrderSheetReferenceBid1 => 'Bid1';

  @override
  String get tradeOrderSheetReferenceAsk1 => 'Ask1';

  @override
  String tradeOrderSheetAvailableLabel(Object amount) {
    return 'Available $amount USDT';
  }

  @override
  String get tradeOrderSheetMarketHintPrefix => 'Market fills instantly · ref ';

  @override
  String get tradeOrderSheetMarketHintSuffix => ' USDT';

  @override
  String get tradeOrderSheetTpsl => 'TP / SL';

  @override
  String get tradeOrderSheetStatMargin => 'Margin';

  @override
  String get tradeOrderSheetStatNotional => 'Notional';

  @override
  String get tradeOrderSheetStatFee => 'Fee (taker)';

  @override
  String get tradeOrderSheetStatTpReturn => 'Est. TP Return';

  @override
  String get tradeOrderSheetStatSlLoss => 'Est. SL Loss';

  @override
  String get tradeOrderSheetRiskHint =>
      'AI risk control will review your position and max drawdown';

  @override
  String get tradeOrderSheetSubmitEmpty => 'Select amount';

  @override
  String get tradeOrderSheetSubmitting => 'Submitting…';

  @override
  String tradeOrderSheetSubmitConfirmBuy(Object amount, Object base) {
    return 'Confirm Buy $amount $base';
  }

  @override
  String tradeOrderSheetSubmitConfirmSell(Object amount, Object base) {
    return 'Confirm Sell $amount $base';
  }

  @override
  String get orderbookLoadError => 'Order book load failed';

  @override
  String get meHomeLoadErrorPrefix => 'Load failed: ';

  @override
  String get meStatsActiveStrategies => 'Active Strategies';

  @override
  String get meStatsCumulativeReturn => 'Cumulative Return';

  @override
  String get meStatsWinRate => 'Win Rate';

  @override
  String get meHeaderCopyUid => 'Copy UID';

  @override
  String get meHeaderUidCopied => 'UID copied';

  @override
  String get meHeaderTelegramBound => 'Telegram Linked';

  @override
  String get meHeaderBinanceConnected => 'Binance ✓';

  @override
  String get meSectionAccount => 'Account';

  @override
  String get meSectionApi => 'Exchange API';

  @override
  String get meSectionPreferences => 'Preferences';

  @override
  String get meSettingsTelegram => 'Telegram';

  @override
  String get meSettingsTelegramUnbound => 'Not bound';

  @override
  String get meSettingsTelegramHandle => '@victor_qf';

  @override
  String get meSettingsSecurity => 'Security';

  @override
  String get meSettingsSecurityValue => '2FA · Enabled';

  @override
  String get meSettingsNotConfigured => 'Not configured';

  @override
  String get meSettingsLanguage => 'Language';

  @override
  String get meSettingsLanguageValue => 'Simplified Chinese';

  @override
  String get meSettingsLanguageSheetTitle => 'Language';

  @override
  String get meSettingsLanguageOptionZh => '简体中文';

  @override
  String get meSettingsLanguageOptionEn => 'English';

  @override
  String get meSettingsTheme => 'Theme';

  @override
  String get meSettingsThemeValue => 'System Default';

  @override
  String get meSettingsNotifications => 'Notifications';

  @override
  String get meSettingsNotificationsValue => 'Telegram · On';

  @override
  String get meLogout => 'Log Out';

  @override
  String get meApiSettingsTitle => 'Exchange API';

  @override
  String get meApiConnected => 'Connected · Read + Trade';

  @override
  String get meApiNotConfigured => 'Not configured · Set up before deploying';

  @override
  String get meApiManage => 'Manage';

  @override
  String get meApiConnect => 'Connect';

  @override
  String get meApiLoadErrorPrefix => 'Load failed: ';

  @override
  String get meApiFormPermissionHint => 'Read + trade permissions only';

  @override
  String get meApiFormPermissionSection => 'Authorized Permissions';

  @override
  String get meApiFormPermAccountRead => 'Read account & positions';

  @override
  String get meApiFormPermSpotOrder => 'Spot Order';

  @override
  String get meApiFormPermFuturesOrder => 'Futures Order';

  @override
  String get meApiFormPermRequired => 'Required';

  @override
  String get meApiFormPermOptional => 'Optional';

  @override
  String get meApiFormPermWithdrawLabel => 'Withdrawal';

  @override
  String get meApiFormPermWithdrawValue => 'Must Disable';

  @override
  String get meApiFormWarningMust => 'You must ';

  @override
  String meApiFormWarningBody(String exchange) {
    return 'disable withdrawal permissions in $exchange settings. The server will verify again and immediately reject keys that allow withdrawals.';
  }

  @override
  String get meApiFormLabelNote => 'Note';

  @override
  String get meApiFormSaveButton => 'Verify & Save';

  @override
  String get meApiFormDefaultLabel => 'Default';

  @override
  String get meApiFormSaveFailedPrefix => 'Save failed: ';

  @override
  String get meApiFormSaveFailed => 'Save failed, please try again later';

  @override
  String get meApiFormApiKeyLabel => 'API Key';

  @override
  String get meApiFormSecretLabel => 'Secret';

  @override
  String get meApiFormNoteTooLong => 'Note must be under 30 characters';

  @override
  String get meApiFormPleaseEnter => 'Please enter ';

  @override
  String get meApiFormMinLenSuffix => ' characters';

  @override
  String get meApiFormMinLenInfix => ' must be at least ';

  @override
  String get meApiFormSecretKeyLabel => 'Secret Key';

  @override
  String get meApiFormPassphraseLabel => 'Passphrase';

  @override
  String get meApiFormPassphraseHint =>
      'The passphrase you set when creating the API key; the exchange won\'t show it again. All three fields are required to sign orders.';

  @override
  String get meApiFormWalletAddressLabel => 'Main Wallet Address';

  @override
  String get meApiFormAgentKeyLabel => 'Agent Private Key';

  @override
  String get meApiFormWalletHint =>
      'Generate an Agent Wallet under Hyperliquid → More → API and paste its private key here. The agent key can only place orders, never move funds; the main wallet address is used to read positions.';

  @override
  String get meApiFormWalletWarningMust => 'The agent wallet ';

  @override
  String get meApiFormWalletWarningBody =>
      'can only place orders and can never transfer or withdraw—your main wallet assets stay under your control. Never paste your main wallet private key.';

  @override
  String get meApiFormPermPerpSpotOrder => 'Perp / Spot Order';

  @override
  String get meApiFormPermTransferWithdraw => 'Transfer / Withdrawal';

  @override
  String get meApiFormPermAgentNoAccess => 'Agent No Access';

  @override
  String get meApiFormEnvLabel => 'Environment';

  @override
  String get meApiFormEnvMainnetLabel => 'Mainnet';

  @override
  String get meApiFormEnvMainnetSub => 'Real Funds';

  @override
  String get meApiFormEnvTestnetLabel => 'Testnet';

  @override
  String get meApiFormEnvTestnetSub => 'Simulated Funds';

  @override
  String get meApiFormTestnetSubtitle =>
      'Testnet · Simulated funds · No impact on real accounts';

  @override
  String get meApiFormTestnetWarningBold => 'Visit testnet.binance.vision ';

  @override
  String get meApiFormTestnetWarningBody =>
      'to apply for dedicated testnet keys (mainnet keys won\'t work). Testnet coins reset every 24h, so debug strategies freely.';

  @override
  String get meApiFormEndpointLabel => 'Endpoint';

  @override
  String get meApiFormPermWithdrawTestnetValue => 'No withdrawal on testnet';

  @override
  String get meApiFormSaveTestnetButton => 'Save Testnet Keys';

  @override
  String get themeSettingsTitle => 'Interface Theme';

  @override
  String get themeSettingsSyncSubtitle => 'Syncs across Web and App';

  @override
  String get themeSettingsSyncFootnote =>
      'Theme is currently stored on this device only. Once account sync is enabled, it will follow you between Web and App on sign-in.';

  @override
  String get themeBgSection => 'Background';

  @override
  String get themeAccentSection => 'Accent Color';

  @override
  String get themeBgDark => 'Dark';

  @override
  String get themeBgPink => 'Pink';

  @override
  String get themeBgLight => 'Light';

  @override
  String get themeAccentViolet => 'Violet';

  @override
  String get themeAccentCyan => 'Cyan';

  @override
  String get themeAccentAmber => 'Amber';

  @override
  String get themePreviewTitle => 'Preview · AI Strategy';

  @override
  String get themePreviewIdentified =>
      'Identified as \"Trend Following\" strategy';

  @override
  String get themePreviewStartBacktest => 'Start Backtest';

  @override
  String get aiConfirmStrategy => 'Confirm Strategy';

  @override
  String get aiConfirmSubtitle => 'Review params before backtesting';

  @override
  String get aiConfirmCancel => 'Cancel';

  @override
  String get aiConfirmHeroSubtitle =>
      'Generated from this chat · keep tuning in dialogue';

  @override
  String get aiConfirmLogicTitle => 'Strategy Logic';

  @override
  String get aiConfirmEditInChat => 'Edit in chat';

  @override
  String get aiConfirmRuleIf => 'IF';

  @override
  String get aiConfirmRuleThen => 'THEN';

  @override
  String get aiConfirmRuleSep => 'AND AT THEN';

  @override
  String get aiConfirmExecuteTitle => 'EXECUTE';

  @override
  String get aiConfirmExecExchange => 'Exchange';

  @override
  String get aiConfirmExecSymbol => 'Symbol';

  @override
  String get aiConfirmExecPeriod => 'Period';

  @override
  String get aiConfirmExecPosition => 'Position';

  @override
  String get aiConfirmExecMarket => 'Market';

  @override
  String get aiConfirmRiskBadge => 'Risk';

  @override
  String get aiConfirmAdviceTitle => 'AI Hint';

  @override
  String get aiConfirmDisclaimer =>
      'Backtests use historical data and cannot guarantee live results. Validate with a paper account before deploying.';

  @override
  String get aiConfirmBackToChat => 'Back to chat';

  @override
  String get aiConfirmNextScript => 'Next: Strategy Script';

  @override
  String get aiStartBacktestPrompt => 'Shall I start the backtest?';

  @override
  String get aiParamsBadgePrefix => 'Identified as';

  @override
  String get aiParamsBadgeSuffix => 'strategy. Suggested parameters:';

  @override
  String get aiParamsLockedBanner => 'Archived · view only';

  @override
  String get themeToggleAutoFollowSystem => 'Auto Follow System';

  @override
  String get themeToggleReduceMotion => 'Reduce Motion';

  @override
  String get strategyHomeTitle => 'Strategy Plaza';

  @override
  String get strategyHomeSubtitle => 'Curated · one-tap to chat';

  @override
  String get strategyHomeSearchHint => 'Search strategy · pair · author';

  @override
  String get strategyHomeEmpty => 'No matching strategies';

  @override
  String get strategyHomeFavorites => 'Favorites';

  @override
  String get strategyHomeFavEmptyTitle => 'No favorite strategies yet';

  @override
  String get strategyHomeFavEmptyHint =>
      'Tap the ☆ star at the top-right of a strategy card to save the ones you like here.';

  @override
  String get strategyHomeFavEmptyCta => 'Browse the plaza';

  @override
  String get strategySearchButton => 'Search';

  @override
  String get strategySearchTrendingLabel => 'Trending';

  @override
  String get strategySearchHistoryLabel => 'Recent searches';

  @override
  String get strategySearchClearHistory => 'Clear search history';

  @override
  String get strategySearchGuessLabel => 'You may follow';

  @override
  String get strategySearchTagSection => 'Tags';

  @override
  String get strategySearchAuthorSection => 'Authors';

  @override
  String get strategySearchStrategySection => 'Strategies';

  @override
  String strategySearchTagChip(Object tag) {
    return '$tag strategies';
  }

  @override
  String strategySearchAuthorCount(int count) {
    return '$count strategies';
  }

  @override
  String strategySearchNoResults(Object query) {
    return 'No results for \"$query\"';
  }

  @override
  String strategySearchStratWinRate(int win) {
    return 'Win $win%';
  }

  @override
  String strategySearchStratFollow(int users) {
    return '$users followers';
  }

  @override
  String get strategyCategoryTrend => 'Trend';

  @override
  String get strategyCategoryGrid => 'Grid';

  @override
  String get strategyCategoryArbitrage => 'Arbitrage';

  @override
  String get strategyCategoryReversal => 'Reversal';

  @override
  String get strategyCategoryHedge => 'Hedge';

  @override
  String get strategyCategoryHighFreq => 'HighFreq';

  @override
  String get strategyDetailTitle => 'Strategy Detail';

  @override
  String get strategyDetailFavoriteTooltip => 'Favorite';

  @override
  String get strategyDetailCloseTooltip => 'Close';

  @override
  String get strategyDetailReturn7d => '7d Return';

  @override
  String get strategyDetailReturn30d => '30d Return';

  @override
  String get strategyDetailReturnAll => 'Total Return';

  @override
  String get strategyDetailMaxDrawdown => 'Max Drawdown';

  @override
  String get strategyDetailSharpe => 'Sharpe';

  @override
  String get strategyDetailWinRate => 'Win Rate';

  @override
  String get strategyDetailEquityCurve => 'Equity Curve';

  @override
  String get strategyDetailCurvePlaceholder =>
      'Chart placeholder (K-line visualization after integration)';

  @override
  String get strategyDetailRecentSignals => 'Recent Signals';

  @override
  String get strategyDetailSignalsEmpty => 'No signals';

  @override
  String get strategyDetailSignalsLoadError => 'Failed to load signals';

  @override
  String get strategyDetailSubscribe => 'Subscribe';

  @override
  String get strategyDetailSubscribed => 'Subscribed · Tap to cancel';

  @override
  String get strategyDetailSubscribersSuffix => ' subscribers';

  @override
  String get strategyDetailProfitLossRatio => 'Profit/Loss Ratio';

  @override
  String get strategyDetailTradeCount => 'Trades';

  @override
  String get strategyDetailUsers => 'Users';

  @override
  String get strategyDetailDescriptionTitle => 'Strategy Notes';

  @override
  String strategyDetailDescriptionBody(String desc, String tag) {
    return '${desc}Based on the $tag framework, validated via historical backtesting. Get familiar with the risk parameters before committing funds.';
  }

  @override
  String strategyDetailCumulativeReturn(String period) {
    return '$period cumulative return';
  }

  @override
  String get strategyDetailRunButton => 'Run';

  @override
  String get strategyCardLoadConversation => 'Load chat';

  @override
  String get strategyCardRun => 'Run';

  @override
  String get strategyDetailLoadConversation => 'Load into chat';

  @override
  String strategyHomeLoadedToast(String name) {
    return '\"$name\" loaded into chat';
  }

  @override
  String strategyHomeStartedToast(String name) {
    return '\"$name\" started · opening live monitor';
  }

  @override
  String get strategyHomeFeaturedBadge => 'Pick of the week';

  @override
  String get strategyHomeFeaturedSubtitle => 'Market neutral · low drawdown';

  @override
  String get strategyHomeFeaturedView => 'View details';

  @override
  String get strategyHomeStatCagr => 'CAGR';

  @override
  String get strategyHomeStatSharpe => 'Sharpe';

  @override
  String get strategyHomeStatDrawdown => 'Drawdown';

  @override
  String get strategyHomeSortHot => 'Hot';

  @override
  String get strategyHomeSortReturn => 'Return';

  @override
  String get strategyHomeSortSharpe => 'Sharpe';

  @override
  String get strategyHomeSortLowDrawdown => 'Low DD';

  @override
  String get strategyHomeSortLabel => 'Sort';

  @override
  String strategyHomeResultCount(int count) {
    return '$count items';
  }

  @override
  String get strategyHomeFilterButton => 'Filter & sort';

  @override
  String get strategyHomeSheetCategory => 'Category';

  @override
  String get strategyHomeSheetSort => 'Sort by';

  @override
  String strategyHomeSortByOption(String label) {
    return 'Sort by $label';
  }

  @override
  String strategyHomeSheetApply(int count) {
    return 'View $count results';
  }

  @override
  String get strategyBadgeHot => '🔥 Hot';

  @override
  String get strategyBadgeNew => 'NEW';

  @override
  String get strategyBadgeOfficial => 'Official';

  @override
  String get strategyBadgePro => 'PRO';

  @override
  String get strategyCardStatSharpe => 'Sharpe';

  @override
  String get strategyCardStatDrawdown => 'Drawdown';

  @override
  String get strategyCardStatWinRate => 'Win rate';

  @override
  String get strategyCardStatUsers => 'Users';

  @override
  String get strategyDetailEquityTab7d => '7D';

  @override
  String get strategyDetailEquityTab30d => '30D';

  @override
  String get strategyDetailEquityTab90d => '90D';

  @override
  String get strategyDetailEquityTab1y => '1Y';

  @override
  String get strategyDetailParamsTitle => 'Parameters';

  @override
  String get strategyDetailParamType => 'Type';

  @override
  String get strategyDetailParamSymbol => 'Symbol';

  @override
  String get strategyDetailParamPeriod => 'Period';

  @override
  String get strategyDetailParamStopLoss => 'Stop loss';

  @override
  String get strategyDetailParamPosition => 'Position';

  @override
  String get strategyDetailParamLeverage => 'Leverage';

  @override
  String get strategyDetailShareButton => 'Share';

  @override
  String get strategyDetailShareToast => 'Strategy link copied to clipboard';

  @override
  String aiLoadStrategyUserMessage(String name, String category, String tags) {
    return 'Please regenerate based on strategy \"$name\" ($category), keeping the same tags: $tags.';
  }

  @override
  String aiLoadStrategyReply(String name) {
    return 'Sure — here is a draft based on strategy \"$name\". Suggested params:';
  }

  @override
  String get aiLoadStrategyGuestHint => 'Please log in to load strategy chat';

  @override
  String get strategySignalBuy => 'Buy';

  @override
  String get strategySignalSell => 'Sell';

  @override
  String get whaleFilterAll => 'All amounts';

  @override
  String get whaleThresholdLabel => 'Min:';

  @override
  String get whaleLoadError => 'Load failed';

  @override
  String get whaleDiscoverSubtitle => 'Discover the most valuable traders';

  @override
  String get whaleSortLabel => 'Sort';

  @override
  String get whaleSortByLabel => 'Sort by:';

  @override
  String get whaleSortWinRate => 'Win rate';

  @override
  String get whaleSortAum => 'Account value';

  @override
  String get whaleSortPnl => 'Realized PnL';

  @override
  String get whaleLeaderPnlLabel => 'Realized PnL (1M)';

  @override
  String get whaleLeaderPositionsLabel => 'Current positions';

  @override
  String get whaleLeaderWinRateLabel => 'Win rate (1M)';

  @override
  String get whaleLeaderAiTagsLabel => 'AI tags';

  @override
  String get whaleLeaderTagsEmpty => 'None';

  @override
  String get whaleLeaderCopyTooltip => 'Copy address';

  @override
  String get whaleLeaderCopied => 'Address copied';

  @override
  String get whaleLeaderTrendTooltip => 'Trade stats';

  @override
  String get whaleHoldingsBadge => 'Whale';

  @override
  String get whaleFeedEmpty => 'No whale events matching criteria';

  @override
  String get whaleTimeJustNow => 'Just now';

  @override
  String get whaleTimeMinutesAgoSuffix => ' min ago';

  @override
  String get whaleTimeHoursAgoSuffix => ' hours ago';

  @override
  String get whaleTimeDaysAgoSuffix => ' days ago';

  @override
  String get whaleTabDiscover => 'Discover';

  @override
  String get whaleTabLive => 'Live';

  @override
  String get whaleTabHoldings => 'Holdings';

  @override
  String get whaleTabWatch => 'Watch';

  @override
  String get whaleLiveLabel => 'LIVE';

  @override
  String get whaleGroupNow => 'Last 5 min';

  @override
  String get whaleGroup15m => 'Within 15 min';

  @override
  String get whaleGroup1h => 'Past 1 hour';

  @override
  String get whaleRowLong => 'Long';

  @override
  String get whaleRowShort => 'Short';

  @override
  String get whaleRowPositionValue => 'Position value';

  @override
  String get whaleRowQuantity => 'Quantity';

  @override
  String get whaleRowOpenPrice => 'Entry price';

  @override
  String get whaleRowWinRate => 'Win rate';

  @override
  String get whaleAddWatchAddress => 'Add watch address';

  @override
  String get whaleSectionSmartMoney => 'Smart Money';

  @override
  String get whaleSectionSmartMoneySub => 'Top 5 PnL 7D · on-chain + exchanges';

  @override
  String get whaleSectionViewAll => 'View all ›';

  @override
  String get whaleSectionTrending => 'Trending assets';

  @override
  String get whaleSectionTrendingSub => 'Whale 7D net accumulation';

  @override
  String get whaleSectionEmergingWhales => 'Emerging whales';

  @override
  String get whaleSectionEmergingWhalesTitle => '6 new whales in past 24H';

  @override
  String get whaleSectionEmergingWhalesSub =>
      'Net +1,840 BTC · avg position \$42M';

  @override
  String get whaleSectionExchangeFlow => 'Exchange BTC balance';

  @override
  String get whaleSectionExchangeFlowSub =>
      '24H net change · negative = outflow';

  @override
  String get whaleSectionTopHolders => 'Top holders';

  @override
  String get whaleSectionTopHoldersSub => 'Public labels · 7D change';

  @override
  String get whaleSectionMyWatch => 'My watchlist';

  @override
  String get whaleSectionMyWatchCountSuffix => ' addresses';

  @override
  String get whaleSectionRecentAlerts => 'Recent alerts';

  @override
  String get whaleSectionRecentAlertsAction => 'Rules ›';

  @override
  String get whaleWatchPnl7d => '7D PnL';

  @override
  String get whaleHoldingsLabel24h => '24H';

  @override
  String get whaleHoldingsSectionTitle => 'Whale Holdings';

  @override
  String get whaleHoldingsEmpty => 'No matching holdings';

  @override
  String get whaleHoldingsCoinAll => 'All';

  @override
  String get whaleHoldingsFilterDir => 'Direction';

  @override
  String get whaleHoldingsFilterPnl => 'PnL';

  @override
  String get whaleHoldingsDirLong => 'Long';

  @override
  String get whaleHoldingsDirShort => 'Short';

  @override
  String get whaleHoldingsPnlProfit => 'Profit';

  @override
  String get whaleHoldingsPnlLoss => 'Loss';

  @override
  String get whaleHoldingsSortValue => 'Value';

  @override
  String get whaleHoldingsSortMargin => 'Margin';

  @override
  String get whaleHoldingsSortTime => 'Opened';

  @override
  String get whaleHoldingsDirAll => 'All directions';

  @override
  String get whaleHoldingsPnlAll => 'All unrealized PnL';

  @override
  String get whaleHoldingsFilterDirTitle => 'Direction';

  @override
  String get whaleHoldingsFilterPnlTitle => 'Unrealized PnL';

  @override
  String get whaleHoldingsMoreSort => 'More sort';

  @override
  String get whaleHoldingsSortSectionMetric => 'Metric';

  @override
  String get whaleHoldingsSortSectionDir => 'Order';

  @override
  String get whaleHoldingsSortDirAsc => 'Ascending';

  @override
  String get whaleHoldingsSortDirDesc => 'Descending';

  @override
  String get whaleHoldingsSortDirNone => 'None';

  @override
  String get whaleHoldingsSortDone => 'Done';

  @override
  String get whaleHoldingsCoinSearchTooltip => 'Search coins';

  @override
  String get whaleHoldingsCoinSearchHint => 'Search coins';

  @override
  String get whaleHoldingsCoinSearchEmpty => 'No matching coins';

  @override
  String get whaleHoldingsColValue => 'Position Value';

  @override
  String get whaleHoldingsColPnl => 'Unrealized PnL';

  @override
  String get whaleHoldingsColMargin => 'Margin';

  @override
  String get whaleHoldingsColOpen => 'Entry Price';

  @override
  String get whaleHoldingsColLiq => 'Liq. Price';

  @override
  String get whaleSmartMoneyHoldingsPrefix => 'Holdings · ';

  @override
  String get whaleWinRatePrefix => 'Win rate ';

  @override
  String get whaleTrendingParticipantsSuffix => ' whales';

  @override
  String get whaleProfileTitle => 'Address detail';

  @override
  String get whaleProfileTabOverview => 'Overview';

  @override
  String get whaleProfileTabStats => 'Trade stats';

  @override
  String get whaleProfileCopyTooltip => 'Copy address';

  @override
  String get whaleProfileShareTooltip => 'Share';

  @override
  String get whaleProfileCopied => 'Address copied';

  @override
  String get whaleProfileWatch => 'Watch';

  @override
  String get whaleProfileRefreshTooltip => 'Refresh';

  @override
  String get whaleProfileAssetSummaryPrefix => 'Holdings · ';

  @override
  String get whaleProfileHoldingsValueLabel => 'Total holdings value';

  @override
  String get whaleProfileSectionHoldings => 'Holdings';

  @override
  String get whaleProfileSectionRecentActions => 'Recent actions';

  @override
  String get whaleProfileRecentActionsEmpty => 'No recent actions';

  @override
  String get whaleProfileStatPnl => 'Total PnL';

  @override
  String get whaleProfileStatWinRate => 'Win rate';

  @override
  String whaleProfileWinRateValue(int pct) {
    return '$pct%';
  }

  @override
  String get whaleProfileStatRealized => 'Realized';

  @override
  String get whaleProfileStatUnrealized => 'Unrealized';

  @override
  String get whaleProfileDirectionBias => 'Direction bias';

  @override
  String get whaleProfileLong => 'Long';

  @override
  String get whaleProfileShort => 'Short';

  @override
  String get whaleProfileSectionAssetPerf => 'Asset performance';

  @override
  String get whaleProfileLoadError => 'Failed to load address detail';

  @override
  String get whaleProfileTabBasic => 'Basic info';

  @override
  String get whaleProfileTabSpot => 'Spot';

  @override
  String get whaleProfileTabPerp => 'Perpetuals';

  @override
  String get whaleProfileTabOrders => 'Open orders';

  @override
  String get whaleProfileTabTrades => 'Recent trades';

  @override
  String get whaleProfileTabHistory => 'Order history';

  @override
  String get whaleProfileColShare => 'Share';

  @override
  String get whaleProfileColQty => 'Qty';

  @override
  String get whaleProfileColPrice => 'Price';

  @override
  String get whaleProfileColValue => 'Value';

  @override
  String get whaleProfileColChain => 'Chain';

  @override
  String get whaleProfileColPosValue => 'Position value';

  @override
  String get whaleProfileColUnrealized => 'Unrealized PnL';

  @override
  String get whaleProfileColEntry => 'Entry';

  @override
  String get whaleProfileColMark => 'Mark';

  @override
  String get whaleProfileColLiq => 'Liq. price';

  @override
  String get whaleProfileColMargin => 'Margin';

  @override
  String get whaleProfileColFunding => 'Funding';

  @override
  String get whaleProfileColTpSl => 'TP/SL';

  @override
  String get whaleProfileCross => 'Cross';

  @override
  String get whaleProfileColTime => 'Time';

  @override
  String get whaleProfileColTrigger => 'Trigger';

  @override
  String get whaleProfileColStatus => 'Status';

  @override
  String get whaleProfileColOrderId => 'Order ID';

  @override
  String get whaleProfileColType => 'Type';

  @override
  String get whaleProfileColStart => 'Start position';

  @override
  String get whaleProfileColClosedPnl => 'Closed PnL';

  @override
  String get whaleProfileColFee => 'Fee';

  @override
  String get whaleProfileColExecStatus => 'Exec status';

  @override
  String get whaleProfileStatAccountValue => 'Account value';

  @override
  String get whaleProfileStatAvailMargin => 'Available margin';

  @override
  String get whaleProfileStatWithdrawable => 'Withdrawable';

  @override
  String get whaleProfileStatPositionValue => 'Position value';

  @override
  String get whaleProfileStatLeverage => 'Leverage';

  @override
  String get whaleProfileLegendPerp => 'Perpetuals';

  @override
  String get whaleProfileLegendSpot => 'Spot';

  @override
  String get whaleProfilePerpTotalValue => 'Perp total value';

  @override
  String get whaleProfileMarginUsage => 'Avg margin usage';

  @override
  String get whaleProfileDirectionBias2 => 'Directional bias';

  @override
  String get whaleProfileBiasNeutral => 'Neutral';

  @override
  String get whaleProfileLongPosition => 'Long';

  @override
  String get whaleProfileShortPosition => 'Short';

  @override
  String get whaleProfilePositionDist => 'Position distribution';

  @override
  String get whaleProfileLongValue => 'Long value';

  @override
  String get whaleProfileShortValue => 'Short value';

  @override
  String get whaleProfileCurrentPosition => 'Current position';

  @override
  String get whaleProfileRoi => 'ROI';

  @override
  String get whaleProfilePerfTitle => 'Performance';

  @override
  String get whaleProfileTradeCount => 'Trade count';

  @override
  String get whaleProfileMaxDrawdown => 'Max drawdown';

  @override
  String get whaleProfileFilledOrders => 'Filled orders';

  @override
  String get whaleProfileClosedCount => 'Closed count';

  @override
  String get whaleProfilePeriodDay => '1D';

  @override
  String get whaleProfilePeriodWeek => '1W';

  @override
  String get whaleProfilePeriodMonth => '1M';

  @override
  String get whaleProfilePeriodAll => 'All';

  @override
  String get whaleProfileScopePerpOnly => 'Perps only';

  @override
  String get whaleProfileScopePerpSpot => 'Perps and spot';

  @override
  String get whaleProfileMetricTotalPnl => 'Total PnL';

  @override
  String get whaleProfileMetricAccountValue => 'Account value';

  @override
  String get whaleProfilePillPeriodTitle => 'Time range';

  @override
  String get whaleProfilePillScopeTitle => 'Scope';

  @override
  String get whaleProfilePillMetricTitle => 'Metric';

  @override
  String get whaleProfilePillCancel => 'Cancel';

  @override
  String get whaleProfileEmptySpot => 'No spot holdings';

  @override
  String get whaleProfileEmptyPerp => 'No perpetual positions';

  @override
  String get whaleProfileEmptyOrders => 'No open orders';

  @override
  String get whaleProfileEmptyTrades => 'No recent trades';

  @override
  String get whaleProfileEmptyHistory => 'No order history';

  @override
  String get whaleProfileFilterCoin => 'Filter coin';

  @override
  String get whaleProfileFilterLabel => 'Filter';

  @override
  String get whaleProfileFilterAll => 'All';

  @override
  String get whaleProfileFilterTitle => 'Filter coin';

  @override
  String get whaleProfileMoreSort => 'More sort';

  @override
  String get whaleProfileSortMetric => 'Metric';

  @override
  String get whaleProfileSortDirection => 'Sort order';

  @override
  String get whaleProfileSortAsc => 'Ascending';

  @override
  String get whaleProfileSortDesc => 'Descending';

  @override
  String get whaleProfileSortNone => 'None';

  @override
  String get whaleProfileSortDone => 'Done';

  @override
  String get whaleProfileSortValue => 'Value';

  @override
  String get whaleProfileSortAmount => 'Amount';

  @override
  String whaleProfilePnlChartTitle(String period, String scope) {
    return '$period total PnL ($scope)';
  }

  @override
  String get whaleTradeStatsTitle => 'Trade stats';

  @override
  String get whaleTradeStatsClosedPnl => 'Closed PnL';

  @override
  String get whaleTradeStatsFeeAdjusted => 'After fees';

  @override
  String get whaleTradeStatsTradeCount => 'Trade count';

  @override
  String get whaleTradeStatsWins => 'Wins';

  @override
  String get whaleTradeStatsLosses => 'Losses';

  @override
  String get whaleTradeStatsPerfTitle => 'PnL performance';

  @override
  String get whaleTradeStatsByAsset => 'By asset';

  @override
  String get whaleTradeStatsByPosition => 'By position';

  @override
  String get whaleTradeStatsNetPnl => 'Net PnL';

  @override
  String get whaleTradeStatsSize => 'Size';

  @override
  String get whaleTradeStatsFee => 'Fee';

  @override
  String get whaleTradeStatsEmpty => 'No trades yet';

  @override
  String whaleTradeStatsTradeUnit(int count) {
    return '$count trades';
  }

  @override
  String get whaleTradeStatsPeriodDay => '1D';

  @override
  String get whaleTradeStatsPeriodWeek => '1W';

  @override
  String get whaleTradeStatsPeriodMonth => '1M';

  @override
  String get whaleTradeStatsPeriodAll => 'All';

  @override
  String get whaleNotificationTitle => 'Notifications';

  @override
  String get whaleNotificationTabAll => 'All';

  @override
  String get whaleNotificationTabAlert => 'Whale alerts';

  @override
  String get whaleNotificationTabWatch => 'Watch hits';

  @override
  String get whaleNotificationTabSystem => 'System';

  @override
  String get whaleNotificationMarkAllRead => 'Mark all read';

  @override
  String get whaleNotificationEmpty => 'No notifications';

  @override
  String get whaleNotificationTooltip => 'Notifications';

  @override
  String get whaleNotificationCloseTooltip => 'Close';

  @override
  String whaleNotificationUnreadBadge(int count) {
    return '$count unread';
  }

  @override
  String get whaleNotificationSubtitle => 'Whale alerts · Watch hits · Flows';

  @override
  String get whaleNotificationFooterHint => 'Showing last 24h only';

  @override
  String get whaleNotificationSettings => 'Notification settings';

  @override
  String get whaleNotifKindAlert => 'Whale alert';

  @override
  String get whaleNotifKindWatch => 'Watch hit';

  @override
  String get whaleNotifKindFlow => 'Flow';

  @override
  String get whaleNotifKindSystem => 'System';

  @override
  String get whaleWatchSubTabLive => 'Live Whales';

  @override
  String get whaleWatchSubTabAddresses => 'Watched';

  @override
  String get whaleWatchSubTabNotifications => 'Notifications';

  @override
  String get whaleWatchCreateMonitor => 'New Monitor';

  @override
  String get whaleWatchAddressesEmpty => 'No watched addresses';

  @override
  String whaleWatchMarkAllReadCount(int count) {
    return 'Mark all read ($count)';
  }

  @override
  String get whaleWatchPerpValue => 'Perp value';

  @override
  String get whaleWatchUnrealizedPnl => 'Unrealized PnL';

  @override
  String get whaleWatchAvailMargin => 'Avail. margin';

  @override
  String get whaleWatchMarginUsage => 'Margin usage';

  @override
  String get whaleWatchPositions => 'Positions';

  @override
  String get whaleRuleAliasLabel => 'Alias';

  @override
  String get whaleRuleAliasHint => 'Optional';

  @override
  String get whaleRuleChannelTelegramUnbound =>
      'Bind Telegram first to enable Telegram push';

  @override
  String get whaleLiveCoinPush => 'Coin push';

  @override
  String get whaleLiveCoinPushDone => 'Coin push enabled';

  @override
  String get whaleLiveCreateMonitor => 'New Monitor';

  @override
  String get whaleLiveThresholdPrefix => '≥ \$';

  @override
  String get whaleLiveFeedEmpty => 'No matching alerts';

  @override
  String whaleLiveSecondsUntilUpdate(int seconds) {
    return 'Updates in ${seconds}s';
  }

  @override
  String get whaleLiveWinSort => 'Win rate';

  @override
  String get whaleLiveWinSortNone => 'Win rate: unsorted';

  @override
  String get whaleLiveWinSortDesc => 'Win rate: descending';

  @override
  String get whaleLiveWinSortAsc => 'Win rate: ascending';

  @override
  String get klineLoadError => 'K-line load failed';

  @override
  String get tabMarket => 'Data';

  @override
  String get tabWhale => 'Whale';

  @override
  String get tabStrategy => 'Strategy';

  @override
  String get tabMe => 'Me';

  @override
  String get liveStrategyEntryTitle => 'View Live Strategies';

  @override
  String get liveStrategyEntrySubtitle => 'Track status, positions and PnL';

  @override
  String get liveListTitle => 'Live Strategies';

  @override
  String get liveListTotalAssets => 'Total Assets (position + available)';

  @override
  String get liveListTodayPnl => 'Today PnL';

  @override
  String get liveListTotalPnl => 'Total PnL';

  @override
  String get liveListCapital => 'Capital';

  @override
  String get liveFilterAll => 'All';

  @override
  String get liveFilterRunning => 'Running';

  @override
  String get liveFilterPaused => 'Paused';

  @override
  String get liveFilterStopped => 'Stopped';

  @override
  String get liveStoppedRetentionHint =>
      'Stopped strategies are kept for 30 days; you can resume or export history anytime. After that they are permanently deleted.';

  @override
  String get liveEmptyTitle => 'No live strategies yet';

  @override
  String get liveEmptyHint =>
      'Once you generate and deploy a strategy from AI chat, it will appear here with live status and PnL.';

  @override
  String get liveCreateFromAi => 'Create from AI chat';

  @override
  String get liveSortComingSoon => 'Filter & sort coming soon';

  @override
  String get liveLoadError => 'Failed to load live strategies';

  @override
  String get liveStatusRunning => 'Running';

  @override
  String get liveStatusPaused => 'Paused';

  @override
  String get liveStatusWarning => 'Attention';

  @override
  String get liveStatusStopped => 'Stopped';

  @override
  String get liveDetailTitle => 'Strategy Detail';

  @override
  String get liveDetailTotalPnl => 'Total PnL';

  @override
  String get liveTabOverview => 'Overview';

  @override
  String get liveTabPositions => 'Positions';

  @override
  String get liveTabHistory => 'History';

  @override
  String get liveTabParams => 'Params';

  @override
  String get liveStatToday => 'Today PnL';

  @override
  String get liveStatTodayPct => 'Today %';

  @override
  String get liveStatTotalPct => 'Total %';

  @override
  String get liveStatCapital => 'Capital';

  @override
  String get liveStatTrades => 'Trades';

  @override
  String get liveStatWinRate => 'Win Rate';

  @override
  String get liveStatRunFor => 'Running Days';

  @override
  String get liveStatExchange => 'Exchange';

  @override
  String get liveStatTradesUnit => '';

  @override
  String get liveAiObservationLabel => 'AI Insight';

  @override
  String get liveAiObservationWarning =>
      'The last 3 trades hit stop-loss consecutively; today\'s loss is near the set limit. Consider pausing or adjusting the stop-loss in chat.';

  @override
  String get liveAiObservationPaused =>
      'Currently paused with position closed. It will wait for the next entry signal once resumed.';

  @override
  String get liveAiObservationRunning =>
      'Running steadily; the 7-day win rate is above the backtest average. Consider reducing size if volatility rises.';

  @override
  String get liveArchiveSectionTitle => 'Strategy Archive';

  @override
  String get liveArchiveScript => 'Strategy Script';

  @override
  String get liveArchiveScriptSub => 'Generated at deploy time';

  @override
  String get liveArchiveBacktest => 'Backtest Record';

  @override
  String get liveArchiveBacktestSub => 'Historical backtest before deploy';

  @override
  String get liveArchiveDeploy => 'Deploy Config';

  @override
  String get liveArchiveDeploySub => 'Capital / position / risk';

  @override
  String get liveArchiveComingSoon => 'Coming soon';

  @override
  String get livePositionEmptyTitle => 'Strategy paused';

  @override
  String get livePositionEmptyHint =>
      'Position closed; waiting for new signals after resume';

  @override
  String get livePositionEntry => 'Entry';

  @override
  String get livePositionCurrent => 'Current';

  @override
  String get livePositionStop => 'Stop';

  @override
  String get livePositionStopLabel => 'Stop-loss';

  @override
  String get livePositionStopDistance => 'To stop';

  @override
  String get livePositionHold => 'Held';

  @override
  String get livePositionSideLong => 'Long';

  @override
  String get livePositionSideShort => 'Short';

  @override
  String get liveParamsTuneInAi => 'Tune params in AI chat';

  @override
  String get liveActionStart => 'Start';

  @override
  String get liveActionPause => 'Pause';

  @override
  String get liveActionResume => 'Resume';

  @override
  String get liveActionDelete => 'Delete';

  @override
  String get liveActionDeletePermanent => 'Delete permanently';

  @override
  String get liveActionComingSoon => 'Strategy actions coming soon';

  @override
  String get liveActionCancel => 'Cancel';

  @override
  String get liveSortSheetTitle => 'Filter & Sort';

  @override
  String get liveSortStatusLabel => 'Status';

  @override
  String get liveSortMetricLabel => 'Sort by';

  @override
  String get liveSortDirectionLabel => 'Direction';

  @override
  String get liveSortMetricTodayPnl => 'Today P&L';

  @override
  String get liveSortMetricTotalPnl => 'Total P&L';

  @override
  String get liveSortMetricTotalPct => 'Return';

  @override
  String get liveSortMetricWinRate => 'Win rate';

  @override
  String get liveSortMetricCapital => 'Capital';

  @override
  String get liveSortMetricRunFor => 'Run days';

  @override
  String get liveSortDirAsc => 'Ascending';

  @override
  String get liveSortDirDesc => 'Descending';

  @override
  String get liveSortDirNone => 'None';

  @override
  String liveSortApply(int count) {
    return 'View $count strategies';
  }

  @override
  String get livePauseSheetTitle => 'Pause strategy';

  @override
  String livePauseSheetSubtitle(String name) {
    return '\"$name\" has 1 open position. Choose how to handle it before pausing.';
  }

  @override
  String get livePauseModeMarketLabel => 'Close at market, then pause';

  @override
  String get livePauseModeMarketTag => 'Recommended';

  @override
  String get livePauseModeMarketDesc =>
      'Close the position at market immediately, realize current P&L, then pause.';

  @override
  String livePauseModeMarketEffect(String pnl) {
    return 'Estimated realized P&L $pnl';
  }

  @override
  String get livePauseModeNaturalLabel => 'Wait for stop-loss/take-profit';

  @override
  String get livePauseModeNaturalDesc =>
      'Keep running until stop-loss or take-profit triggers, then pause automatically.';

  @override
  String livePauseModeNaturalEffect(String stop, String tp) {
    return 'To stop $stop   To target $tp';
  }

  @override
  String get livePauseModeKeepLabel => 'Keep position, pause strategy only';

  @override
  String get livePauseModeKeepDesc =>
      'The strategy stops monitoring; you manage the position manually on the exchange and can hand it back after resuming.';

  @override
  String get livePauseModeKeepEffect =>
      '⚠ While paused, automatic stop-loss / take-profit / sizing will not apply';

  @override
  String get livePauseResumeNote =>
      'Pausing keeps all params and history; resume anytime from \"Paused\".';

  @override
  String get livePausePrimaryMarket => 'Close & pause';

  @override
  String get livePausePrimaryNatural => 'Keep running · wait to close';

  @override
  String get livePausePrimaryKeep => 'Pause · keep position';

  @override
  String get livePausePositionHolding => '1 position';

  @override
  String get livePausePositionEntry => 'Entry';

  @override
  String get livePausePositionCurrent => 'Current';

  @override
  String get livePausePositionFloatingPnl => 'Unrealized P&L';

  @override
  String get liveDeleteSheetTitleSoft => 'Delete strategy?';

  @override
  String get liveDeleteSheetTitlePermanent => 'Delete permanently?';

  @override
  String liveDeleteBodySoft(String name) {
    return '\"$name\" will stop immediately; history is kept for 30 days and viewable under \"Stopped\".';
  }

  @override
  String liveDeleteBodyPermanentRunning(String name) {
    return '\"$name\" will stop immediately and its history will not be kept. This cannot be undone.';
  }

  @override
  String liveDeleteBodyStopped(String name) {
    return 'The history of \"$name\" will be permanently deleted immediately. This cannot be undone.';
  }

  @override
  String get liveDeleteToggleExpand => 'Don\'t keep history?';

  @override
  String get liveDeleteToggleCollapse => 'Collapse';

  @override
  String get liveDeleteDangerNote =>
      'Delete permanently now · no 30-day history will be kept. Usually only for compliance or privacy needs.';

  @override
  String get liveDeleteDangerCheckbox =>
      'Also permanently delete strategy history now (irreversible)';

  @override
  String get liveDeletePrimarySoft => 'Delete strategy';

  @override
  String get liveDeletePrimaryPermanent => 'Delete permanently';

  @override
  String get liveNeedPauseTitle => 'Pause the strategy first';

  @override
  String liveNeedPauseBody(String name) {
    return '\"$name\" is still running. To avoid deleting positions and in-flight trades by mistake, pause it before deleting.';
  }

  @override
  String get liveNeedPausePrimary => 'Pause strategy';

  @override
  String liveCardRunFor(String runFor) {
    return 'Running $runFor';
  }

  @override
  String liveCardTrades(int trades) {
    return '$trades trades';
  }

  @override
  String liveCardWinRate(String winRate) {
    return 'Win $winRate%';
  }

  @override
  String get liveCardMenuTooltip => 'More';

  @override
  String get deployViewLiveStrategies => 'View live strategies';

  @override
  String get whaleSearchHint => 'Address / label / asset / exchange';

  @override
  String get whaleSearchPrompt =>
      'Search addresses, labels, assets, exchanges or event types';

  @override
  String get whaleSearchEmpty => 'No matching results';

  @override
  String get whaleSearchKindAddress => 'Addresses';

  @override
  String get whaleSearchKindLabel => 'Labels';

  @override
  String get whaleSearchKindAsset => 'Assets';

  @override
  String get whaleSearchKindExchange => 'Exchanges';

  @override
  String get whaleSearchKindEventType => 'Event types';

  @override
  String get whaleWatchEmpty => 'No watched addresses yet, add one below';

  @override
  String get whaleRuleAddTitle => 'Add watch address';

  @override
  String get whaleRuleEditTitle => 'Edit watch rule';

  @override
  String get whaleRuleAddressLabel => 'Watch address';

  @override
  String get whaleRuleAddressHint => '0x… address or short form';

  @override
  String get whaleRuleAddressRequired => 'Enter a watch address';

  @override
  String get whaleRuleAddressInvalid => 'Invalid address format';

  @override
  String get whaleRuleThresholdLabel => 'Trigger threshold (USD)';

  @override
  String get whaleRuleThresholdHint => 'e.g. 1000000';

  @override
  String get whaleRuleThresholdRequired => 'Enter a trigger threshold';

  @override
  String get whaleRuleThresholdInvalid =>
      'Threshold must be a number greater than 0';

  @override
  String get whaleRuleChannelLabel => 'Channels';

  @override
  String get whaleRuleChannelPush => 'Web';

  @override
  String get whaleRuleChannelTelegram => 'Telegram';

  @override
  String get whaleRuleChannelEmail => 'Email';

  @override
  String get whaleRuleChannelRequired => 'Select at least one channel';

  @override
  String get whaleRuleCreate => 'Create';

  @override
  String get whaleRuleSave => 'Save';

  @override
  String get whaleRuleMenuTooltip => 'Rule actions';

  @override
  String get whaleRuleMenuEdit => 'Edit';

  @override
  String get whaleRuleMenuMute => 'Mute';

  @override
  String get whaleRuleMenuUnmute => 'Unmute';

  @override
  String get whaleRuleMenuDelete => 'Delete';

  @override
  String get whaleRuleDeleteTitle => 'Delete watch';

  @override
  String whaleRuleDeleteBody(String name) {
    return 'Delete the watch on \"$name\"?';
  }

  @override
  String get whaleRuleDeleteConfirm => 'Delete';

  @override
  String get aiScriptTitle => 'Strategy Script';

  @override
  String get aiScriptSubtitle =>
      'Generate executable script, push to backtest engine';

  @override
  String get aiScriptStatusPending => 'Pending';

  @override
  String get aiScriptStatusReady => 'Generated';

  @override
  String get aiScriptGeneratingTitle => 'Generating strategy script';

  @override
  String get aiScriptGeneratingSteps =>
      'Compile params · Validate syntax · Inject risk control';

  @override
  String get aiScriptReadyBadge => '✓ READY';

  @override
  String get aiScriptCopy => 'Copy script';

  @override
  String get aiScriptCopied => 'Copied';

  @override
  String get aiScriptCopiedToast => 'Script copied';

  @override
  String aiScriptExpand(int count) {
    return 'Show all $count lines';
  }

  @override
  String get aiScriptCollapse => 'Collapse';

  @override
  String get aiScriptSuccessHint =>
      'Script generated and risk control injected. You can continue to backtest setup.';

  @override
  String get aiScriptPrev => 'Back';

  @override
  String get aiScriptNext => 'Next: Backtest Setup';
}
