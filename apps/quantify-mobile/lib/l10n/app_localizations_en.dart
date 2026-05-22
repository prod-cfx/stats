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
  String get backtestFillAvg => 'Average';

  @override
  String get backtestFieldPartialData => 'Allow partial data coverage';

  @override
  String get backtestShieldHint =>
      'Backtest results are for reference only and not investment advice. Strategy parameters stay tied to this chat — edit the conversation to change them.';

  @override
  String get backtestCollapseButton => 'Collapse';

  @override
  String get backtestStartButton => 'Confirm & Run';

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
  String get deployDoneToast => 'Strategy deployed';

  @override
  String get deployDoneCloseButton => 'Done';

  @override
  String get deploySystemMessagePrefix => 'Strategy deployed to ';

  @override
  String get deploySystemMessageInstanceInfix => ' · instance ID ';

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
  String get authLoginForgotPassword => 'Forgot?';

  @override
  String get authLoginGuestButton => 'Continue as guest';

  @override
  String get authLoginGuestHint => '· No signup';

  @override
  String get authLoginTermsPrefix => 'By continuing you agree to our ';

  @override
  String get authLoginTermsLink => 'Terms of Service';

  @override
  String get authLoginTermsAnd => ' and ';

  @override
  String get authLoginPrivacyLink => 'Privacy Policy';

  @override
  String get authLoginGuestFailedPrefix => 'Guest login failed: ';

  @override
  String get authLoginForgotMockToast => 'Reset password (mock)';

  @override
  String get marketHomeTitle => 'Market';

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
  String get marketHomeNotificationTooltip => 'Notifications';

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
  String get marketDetailSellButton => 'Sell / Short';

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
  String get marketDetailStarTooltip => 'Favorite';

  @override
  String get marketDetailMoreTooltip => 'More';

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
  String get meSettingsSecurity => 'Security';

  @override
  String get meSettingsNotConfigured => 'Not configured';

  @override
  String get meSettingsLanguage => 'Language';

  @override
  String get meSettingsLanguageValue => 'Simplified Chinese';

  @override
  String get meSettingsTheme => 'Theme';

  @override
  String get meSettingsThemeValue => 'System Default';

  @override
  String get meSettingsNotifications => 'Notifications';

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
  String get themeSettingsTitle => 'Interface Theme';

  @override
  String get themeSettingsSyncSubtitle => 'Syncs across Web and App';

  @override
  String get themeSettingsSyncFootnote =>
      'Theme syncs between Web and App via your account; it will apply automatically next time you sign in.';

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
  String get strategyCardLoadConversation => 'Load chat';

  @override
  String get strategyDetailLoadConversation => 'Load into chat';

  @override
  String strategyHomeLoadedToast(String name) {
    return '\"$name\" loaded into chat';
  }

  @override
  String get strategyHomeFeaturedBadge => 'Pick of the week';

  @override
  String get strategyHomeFeaturedSubtitle => 'Market neutral · low drawdown';

  @override
  String get strategyHomeFeaturedView => 'View →';

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
  String get strategyDetailReviewsTitle => 'User reviews';

  @override
  String get strategyDetailReviewsEmpty => 'No reviews yet';

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
  String get whaleFeedTitle => 'Whale Activity';

  @override
  String get whaleFilterAll => 'All amounts';

  @override
  String get whaleThresholdLabel => 'Min:';

  @override
  String get whaleLoadError => 'Load failed';

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
  String get whaleTopBarSubtitle => 'On-chain + Exchanges';

  @override
  String get whaleTabDiscover => 'Discover';

  @override
  String get whaleTabLive => 'Live';

  @override
  String get whaleTabHoldings => 'Holdings';

  @override
  String get whaleTabWatch => 'Watch';

  @override
  String whaleNetFlowLabel(String symbol) {
    return '$symbol net inflow · 1H';
  }

  @override
  String get whaleStatBigTrades => 'Big trades';

  @override
  String get whaleStatActiveWhales => 'Active whales';

  @override
  String get whaleStatNetAccumulation => 'Net acc.';

  @override
  String get whaleStatPast1h => 'Past 1H';

  @override
  String get whaleLiveLabel => 'LIVE';

  @override
  String get whaleGroupNow => 'Last 5 min';

  @override
  String get whaleGroup15m => 'Within 15 min';

  @override
  String get whaleGroup1h => 'Past 1 hour';

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
  String get whaleSmartMoneyHoldingsPrefix => 'Holdings · ';

  @override
  String get whaleWinRatePrefix => 'Win rate ';

  @override
  String get whaleTrendingParticipantsSuffix => ' whales';

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
  String get whaleSearchTooltip => 'Search';

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
  String get klineLoadError => 'K-line load failed';

  @override
  String get tabMarket => 'Market';

  @override
  String get tabWhale => 'Whale';

  @override
  String get tabStrategy => 'Strategy';

  @override
  String get tabMe => 'Me';
}
