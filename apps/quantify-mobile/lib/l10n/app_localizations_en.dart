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
  String get backtestFieldSymbol => 'Symbol';

  @override
  String get backtestFieldPeriod => 'Period';

  @override
  String get backtestFieldLeverage => 'Leverage';

  @override
  String get backtestFieldCapital => 'Initial Capital (USD)';

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
      'No exchange API configured yet. Add one in Me / API first.';

  @override
  String get deployGoConfigureButton => 'Configure API';

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
  String get authLoginWelcome => 'Welcome back to Quantify';

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
  String get marketHomeTitle => 'Market';

  @override
  String get marketHomeTabWatchlist => 'Watchlist';

  @override
  String get marketHomeLoadError => 'Market data load failed';

  @override
  String get marketHomeEmpty => 'No market data';

  @override
  String get marketLongShortTitle => 'Long/Short';

  @override
  String get marketLongShortLoadError => 'Long/short data load failed';

  @override
  String get marketLongShortHistory => 'History';

  @override
  String get marketDetailSymbolNotFound => 'Symbol not found';

  @override
  String get marketDetailTickerPrefix => 'Market Detail: ';

  @override
  String get marketDetailSectionOrderbook => 'Order Book';

  @override
  String get orderbookLoadError => 'Order book load failed';

  @override
  String get meHomeLoadErrorPrefix => 'Load failed: ';

  @override
  String get meStatsTotalEquity => 'Total Equity';

  @override
  String get meStatsAvailableBalance => 'Available Balance';

  @override
  String get meStatsUnrealizedPnl => 'Unrealized PnL';

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
  String get meSettingsApiManage => 'Manage Exchange Keys';

  @override
  String get meSettingsApiConfiguredSuffix => ' configured';

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
  String get meApiFormTestButton => 'Test Connection';

  @override
  String get meApiFormConnectionOk => 'Connection successful';

  @override
  String get meApiFormConnectionFailed => 'Connection failed';

  @override
  String get meApiFormDefaultLabel => 'Default';

  @override
  String get meApiFormSaveFailedPrefix => 'Save failed: ';

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
  String get themeSettingsDeviceOnly => 'This device only';

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
  String get strategyHomeTitle => 'Strategy';

  @override
  String get strategyHomeSearchHint => 'Search strategy / author / tag';

  @override
  String get strategyHomeEmpty => 'No matching strategies';

  @override
  String get strategyCategoryHighReturn => 'High Return';

  @override
  String get strategyCategoryLowDrawdown => 'Low Drawdown';

  @override
  String get strategyCategoryNewListing => 'New';

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
