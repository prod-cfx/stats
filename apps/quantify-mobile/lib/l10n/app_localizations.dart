import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_zh.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('zh'),
  ];

  /// 应用标题
  ///
  /// In zh, this message translates to:
  /// **'Quantify'**
  String get appTitle;

  /// No description provided for @commonCancel.
  ///
  /// In zh, this message translates to:
  /// **'取消'**
  String get commonCancel;

  /// No description provided for @commonAll.
  ///
  /// In zh, this message translates to:
  /// **'全部'**
  String get commonAll;

  /// No description provided for @commonOr.
  ///
  /// In zh, this message translates to:
  /// **'或'**
  String get commonOr;

  /// No description provided for @commonLoadError.
  ///
  /// In zh, this message translates to:
  /// **'加载失败'**
  String get commonLoadError;

  /// No description provided for @commonRetry.
  ///
  /// In zh, this message translates to:
  /// **'重试'**
  String get commonRetry;

  /// No description provided for @commonStart.
  ///
  /// In zh, this message translates to:
  /// **'开始'**
  String get commonStart;

  /// No description provided for @commonEnd.
  ///
  /// In zh, this message translates to:
  /// **'结束'**
  String get commonEnd;

  /// No description provided for @commonView.
  ///
  /// In zh, this message translates to:
  /// **'查看'**
  String get commonView;

  /// No description provided for @commonYes.
  ///
  /// In zh, this message translates to:
  /// **'是'**
  String get commonYes;

  /// No description provided for @commonNo.
  ///
  /// In zh, this message translates to:
  /// **'否'**
  String get commonNo;

  /// No description provided for @devPreviewPrimaryButton.
  ///
  /// In zh, this message translates to:
  /// **'主按钮'**
  String get devPreviewPrimaryButton;

  /// No description provided for @devPreviewSoftBubble.
  ///
  /// In zh, this message translates to:
  /// **'软气泡'**
  String get devPreviewSoftBubble;

  /// No description provided for @aiEmptyHint.
  ///
  /// In zh, this message translates to:
  /// **'描述你想要的策略，我会帮你生成并回测。'**
  String get aiEmptyHint;

  /// No description provided for @aiInputHint.
  ///
  /// In zh, this message translates to:
  /// **'输入消息…'**
  String get aiInputHint;

  /// No description provided for @aiBacktestButton.
  ///
  /// In zh, this message translates to:
  /// **'回测'**
  String get aiBacktestButton;

  /// No description provided for @aiSendButton.
  ///
  /// In zh, this message translates to:
  /// **'发送'**
  String get aiSendButton;

  /// No description provided for @aiAppBarHistoryTooltip.
  ///
  /// In zh, this message translates to:
  /// **'历史会话'**
  String get aiAppBarHistoryTooltip;

  /// No description provided for @aiAppBarNewSessionTooltip.
  ///
  /// In zh, this message translates to:
  /// **'新建会话'**
  String get aiAppBarNewSessionTooltip;

  /// No description provided for @aiAppBarParamsTooltip.
  ///
  /// In zh, this message translates to:
  /// **'参数'**
  String get aiAppBarParamsTooltip;

  /// No description provided for @aiAppBarParamsButton.
  ///
  /// In zh, this message translates to:
  /// **'参数'**
  String get aiAppBarParamsButton;

  /// No description provided for @aiSessionDrawerTitle.
  ///
  /// In zh, this message translates to:
  /// **'策略方案'**
  String get aiSessionDrawerTitle;

  /// No description provided for @aiSessionDrawerSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'每个方案独立上下文 · 互不污染'**
  String get aiSessionDrawerSubtitle;

  /// No description provided for @aiSessionNewButton.
  ///
  /// In zh, this message translates to:
  /// **'新建方案'**
  String get aiSessionNewButton;

  /// No description provided for @aiSessionEmptyHint.
  ///
  /// In zh, this message translates to:
  /// **'暂无会话，点击「新建方案」开始一个策略对话。'**
  String get aiSessionEmptyHint;

  /// No description provided for @aiSessionStatusLive.
  ///
  /// In zh, this message translates to:
  /// **'实盘'**
  String get aiSessionStatusLive;

  /// No description provided for @aiSessionStatusPending.
  ///
  /// In zh, this message translates to:
  /// **'待部署'**
  String get aiSessionStatusPending;

  /// No description provided for @aiSessionPrivacyFooter.
  ///
  /// In zh, this message translates to:
  /// **'方案之间上下文隔离 · 不会互相干扰'**
  String get aiSessionPrivacyFooter;

  /// No description provided for @aiSessionUntitled.
  ///
  /// In zh, this message translates to:
  /// **'新方案'**
  String get aiSessionUntitled;

  /// No description provided for @aiQuickReply1.
  ///
  /// In zh, this message translates to:
  /// **'再跑一次回测'**
  String get aiQuickReply1;

  /// No description provided for @aiQuickReply2.
  ///
  /// In zh, this message translates to:
  /// **'把止损改成 1.5%'**
  String get aiQuickReply2;

  /// No description provided for @aiQuickReply3.
  ///
  /// In zh, this message translates to:
  /// **'换成 ETH 看看'**
  String get aiQuickReply3;

  /// No description provided for @aiQuickReply4.
  ///
  /// In zh, this message translates to:
  /// **'部署到 Binance'**
  String get aiQuickReply4;

  /// No description provided for @backtestSheetTitle.
  ///
  /// In zh, this message translates to:
  /// **'回测参数'**
  String get backtestSheetTitle;

  /// No description provided for @backtestSheetSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'策略参数请通过对话调整'**
  String get backtestSheetSubtitle;

  /// No description provided for @backtestFieldCapital.
  ///
  /// In zh, this message translates to:
  /// **'初始资金'**
  String get backtestFieldCapital;

  /// No description provided for @backtestFieldRange.
  ///
  /// In zh, this message translates to:
  /// **'历史回测区间'**
  String get backtestFieldRange;

  /// No description provided for @backtestRangeCustom.
  ///
  /// In zh, this message translates to:
  /// **'自定义'**
  String get backtestRangeCustom;

  /// No description provided for @backtestFieldSlippage.
  ///
  /// In zh, this message translates to:
  /// **'滑点'**
  String get backtestFieldSlippage;

  /// No description provided for @backtestFieldFee.
  ///
  /// In zh, this message translates to:
  /// **'手续费'**
  String get backtestFieldFee;

  /// No description provided for @backtestFieldFillSource.
  ///
  /// In zh, this message translates to:
  /// **'成交价来源'**
  String get backtestFieldFillSource;

  /// No description provided for @backtestFillOpen.
  ///
  /// In zh, this message translates to:
  /// **'开盘价'**
  String get backtestFillOpen;

  /// No description provided for @backtestFillClose.
  ///
  /// In zh, this message translates to:
  /// **'收盘价'**
  String get backtestFillClose;

  /// No description provided for @backtestFillMid.
  ///
  /// In zh, this message translates to:
  /// **'中间价'**
  String get backtestFillMid;

  /// No description provided for @backtestFieldPartialData.
  ///
  /// In zh, this message translates to:
  /// **'允许部分覆盖数据继续回测'**
  String get backtestFieldPartialData;

  /// No description provided for @backtestShieldHint.
  ///
  /// In zh, this message translates to:
  /// **'回测结果仅供参考，不构成投资建议；AI 会保留当前对话的策略参数，想换参数请回到对话修改。'**
  String get backtestShieldHint;

  /// No description provided for @backtestCollapseButton.
  ///
  /// In zh, this message translates to:
  /// **'上一步'**
  String get backtestCollapseButton;

  /// No description provided for @backtestStartButton.
  ///
  /// In zh, this message translates to:
  /// **'开始回测'**
  String get backtestStartButton;

  /// No description provided for @backtestErrorInvalidDate.
  ///
  /// In zh, this message translates to:
  /// **'请输入正确的起止时间（YYYY-MM-DD）'**
  String get backtestErrorInvalidDate;

  /// No description provided for @backtestErrorEndBeforeStart.
  ///
  /// In zh, this message translates to:
  /// **'结束时间必须晚于开始时间'**
  String get backtestErrorEndBeforeStart;

  /// No description provided for @backtestErrorInvalidCapital.
  ///
  /// In zh, this message translates to:
  /// **'请输入正数初始资金'**
  String get backtestErrorInvalidCapital;

  /// No description provided for @backtestErrorInvalidSlippage.
  ///
  /// In zh, this message translates to:
  /// **'请输入非负滑点（bps）'**
  String get backtestErrorInvalidSlippage;

  /// No description provided for @backtestErrorInvalidFee.
  ///
  /// In zh, this message translates to:
  /// **'请输入非负手续费（bps）'**
  String get backtestErrorInvalidFee;

  /// No description provided for @backtestErrorFailedPrefix.
  ///
  /// In zh, this message translates to:
  /// **'回测失败：'**
  String get backtestErrorFailedPrefix;

  /// No description provided for @backtestRecap.
  ///
  /// In zh, this message translates to:
  /// **'正在为「{strategy}」配置回测参数'**
  String backtestRecap(Object strategy);

  /// No description provided for @backtestRangeDataLabel.
  ///
  /// In zh, this message translates to:
  /// **'数据范围: {start} → {end}'**
  String backtestRangeDataLabel(Object start, Object end);

  /// No description provided for @backtestRangeCustomSummary.
  ///
  /// In zh, this message translates to:
  /// **'共 {days} 天 · 覆盖 {bars} 根 15m K 线'**
  String backtestRangeCustomSummary(Object days, Object bars);

  /// No description provided for @backtestCapitalPresetHint.
  ///
  /// In zh, this message translates to:
  /// **'模拟资金，仅用于本次回测，不影响实盘'**
  String get backtestCapitalPresetHint;

  /// No description provided for @backtestFieldMarket.
  ///
  /// In zh, this message translates to:
  /// **'交易市场'**
  String get backtestFieldMarket;

  /// No description provided for @backtestMarketSpot.
  ///
  /// In zh, this message translates to:
  /// **'现货'**
  String get backtestMarketSpot;

  /// No description provided for @backtestMarketFutures.
  ///
  /// In zh, this message translates to:
  /// **'合约'**
  String get backtestMarketFutures;

  /// No description provided for @backtestFieldLeverage.
  ///
  /// In zh, this message translates to:
  /// **'杠杆倍数'**
  String get backtestFieldLeverage;

  /// No description provided for @backtestLeverageHint.
  ///
  /// In zh, this message translates to:
  /// **'回测会同步放大盈亏与资金占用'**
  String get backtestLeverageHint;

  /// No description provided for @backtestLeverageWarn.
  ///
  /// In zh, this message translates to:
  /// **'高杠杆会显著放大爆仓风险，请确认风险承受能力'**
  String get backtestLeverageWarn;

  /// No description provided for @backtestSectionMatching.
  ///
  /// In zh, this message translates to:
  /// **'撮合参数'**
  String get backtestSectionMatching;

  /// No description provided for @backtestSectionMatchingRight.
  ///
  /// In zh, this message translates to:
  /// **'影响成交模拟'**
  String get backtestSectionMatchingRight;

  /// No description provided for @backtestHintSlippage.
  ///
  /// In zh, this message translates to:
  /// **'按 bps 模拟下单偏离'**
  String get backtestHintSlippage;

  /// No description provided for @backtestHintFee.
  ///
  /// In zh, this message translates to:
  /// **'单边费率（taker）'**
  String get backtestHintFee;

  /// No description provided for @backtestHintFillSource.
  ///
  /// In zh, this message translates to:
  /// **'K 线内成交价取值'**
  String get backtestHintFillSource;

  /// No description provided for @backtestHintPartialData.
  ///
  /// In zh, this message translates to:
  /// **'历史数据有缺口时怎么处理'**
  String get backtestHintPartialData;

  /// No description provided for @backtestPartialAllow.
  ///
  /// In zh, this message translates to:
  /// **'允许'**
  String get backtestPartialAllow;

  /// No description provided for @backtestPartialDisallow.
  ///
  /// In zh, this message translates to:
  /// **'不允许'**
  String get backtestPartialDisallow;

  /// No description provided for @backtestSummaryTitle.
  ///
  /// In zh, this message translates to:
  /// **'本次回测设定'**
  String get backtestSummaryTitle;

  /// No description provided for @backtestSummaryRange.
  ///
  /// In zh, this message translates to:
  /// **'区间'**
  String get backtestSummaryRange;

  /// No description provided for @backtestSummaryCapital.
  ///
  /// In zh, this message translates to:
  /// **'资金'**
  String get backtestSummaryCapital;

  /// No description provided for @backtestSummaryMarket.
  ///
  /// In zh, this message translates to:
  /// **'市场'**
  String get backtestSummaryMarket;

  /// No description provided for @backtestSummaryMatching.
  ///
  /// In zh, this message translates to:
  /// **'撮合'**
  String get backtestSummaryMatching;

  /// No description provided for @backtestSummaryData.
  ///
  /// In zh, this message translates to:
  /// **'数据'**
  String get backtestSummaryData;

  /// No description provided for @backtestSummaryMarketSpot.
  ///
  /// In zh, this message translates to:
  /// **'现货'**
  String get backtestSummaryMarketSpot;

  /// No description provided for @backtestSummaryMarketFutures.
  ///
  /// In zh, this message translates to:
  /// **'合约 · {leverage}'**
  String backtestSummaryMarketFutures(Object leverage);

  /// No description provided for @backtestSummaryMatchingValue.
  ///
  /// In zh, this message translates to:
  /// **'{slippage}/{fee} bps · {fillSource}'**
  String backtestSummaryMatchingValue(
    Object slippage,
    Object fee,
    Object fillSource,
  );

  /// No description provided for @backtestSummaryDataAllow.
  ///
  /// In zh, this message translates to:
  /// **'允许缺口续跑'**
  String get backtestSummaryDataAllow;

  /// No description provided for @backtestSummaryDataStrict.
  ///
  /// In zh, this message translates to:
  /// **'严格要求完整'**
  String get backtestSummaryDataStrict;

  /// No description provided for @backtestResultTitle.
  ///
  /// In zh, this message translates to:
  /// **'回测结果'**
  String get backtestResultTitle;

  /// No description provided for @backtestResultTotalReturn.
  ///
  /// In zh, this message translates to:
  /// **'总收益'**
  String get backtestResultTotalReturn;

  /// No description provided for @backtestResultMaxDrawdown.
  ///
  /// In zh, this message translates to:
  /// **'最大回撤'**
  String get backtestResultMaxDrawdown;

  /// No description provided for @backtestResultSharpe.
  ///
  /// In zh, this message translates to:
  /// **'夏普'**
  String get backtestResultSharpe;

  /// No description provided for @backtestResultTrades.
  ///
  /// In zh, this message translates to:
  /// **'成交'**
  String get backtestResultTrades;

  /// No description provided for @backtestResultTradesSuffix.
  ///
  /// In zh, this message translates to:
  /// **' 笔'**
  String get backtestResultTradesSuffix;

  /// No description provided for @backtestResultStatusDone.
  ///
  /// In zh, this message translates to:
  /// **'回测完成'**
  String get backtestResultStatusDone;

  /// No description provided for @backtestResultStatusDeployable.
  ///
  /// In zh, this message translates to:
  /// **'可部署'**
  String get backtestResultStatusDeployable;

  /// No description provided for @backtestResultCumulativeNetValue.
  ///
  /// In zh, this message translates to:
  /// **'累计净值'**
  String get backtestResultCumulativeNetValue;

  /// No description provided for @backtestResultCagrInline.
  ///
  /// In zh, this message translates to:
  /// **'CAGR'**
  String get backtestResultCagrInline;

  /// No description provided for @backtestResultDownloadLabel.
  ///
  /// In zh, this message translates to:
  /// **'下载回测报告'**
  String get backtestResultDownloadLabel;

  /// No description provided for @backtestResultMetricCagr.
  ///
  /// In zh, this message translates to:
  /// **'CAGR'**
  String get backtestResultMetricCagr;

  /// No description provided for @backtestResultMetricCagrSub.
  ///
  /// In zh, this message translates to:
  /// **'年化复合收益'**
  String get backtestResultMetricCagrSub;

  /// No description provided for @backtestResultMetricSharpeSub.
  ///
  /// In zh, this message translates to:
  /// **'风险调整后收益'**
  String get backtestResultMetricSharpeSub;

  /// No description provided for @backtestResultMetricMaxDrawdownSub.
  ///
  /// In zh, this message translates to:
  /// **'峰谷最大跌幅'**
  String get backtestResultMetricMaxDrawdownSub;

  /// No description provided for @backtestResultMetricCalmar.
  ///
  /// In zh, this message translates to:
  /// **'Calmar'**
  String get backtestResultMetricCalmar;

  /// No description provided for @backtestResultMetricCalmarSub.
  ///
  /// In zh, this message translates to:
  /// **'CAGR / |MDD|'**
  String get backtestResultMetricCalmarSub;

  /// No description provided for @backtestResultMetricWinRate.
  ///
  /// In zh, this message translates to:
  /// **'胜率'**
  String get backtestResultMetricWinRate;

  /// No description provided for @backtestResultMetricWinRateSub.
  ///
  /// In zh, this message translates to:
  /// **'盈利交易占比'**
  String get backtestResultMetricWinRateSub;

  /// No description provided for @backtestResultMetricProfitLoss.
  ///
  /// In zh, this message translates to:
  /// **'盈亏比'**
  String get backtestResultMetricProfitLoss;

  /// No description provided for @backtestResultMetricProfitLossSub.
  ///
  /// In zh, this message translates to:
  /// **'平均盈/平均亏'**
  String get backtestResultMetricProfitLossSub;

  /// No description provided for @backtestResultMetricTotalTrades.
  ///
  /// In zh, this message translates to:
  /// **'总交易'**
  String get backtestResultMetricTotalTrades;

  /// No description provided for @backtestResultMetricTotalTradesSub.
  ///
  /// In zh, this message translates to:
  /// **'5 年内开仓次数'**
  String get backtestResultMetricTotalTradesSub;

  /// No description provided for @backtestResultMetricAvgHold.
  ///
  /// In zh, this message translates to:
  /// **'平均持仓'**
  String get backtestResultMetricAvgHold;

  /// No description provided for @backtestResultMetricAvgHoldSub.
  ///
  /// In zh, this message translates to:
  /// **'单笔交易时长'**
  String get backtestResultMetricAvgHoldSub;

  /// No description provided for @backtestResultTabMonthly.
  ///
  /// In zh, this message translates to:
  /// **'月度回报'**
  String get backtestResultTabMonthly;

  /// No description provided for @backtestResultTabTrades.
  ///
  /// In zh, this message translates to:
  /// **'交易记录'**
  String get backtestResultTabTrades;

  /// No description provided for @backtestResultTabRisk.
  ///
  /// In zh, this message translates to:
  /// **'风险分析'**
  String get backtestResultTabRisk;

  /// No description provided for @backtestResultMonthlyLegendLabel.
  ///
  /// In zh, this message translates to:
  /// **'月度 % 收益'**
  String get backtestResultMonthlyLegendLabel;

  /// No description provided for @backtestResultTradeSideLong.
  ///
  /// In zh, this message translates to:
  /// **'多'**
  String get backtestResultTradeSideLong;

  /// No description provided for @backtestResultTradeSideShort.
  ///
  /// In zh, this message translates to:
  /// **'空'**
  String get backtestResultTradeSideShort;

  /// No description provided for @backtestResultTradeHoldPrefix.
  ///
  /// In zh, this message translates to:
  /// **'持仓'**
  String get backtestResultTradeHoldPrefix;

  /// No description provided for @backtestResultAiPrefix.
  ///
  /// In zh, this message translates to:
  /// **'AI 评估：'**
  String get backtestResultAiPrefix;

  /// No description provided for @backtestProgressTitle.
  ///
  /// In zh, this message translates to:
  /// **'回测进行中'**
  String get backtestProgressTitle;

  /// No description provided for @backtestProgressSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'正在回放历史 K 线，请稍候…'**
  String get backtestProgressSubtitle;

  /// No description provided for @backtestProgressCancel.
  ///
  /// In zh, this message translates to:
  /// **'取消回测'**
  String get backtestProgressCancel;

  /// No description provided for @backtestRunEta.
  ///
  /// In zh, this message translates to:
  /// **'预计剩余 {seconds}s'**
  String backtestRunEta(Object seconds);

  /// No description provided for @backtestRunReplayingPeriod.
  ///
  /// In zh, this message translates to:
  /// **'正在回放 · {period}'**
  String backtestRunReplayingPeriod(Object period);

  /// No description provided for @backtestRunCounterProcessedBars.
  ///
  /// In zh, this message translates to:
  /// **'已处理 K 线'**
  String get backtestRunCounterProcessedBars;

  /// No description provided for @backtestRunCounterProcessedBarsSub.
  ///
  /// In zh, this message translates to:
  /// **'/ {total}'**
  String backtestRunCounterProcessedBarsSub(Object total);

  /// No description provided for @backtestRunCounterTrades.
  ///
  /// In zh, this message translates to:
  /// **'已生成交易'**
  String get backtestRunCounterTrades;

  /// No description provided for @backtestRunCounterTradesSub.
  ///
  /// In zh, this message translates to:
  /// **'胜 {wins} · 负 {losses}'**
  String backtestRunCounterTradesSub(Object wins, Object losses);

  /// No description provided for @backtestRunCounterMaxDrawdown.
  ///
  /// In zh, this message translates to:
  /// **'当前最大回撤'**
  String get backtestRunCounterMaxDrawdown;

  /// No description provided for @backtestRunCounterCumReturn.
  ///
  /// In zh, this message translates to:
  /// **'当前累计收益'**
  String get backtestRunCounterCumReturn;

  /// No description provided for @backtestRunSectionEquity.
  ///
  /// In zh, this message translates to:
  /// **'实时净值'**
  String get backtestRunSectionEquity;

  /// No description provided for @backtestRunSectionLog.
  ///
  /// In zh, this message translates to:
  /// **'引擎日志'**
  String get backtestRunSectionLog;

  /// No description provided for @backtestRunPrivacyNote.
  ///
  /// In zh, this message translates to:
  /// **'回测在你设备本地运行，数据与策略均不上传。完成后可继续追问 AI 调整参数。'**
  String get backtestRunPrivacyNote;

  /// No description provided for @backtestRunLogLoad.
  ///
  /// In zh, this message translates to:
  /// **'载入 BTC/USDT 15m K 线 · 52,416 条'**
  String get backtestRunLogLoad;

  /// No description provided for @backtestRunLogIndex.
  ///
  /// In zh, this message translates to:
  /// **'索引 fast_MA(5) / slow_MA(20) ... ✓'**
  String get backtestRunLogIndex;

  /// No description provided for @backtestRunLogReplay.
  ///
  /// In zh, this message translates to:
  /// **'回放开始 · 滑点 5bps · 手续费 2bps'**
  String get backtestRunLogReplay;

  /// No description provided for @backtestRunLogOpenLong1.
  ///
  /// In zh, this message translates to:
  /// **'触发开多 @ 41,820.50 · 仓位 100%'**
  String get backtestRunLogOpenLong1;

  /// No description provided for @backtestRunLogCloseLong1.
  ///
  /// In zh, this message translates to:
  /// **'平多 @ 43,108.00 · +3.08%'**
  String get backtestRunLogCloseLong1;

  /// No description provided for @backtestRunLogOpenLong2.
  ///
  /// In zh, this message translates to:
  /// **'触发开多 @ 44,260.00 · 仓位 100%'**
  String get backtestRunLogOpenLong2;

  /// No description provided for @backtestRunLogStopLoss.
  ///
  /// In zh, this message translates to:
  /// **'止损触发 @ 43,375.00 · -2.00%'**
  String get backtestRunLogStopLoss;

  /// No description provided for @deployButton.
  ///
  /// In zh, this message translates to:
  /// **'一键部署'**
  String get deployButton;

  /// No description provided for @deploySheetTitleExchange.
  ///
  /// In zh, this message translates to:
  /// **'选择交易所'**
  String get deploySheetTitleExchange;

  /// No description provided for @deploySheetTitleAuthorize.
  ///
  /// In zh, this message translates to:
  /// **'授权部署'**
  String get deploySheetTitleAuthorize;

  /// No description provided for @deploySheetTitleDeploying.
  ///
  /// In zh, this message translates to:
  /// **'正在部署…'**
  String get deploySheetTitleDeploying;

  /// No description provided for @deploySheetTitleDone.
  ///
  /// In zh, this message translates to:
  /// **'部署成功'**
  String get deploySheetTitleDone;

  /// No description provided for @deployExchangeConfigured.
  ///
  /// In zh, this message translates to:
  /// **'已配置'**
  String get deployExchangeConfigured;

  /// No description provided for @deployExchangeNotConfigured.
  ///
  /// In zh, this message translates to:
  /// **'未配置'**
  String get deployExchangeNotConfigured;

  /// No description provided for @deployExchangeEmptyHint.
  ///
  /// In zh, this message translates to:
  /// **'尚未配置任何交易所 API，添加后再试。'**
  String get deployExchangeEmptyHint;

  /// No description provided for @deployGoConfigureButton.
  ///
  /// In zh, this message translates to:
  /// **'添加 API'**
  String get deployGoConfigureButton;

  /// No description provided for @deployAuthorizePermissionTitle.
  ///
  /// In zh, this message translates to:
  /// **'将向交易所申请以下权限'**
  String get deployAuthorizePermissionTitle;

  /// No description provided for @deployAuthorizePermissionSpot.
  ///
  /// In zh, this message translates to:
  /// **'现货下单'**
  String get deployAuthorizePermissionSpot;

  /// No description provided for @deployAuthorizePermissionFutures.
  ///
  /// In zh, this message translates to:
  /// **'合约下单'**
  String get deployAuthorizePermissionFutures;

  /// No description provided for @deployAuthorizePermissionBalance.
  ///
  /// In zh, this message translates to:
  /// **'读取余额'**
  String get deployAuthorizePermissionBalance;

  /// No description provided for @deployAuthorizeConfirmButton.
  ///
  /// In zh, this message translates to:
  /// **'同意并部署'**
  String get deployAuthorizeConfirmButton;

  /// No description provided for @deployRiskBannerOk.
  ///
  /// In zh, this message translates to:
  /// **'风控通过 · 严格按方案执行'**
  String get deployRiskBannerOk;

  /// No description provided for @deployFooterSafety.
  ///
  /// In zh, this message translates to:
  /// **'我们绝不持有你的密钥，签名仅在你的设备完成'**
  String get deployFooterSafety;

  /// No description provided for @deployExchangeTagOnchain.
  ///
  /// In zh, this message translates to:
  /// **'链上'**
  String get deployExchangeTagOnchain;

  /// No description provided for @deployExchangeTagRecommended.
  ///
  /// In zh, this message translates to:
  /// **'推荐'**
  String get deployExchangeTagRecommended;

  /// No description provided for @deployUnauthorizedTitle.
  ///
  /// In zh, this message translates to:
  /// **'授权步骤'**
  String get deployUnauthorizedTitle;

  /// No description provided for @deployUnauthorizedSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'3 步完成，全程加密'**
  String get deployUnauthorizedSubtitle;

  /// No description provided for @deployUnauthorizedIdentityWarning.
  ///
  /// In zh, this message translates to:
  /// **'未授权 · 无法接收订单'**
  String get deployUnauthorizedIdentityWarning;

  /// No description provided for @deployUnauthorizedStep1Title.
  ///
  /// In zh, this message translates to:
  /// **'在交易所创建 API Key'**
  String get deployUnauthorizedStep1Title;

  /// No description provided for @deployUnauthorizedStep1Sub.
  ///
  /// In zh, this message translates to:
  /// **'登录交易所 → API 管理 → 创建新密钥'**
  String get deployUnauthorizedStep1Sub;

  /// No description provided for @deployUnauthorizedStep2Title.
  ///
  /// In zh, this message translates to:
  /// **'仅勾选「读取 + 现货/合约下单」'**
  String get deployUnauthorizedStep2Title;

  /// No description provided for @deployUnauthorizedStep2Sub.
  ///
  /// In zh, this message translates to:
  /// **'务必关闭「提币」权限，服务端会二次校验'**
  String get deployUnauthorizedStep2Sub;

  /// No description provided for @deployUnauthorizedStep3Title.
  ///
  /// In zh, this message translates to:
  /// **'把 API Key / Secret 粘到 Quantify'**
  String get deployUnauthorizedStep3Title;

  /// No description provided for @deployUnauthorizedStep3Sub.
  ///
  /// In zh, this message translates to:
  /// **'加密存储在你的设备本地，不会上传'**
  String get deployUnauthorizedStep3Sub;

  /// No description provided for @deployUnauthorizedWithdrawWarning.
  ///
  /// In zh, this message translates to:
  /// **'必须关闭提币权限。我们会再校验一次，发现允许提币的密钥会立即拒绝部署。'**
  String get deployUnauthorizedWithdrawWarning;

  /// No description provided for @deployUnauthorizedConsent.
  ///
  /// In zh, this message translates to:
  /// **'我已了解：API 密钥将仅用于按本方案执行交易，可以随时在「我的 → API 管理」撤销。'**
  String get deployUnauthorizedConsent;

  /// No description provided for @deployUnauthorizedOpenFormButton.
  ///
  /// In zh, this message translates to:
  /// **'打开 API 配置'**
  String get deployUnauthorizedOpenFormButton;

  /// No description provided for @deployUnauthorizedCancelButton.
  ///
  /// In zh, this message translates to:
  /// **'取消'**
  String get deployUnauthorizedCancelButton;

  /// No description provided for @deployDoneToast.
  ///
  /// In zh, this message translates to:
  /// **'策略已部署'**
  String get deployDoneToast;

  /// No description provided for @deployDoneCloseButton.
  ///
  /// In zh, this message translates to:
  /// **'完成'**
  String get deployDoneCloseButton;

  /// No description provided for @deploySystemMessagePrefix.
  ///
  /// In zh, this message translates to:
  /// **'策略已部署到 '**
  String get deploySystemMessagePrefix;

  /// No description provided for @deploySystemMessageInstanceInfix.
  ///
  /// In zh, this message translates to:
  /// **' · 实例 ID '**
  String get deploySystemMessageInstanceInfix;

  /// No description provided for @deployedBubbleStrategyId.
  ///
  /// In zh, this message translates to:
  /// **'策略 ID {id} · 当前运行中'**
  String deployedBubbleStrategyId(Object id);

  /// No description provided for @deployedBubbleArchivedNotice.
  ///
  /// In zh, this message translates to:
  /// **'这条对话已归档，后续调整请新建方案或在实盘策略中操作。'**
  String get deployedBubbleArchivedNotice;

  /// No description provided for @deploySheetTitleAllocate.
  ///
  /// In zh, this message translates to:
  /// **'资金配置'**
  String get deploySheetTitleAllocate;

  /// No description provided for @deploySheetTitlePreflight.
  ///
  /// In zh, this message translates to:
  /// **'部署前检查'**
  String get deploySheetTitlePreflight;

  /// No description provided for @deployStepIndicator.
  ///
  /// In zh, this message translates to:
  /// **'{current}/{total}'**
  String deployStepIndicator(Object current, Object total);

  /// No description provided for @deployAllocateAmountLabel.
  ///
  /// In zh, this message translates to:
  /// **'投入金额'**
  String get deployAllocateAmountLabel;

  /// No description provided for @deployAllocateAmountHint.
  ///
  /// In zh, this message translates to:
  /// **'建议：首次部署不超过总资金的 30%'**
  String get deployAllocateAmountHint;

  /// No description provided for @deployAllocatePerTradeLabel.
  ///
  /// In zh, this message translates to:
  /// **'单笔仓位上限'**
  String get deployAllocatePerTradeLabel;

  /// No description provided for @deployAllocatePerTradeCaption.
  ///
  /// In zh, this message translates to:
  /// **'每笔最多占用'**
  String get deployAllocatePerTradeCaption;

  /// No description provided for @deployAllocateMaxDailyLossLabel.
  ///
  /// In zh, this message translates to:
  /// **'日内最大亏损'**
  String get deployAllocateMaxDailyLossLabel;

  /// No description provided for @deployAllocateMaxDailyLossCaption.
  ///
  /// In zh, this message translates to:
  /// **'触发后自动暂停当日交易'**
  String get deployAllocateMaxDailyLossCaption;

  /// No description provided for @deployAllocateNotifySectionLabel.
  ///
  /// In zh, this message translates to:
  /// **'通知'**
  String get deployAllocateNotifySectionLabel;

  /// No description provided for @deployAllocateNotifyOpenLabel.
  ///
  /// In zh, this message translates to:
  /// **'开仓时通知'**
  String get deployAllocateNotifyOpenLabel;

  /// No description provided for @deployAllocateNotifyOpenCaption.
  ///
  /// In zh, this message translates to:
  /// **'推送 + 应用内消息'**
  String get deployAllocateNotifyOpenCaption;

  /// No description provided for @deployAllocateNotifyCloseLabel.
  ///
  /// In zh, this message translates to:
  /// **'平仓时通知'**
  String get deployAllocateNotifyCloseLabel;

  /// No description provided for @deployAllocateNotifyCloseCaption.
  ///
  /// In zh, this message translates to:
  /// **'推送 + 应用内消息'**
  String get deployAllocateNotifyCloseCaption;

  /// No description provided for @deployAllocateNotifyStopLossLabel.
  ///
  /// In zh, this message translates to:
  /// **'触发止损时通知'**
  String get deployAllocateNotifyStopLossLabel;

  /// No description provided for @deployAllocateNotifyStopLossCaption.
  ///
  /// In zh, this message translates to:
  /// **'推送 + 邮件'**
  String get deployAllocateNotifyStopLossCaption;

  /// No description provided for @deployAllocateNextButton.
  ///
  /// In zh, this message translates to:
  /// **'下一步'**
  String get deployAllocateNextButton;

  /// No description provided for @deployPreflightStrategyName.
  ///
  /// In zh, this message translates to:
  /// **'BTC 趋势 · 双均线'**
  String get deployPreflightStrategyName;

  /// No description provided for @deployPreflightStrategyMeta.
  ///
  /// In zh, this message translates to:
  /// **'BTC/USDT · 15m · 永续 · 5x'**
  String get deployPreflightStrategyMeta;

  /// No description provided for @deployPreflightScanning.
  ///
  /// In zh, this message translates to:
  /// **'检测中 {done}/{total}'**
  String deployPreflightScanning(Object done, Object total);

  /// No description provided for @deployPreflightPassed.
  ///
  /// In zh, this message translates to:
  /// **'{pass}/{total} 通过'**
  String deployPreflightPassed(Object pass, Object total);

  /// No description provided for @deployPreflightFailed.
  ///
  /// In zh, this message translates to:
  /// **'{fail}/{total} 未通过'**
  String deployPreflightFailed(Object fail, Object total);

  /// No description provided for @deployPreflightRecheck.
  ///
  /// In zh, this message translates to:
  /// **'重新检测'**
  String get deployPreflightRecheck;

  /// No description provided for @deployPreflightRechecking.
  ///
  /// In zh, this message translates to:
  /// **'检测中…'**
  String get deployPreflightRechecking;

  /// No description provided for @deployPreflightApiOkTitle.
  ///
  /// In zh, this message translates to:
  /// **'{exchange} API 已绑定'**
  String deployPreflightApiOkTitle(Object exchange);

  /// No description provided for @deployPreflightApiOkSub.
  ///
  /// In zh, this message translates to:
  /// **'读取 + 现货 + 永续 · 未启用提币（安全）'**
  String get deployPreflightApiOkSub;

  /// No description provided for @deployPreflightBalanceOkTitle.
  ///
  /// In zh, this message translates to:
  /// **'账户余额充足'**
  String get deployPreflightBalanceOkTitle;

  /// No description provided for @deployPreflightBalanceOkSub.
  ///
  /// In zh, this message translates to:
  /// **'可用资金满足部署所需，留有余裕'**
  String get deployPreflightBalanceOkSub;

  /// No description provided for @deployPreflightLatencyOkTitle.
  ///
  /// In zh, this message translates to:
  /// **'网络与交易所时延正常'**
  String get deployPreflightLatencyOkTitle;

  /// No description provided for @deployPreflightLatencyOkSub.
  ///
  /// In zh, this message translates to:
  /// **'下单延时 < 200ms · 数据流稳定'**
  String get deployPreflightLatencyOkSub;

  /// No description provided for @deployPreflightBackButton.
  ///
  /// In zh, this message translates to:
  /// **'返回'**
  String get deployPreflightBackButton;

  /// No description provided for @deployPreflightConfirmButton.
  ///
  /// In zh, this message translates to:
  /// **'确认无误，立即部署'**
  String get deployPreflightConfirmButton;

  /// No description provided for @deployPreflightApiFailTitle.
  ///
  /// In zh, this message translates to:
  /// **'交易所 API 未绑定'**
  String get deployPreflightApiFailTitle;

  /// No description provided for @deployPreflightApiFailSub.
  ///
  /// In zh, this message translates to:
  /// **'未检测到可用密钥，去绑定 API 后重试'**
  String get deployPreflightApiFailSub;

  /// No description provided for @deployPreflightBalanceFailTitle.
  ///
  /// In zh, this message translates to:
  /// **'账户余额不足'**
  String get deployPreflightBalanceFailTitle;

  /// No description provided for @deployPreflightBalanceFailSub.
  ///
  /// In zh, this message translates to:
  /// **'可用资金低于部署所需，请充值或调低投入金额'**
  String get deployPreflightBalanceFailSub;

  /// No description provided for @deployPreflightLatencyFailTitle.
  ///
  /// In zh, this message translates to:
  /// **'网络或交易所时延异常'**
  String get deployPreflightLatencyFailTitle;

  /// No description provided for @deployPreflightLatencyFailSub.
  ///
  /// In zh, this message translates to:
  /// **'下单延时偏高 · 数据流不稳定，建议稍后重试'**
  String get deployPreflightLatencyFailSub;

  /// No description provided for @deployConfirmSummaryReturn.
  ///
  /// In zh, this message translates to:
  /// **'累计净值'**
  String get deployConfirmSummaryReturn;

  /// No description provided for @deployConfirmSummarySharpe.
  ///
  /// In zh, this message translates to:
  /// **'Sharpe'**
  String get deployConfirmSummarySharpe;

  /// No description provided for @deployConfirmSummaryMaxDrawdown.
  ///
  /// In zh, this message translates to:
  /// **'最大回撤'**
  String get deployConfirmSummaryMaxDrawdown;

  /// No description provided for @deployConfirmFieldExchange.
  ///
  /// In zh, this message translates to:
  /// **'交易所'**
  String get deployConfirmFieldExchange;

  /// No description provided for @deployConfirmFieldMarketType.
  ///
  /// In zh, this message translates to:
  /// **'市场类型'**
  String get deployConfirmFieldMarketType;

  /// No description provided for @deployConfirmFieldAccount.
  ///
  /// In zh, this message translates to:
  /// **'选择账户'**
  String get deployConfirmFieldAccount;

  /// No description provided for @deployConfirmFieldLeverage.
  ///
  /// In zh, this message translates to:
  /// **'部署杠杆'**
  String get deployConfirmFieldLeverage;

  /// No description provided for @deployConfirmMarketPerp.
  ///
  /// In zh, this message translates to:
  /// **'永续合约'**
  String get deployConfirmMarketPerp;

  /// No description provided for @deployConfirmFootnote.
  ///
  /// In zh, this message translates to:
  /// **'交易所 / 市场 / 杠杆由 AI 对话决定；账户可在同交易所已绑定账户间切换，确认后将按此方案部署实盘'**
  String get deployConfirmFootnote;

  /// No description provided for @deployingTitle.
  ///
  /// In zh, this message translates to:
  /// **'正在部署到 {exchange}'**
  String deployingTitle(Object exchange);

  /// No description provided for @deployingCaption.
  ///
  /// In zh, this message translates to:
  /// **'请勿关闭页面，通常需要 3-5 秒'**
  String get deployingCaption;

  /// No description provided for @deployingStepAuthTitle.
  ///
  /// In zh, this message translates to:
  /// **'校验 API 权限'**
  String get deployingStepAuthTitle;

  /// No description provided for @deployingStepAuthSub.
  ///
  /// In zh, this message translates to:
  /// **'确认未开启提币 · 已启用现货+合约下单'**
  String get deployingStepAuthSub;

  /// No description provided for @deployingStepPushTitle.
  ///
  /// In zh, this message translates to:
  /// **'推送策略到云端'**
  String get deployingStepPushTitle;

  /// No description provided for @deployingStepPushSub.
  ///
  /// In zh, this message translates to:
  /// **'加密上传策略参数与风控规则'**
  String get deployingStepPushSub;

  /// No description provided for @deployingStepNodeTitle.
  ///
  /// In zh, this message translates to:
  /// **'启动执行节点'**
  String get deployingStepNodeTitle;

  /// No description provided for @deployingStepNodeSub.
  ///
  /// In zh, this message translates to:
  /// **'分配独立节点 · 同步交易所时间'**
  String get deployingStepNodeSub;

  /// No description provided for @deployingStepFeedTitle.
  ///
  /// In zh, this message translates to:
  /// **'订阅实时行情'**
  String get deployingStepFeedTitle;

  /// No description provided for @deployingStepFeedSub.
  ///
  /// In zh, this message translates to:
  /// **'BTC/USDT 15m · WebSocket 已连接'**
  String get deployingStepFeedSub;

  /// No description provided for @deployingStepReadyTitle.
  ///
  /// In zh, this message translates to:
  /// **'就绪'**
  String get deployingStepReadyTitle;

  /// No description provided for @deployingStepReadySub.
  ///
  /// In zh, this message translates to:
  /// **'等待首个信号触发'**
  String get deployingStepReadySub;

  /// No description provided for @deployDoneTitle.
  ///
  /// In zh, this message translates to:
  /// **'部署成功'**
  String get deployDoneTitle;

  /// No description provided for @deployDoneSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'策略已在 {exchange} 实盘运行，首个信号触发后会推送提醒你'**
  String deployDoneSubtitle(Object exchange);

  /// No description provided for @deployDoneDetailStrategyId.
  ///
  /// In zh, this message translates to:
  /// **'策略 ID'**
  String get deployDoneDetailStrategyId;

  /// No description provided for @deployDoneDetailExchange.
  ///
  /// In zh, this message translates to:
  /// **'交易所'**
  String get deployDoneDetailExchange;

  /// No description provided for @deployDoneDetailSymbol.
  ///
  /// In zh, this message translates to:
  /// **'交易对'**
  String get deployDoneDetailSymbol;

  /// No description provided for @deployDoneDetailAmount.
  ///
  /// In zh, this message translates to:
  /// **'初始资金'**
  String get deployDoneDetailAmount;

  /// No description provided for @deployDoneDetailLeverage.
  ///
  /// In zh, this message translates to:
  /// **'杠杆'**
  String get deployDoneDetailLeverage;

  /// No description provided for @deployDoneDetailStartedAt.
  ///
  /// In zh, this message translates to:
  /// **'启动时间'**
  String get deployDoneDetailStartedAt;

  /// No description provided for @deployDoneDetailStatus.
  ///
  /// In zh, this message translates to:
  /// **'状态'**
  String get deployDoneDetailStatus;

  /// No description provided for @deployDoneStatusRunning.
  ///
  /// In zh, this message translates to:
  /// **'运行中'**
  String get deployDoneStatusRunning;

  /// No description provided for @deployDoneNextStepsLabel.
  ///
  /// In zh, this message translates to:
  /// **'接下来你可以'**
  String get deployDoneNextStepsLabel;

  /// No description provided for @deployDoneNextLiveTitle.
  ///
  /// In zh, this message translates to:
  /// **'查看实盘策略'**
  String get deployDoneNextLiveTitle;

  /// No description provided for @deployDoneNextLiveSub.
  ///
  /// In zh, this message translates to:
  /// **'在「我的 → 实盘策略」追踪持仓和收益'**
  String get deployDoneNextLiveSub;

  /// No description provided for @deployDoneNextNotifyTitle.
  ///
  /// In zh, this message translates to:
  /// **'开启价格通知'**
  String get deployDoneNextNotifyTitle;

  /// No description provided for @deployDoneNextNotifySub.
  ///
  /// In zh, this message translates to:
  /// **'BTC 突破关键位时第一时间收到推送'**
  String get deployDoneNextNotifySub;

  /// No description provided for @deployDoneNextTuneTitle.
  ///
  /// In zh, this message translates to:
  /// **'继续在 AI 中调优'**
  String get deployDoneNextTuneTitle;

  /// No description provided for @deployDoneNextTuneSub.
  ///
  /// In zh, this message translates to:
  /// **'随时回到对话调整止损或参数'**
  String get deployDoneNextTuneSub;

  /// No description provided for @authLoginTitle.
  ///
  /// In zh, this message translates to:
  /// **'登录'**
  String get authLoginTitle;

  /// No description provided for @authLoginSheetTitle.
  ///
  /// In zh, this message translates to:
  /// **'登录 Quantify'**
  String get authLoginSheetTitle;

  /// No description provided for @authLoginSheetSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'邮箱或 Telegram 继续'**
  String get authLoginSheetSubtitle;

  /// No description provided for @authLoginOr.
  ///
  /// In zh, this message translates to:
  /// **'或'**
  String get authLoginOr;

  /// No description provided for @authLoginEmailLabel.
  ///
  /// In zh, this message translates to:
  /// **'邮箱'**
  String get authLoginEmailLabel;

  /// No description provided for @authLoginCodeLabel.
  ///
  /// In zh, this message translates to:
  /// **'验证码'**
  String get authLoginCodeLabel;

  /// No description provided for @authLoginCodeHint.
  ///
  /// In zh, this message translates to:
  /// **'6位验证码'**
  String get authLoginCodeHint;

  /// No description provided for @authLoginSendCode.
  ///
  /// In zh, this message translates to:
  /// **'发送验证码'**
  String get authLoginSendCode;

  /// No description provided for @authLoginResend.
  ///
  /// In zh, this message translates to:
  /// **'重新发送'**
  String get authLoginResend;

  /// No description provided for @authLoginCountdown.
  ///
  /// In zh, this message translates to:
  /// **'{secs}s 后重发'**
  String authLoginCountdown(Object secs);

  /// No description provided for @authLoginCodeRequired.
  ///
  /// In zh, this message translates to:
  /// **'请输入验证码'**
  String get authLoginCodeRequired;

  /// No description provided for @authLoginCodeInvalid.
  ///
  /// In zh, this message translates to:
  /// **'验证码必须为 6 位'**
  String get authLoginCodeInvalid;

  /// No description provided for @authLoginButton.
  ///
  /// In zh, this message translates to:
  /// **'登录'**
  String get authLoginButton;

  /// No description provided for @authLoginTelegramButton.
  ///
  /// In zh, this message translates to:
  /// **'通过 Telegram 登录'**
  String get authLoginTelegramButton;

  /// No description provided for @authLoginEmailRequired.
  ///
  /// In zh, this message translates to:
  /// **'请输入邮箱'**
  String get authLoginEmailRequired;

  /// No description provided for @authLoginEmailInvalid.
  ///
  /// In zh, this message translates to:
  /// **'邮箱格式不正确'**
  String get authLoginEmailInvalid;

  /// No description provided for @authLoginFailedPrefix.
  ///
  /// In zh, this message translates to:
  /// **'登录失败：'**
  String get authLoginFailedPrefix;

  /// No description provided for @authTelegramLoginFailedPrefix.
  ///
  /// In zh, this message translates to:
  /// **'Telegram 登录失败：'**
  String get authTelegramLoginFailedPrefix;

  /// No description provided for @authLoginTermsPrefix.
  ///
  /// In zh, this message translates to:
  /// **'继续即表示同意 '**
  String get authLoginTermsPrefix;

  /// No description provided for @authLoginTermsLink.
  ///
  /// In zh, this message translates to:
  /// **'服务条款'**
  String get authLoginTermsLink;

  /// No description provided for @authLoginTermsAnd.
  ///
  /// In zh, this message translates to:
  /// **' 与 '**
  String get authLoginTermsAnd;

  /// No description provided for @authLoginPrivacyLink.
  ///
  /// In zh, this message translates to:
  /// **'隐私政策'**
  String get authLoginPrivacyLink;

  /// No description provided for @strategyGuestHeroLine1.
  ///
  /// In zh, this message translates to:
  /// **'小白也能用的'**
  String get strategyGuestHeroLine1;

  /// No description provided for @strategyGuestHeroAiQuant.
  ///
  /// In zh, this message translates to:
  /// **'AI 量化'**
  String get strategyGuestHeroAiQuant;

  /// No description provided for @strategyGuestHeroLine2Suffix.
  ///
  /// In zh, this message translates to:
  /// **'交易工具'**
  String get strategyGuestHeroLine2Suffix;

  /// No description provided for @strategyGuestHeroSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'描述你的交易想法,AI 自动生成策略并帮你完成回测部署。'**
  String get strategyGuestHeroSubtitle;

  /// No description provided for @strategyGuestPrimaryCta.
  ///
  /// In zh, this message translates to:
  /// **'立即体验'**
  String get strategyGuestPrimaryCta;

  /// No description provided for @strategyGuestHotTitle.
  ///
  /// In zh, this message translates to:
  /// **'热门策略'**
  String get strategyGuestHotTitle;

  /// No description provided for @strategyGuestHotBadge.
  ///
  /// In zh, this message translates to:
  /// **'HOT'**
  String get strategyGuestHotBadge;

  /// No description provided for @strategyGuestViewAll.
  ///
  /// In zh, this message translates to:
  /// **'查看全部'**
  String get strategyGuestViewAll;

  /// No description provided for @strategyGuestUnlockTitle.
  ///
  /// In zh, this message translates to:
  /// **'登录解锁完整功能'**
  String get strategyGuestUnlockTitle;

  /// No description provided for @strategyGuestUnlockSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'AI 对话生成 · 一键回测 · 实盘部署'**
  String get strategyGuestUnlockSubtitle;

  /// No description provided for @strategyGuestUnlockCta.
  ///
  /// In zh, this message translates to:
  /// **'登录 / 注册'**
  String get strategyGuestUnlockCta;

  /// No description provided for @marketHomeTabWatchlist.
  ///
  /// In zh, this message translates to:
  /// **'自选'**
  String get marketHomeTabWatchlist;

  /// No description provided for @marketHomeTabSpot.
  ///
  /// In zh, this message translates to:
  /// **'现货'**
  String get marketHomeTabSpot;

  /// No description provided for @marketHomeTabPerp.
  ///
  /// In zh, this message translates to:
  /// **'合约'**
  String get marketHomeTabPerp;

  /// No description provided for @marketHomeTabGainers.
  ///
  /// In zh, this message translates to:
  /// **'涨幅榜'**
  String get marketHomeTabGainers;

  /// No description provided for @marketHomeTabLosers.
  ///
  /// In zh, this message translates to:
  /// **'跌幅榜'**
  String get marketHomeTabLosers;

  /// No description provided for @marketHomeLoadError.
  ///
  /// In zh, this message translates to:
  /// **'行情加载失败'**
  String get marketHomeLoadError;

  /// No description provided for @marketHomeEmpty.
  ///
  /// In zh, this message translates to:
  /// **'暂无行情'**
  String get marketHomeEmpty;

  /// No description provided for @marketHomeWatchlistEmpty.
  ///
  /// In zh, this message translates to:
  /// **'暂无自选'**
  String get marketHomeWatchlistEmpty;

  /// No description provided for @marketHomeSearchEmpty.
  ///
  /// In zh, this message translates to:
  /// **'无匹配结果'**
  String get marketHomeSearchEmpty;

  /// No description provided for @marketHomeSearchTooltip.
  ///
  /// In zh, this message translates to:
  /// **'搜索'**
  String get marketHomeSearchTooltip;

  /// No description provided for @marketHomeSearchClose.
  ///
  /// In zh, this message translates to:
  /// **'关闭搜索'**
  String get marketHomeSearchClose;

  /// No description provided for @marketHomeSearchPlaceholder.
  ///
  /// In zh, this message translates to:
  /// **'搜索'**
  String get marketHomeSearchPlaceholder;

  /// No description provided for @dataHubTitle.
  ///
  /// In zh, this message translates to:
  /// **'数据'**
  String get dataHubTitle;

  /// No description provided for @dataHubTabMarket.
  ///
  /// In zh, this message translates to:
  /// **'行情数据'**
  String get dataHubTabMarket;

  /// No description provided for @dataHubTabLongShort.
  ///
  /// In zh, this message translates to:
  /// **'多空比'**
  String get dataHubTabLongShort;

  /// No description provided for @dataHubTabAggOrders.
  ///
  /// In zh, this message translates to:
  /// **'聚合挂单'**
  String get dataHubTabAggOrders;

  /// No description provided for @dataHubTabPredict.
  ///
  /// In zh, this message translates to:
  /// **'预测市场'**
  String get dataHubTabPredict;

  /// No description provided for @dataHubTabCoinStock.
  ///
  /// In zh, this message translates to:
  /// **'币股'**
  String get dataHubTabCoinStock;

  /// No description provided for @dataHubHintMarket.
  ///
  /// In zh, this message translates to:
  /// **'自选 · 涨跌榜'**
  String get dataHubHintMarket;

  /// No description provided for @dataHubHintLongShort.
  ///
  /// In zh, this message translates to:
  /// **'永续合约 L/S'**
  String get dataHubHintLongShort;

  /// No description provided for @dataHubHintAggOrders.
  ///
  /// In zh, this message translates to:
  /// **'跨所合并深度'**
  String get dataHubHintAggOrders;

  /// No description provided for @dataHubHintPredict.
  ///
  /// In zh, this message translates to:
  /// **'链上事件概率'**
  String get dataHubHintPredict;

  /// No description provided for @dataHubHintCoinStock.
  ///
  /// In zh, this message translates to:
  /// **'加密相关股票'**
  String get dataHubHintCoinStock;

  /// No description provided for @dataHubNotificationTooltip.
  ///
  /// In zh, this message translates to:
  /// **'通知'**
  String get dataHubNotificationTooltip;

  /// No description provided for @dataHubPlaceholderTitle.
  ///
  /// In zh, this message translates to:
  /// **'即将上线'**
  String get dataHubPlaceholderTitle;

  /// No description provided for @marketHomeColumnName.
  ///
  /// In zh, this message translates to:
  /// **'名称 / 24H量'**
  String get marketHomeColumnName;

  /// No description provided for @marketHomeColumnPrice.
  ///
  /// In zh, this message translates to:
  /// **'最新价'**
  String get marketHomeColumnPrice;

  /// No description provided for @marketHomeColumnChange.
  ///
  /// In zh, this message translates to:
  /// **'24H 涨跌'**
  String get marketHomeColumnChange;

  /// No description provided for @marketLongShortTitle.
  ///
  /// In zh, this message translates to:
  /// **'多空比'**
  String get marketLongShortTitle;

  /// No description provided for @marketLongShortLoadError.
  ///
  /// In zh, this message translates to:
  /// **'多空比加载失败'**
  String get marketLongShortLoadError;

  /// No description provided for @marketLongShortHistory.
  ///
  /// In zh, this message translates to:
  /// **'历史'**
  String get marketLongShortHistory;

  /// No description provided for @marketLongShortHistorySection.
  ///
  /// In zh, this message translates to:
  /// **'历史多空比'**
  String get marketLongShortHistorySection;

  /// No description provided for @marketLongShortHeroSuffix.
  ///
  /// In zh, this message translates to:
  /// **'全市场'**
  String get marketLongShortHeroSuffix;

  /// No description provided for @marketLongShortTotalNotional.
  ///
  /// In zh, this message translates to:
  /// **'{total} 总持仓 · 4H 数据'**
  String marketLongShortTotalNotional(String total);

  /// No description provided for @marketLongShortLongHolding.
  ///
  /// In zh, this message translates to:
  /// **'多头持仓'**
  String get marketLongShortLongHolding;

  /// No description provided for @marketLongShortShortHolding.
  ///
  /// In zh, this message translates to:
  /// **'空头持仓'**
  String get marketLongShortShortHolding;

  /// No description provided for @marketLongShortExchangesTitle.
  ///
  /// In zh, this message translates to:
  /// **'交易所分布'**
  String get marketLongShortExchangesTitle;

  /// No description provided for @marketLongShortExchangesSortBy.
  ///
  /// In zh, this message translates to:
  /// **'按多头量排序'**
  String get marketLongShortExchangesSortBy;

  /// No description provided for @marketLongShortRefreshTooltip.
  ///
  /// In zh, this message translates to:
  /// **'刷新'**
  String get marketLongShortRefreshTooltip;

  /// No description provided for @marketLongShortLive.
  ///
  /// In zh, this message translates to:
  /// **'LIVE'**
  String get marketLongShortLive;

  /// No description provided for @marketLongShortRowLongPct.
  ///
  /// In zh, this message translates to:
  /// **'多 {pct}%'**
  String marketLongShortRowLongPct(String pct);

  /// No description provided for @marketLongShortRowShortPct.
  ///
  /// In zh, this message translates to:
  /// **'空 {pct}%'**
  String marketLongShortRowShortPct(String pct);

  /// No description provided for @marketDetailSymbolNotFound.
  ///
  /// In zh, this message translates to:
  /// **'未找到该交易对'**
  String get marketDetailSymbolNotFound;

  /// No description provided for @marketDetailTickerPrefix.
  ///
  /// In zh, this message translates to:
  /// **'行情详情：'**
  String get marketDetailTickerPrefix;

  /// No description provided for @marketDetailSectionOrderbook.
  ///
  /// In zh, this message translates to:
  /// **'盘口'**
  String get marketDetailSectionOrderbook;

  /// No description provided for @marketDetailBuyButton.
  ///
  /// In zh, this message translates to:
  /// **'买入 / 做多'**
  String get marketDetailBuyButton;

  /// No description provided for @marketDetailBuySubLabel.
  ///
  /// In zh, this message translates to:
  /// **'开多 · 10x'**
  String get marketDetailBuySubLabel;

  /// No description provided for @marketDetailSellButton.
  ///
  /// In zh, this message translates to:
  /// **'卖出 / 做空'**
  String get marketDetailSellButton;

  /// No description provided for @marketDetailSellSubLabel.
  ///
  /// In zh, this message translates to:
  /// **'开空 · 10x'**
  String get marketDetailSellSubLabel;

  /// No description provided for @marketDetailSubtitlePerpBinance.
  ///
  /// In zh, this message translates to:
  /// **'永续 · Binance'**
  String get marketDetailSubtitlePerpBinance;

  /// No description provided for @marketDetailSubtitlePerpAggregated.
  ///
  /// In zh, this message translates to:
  /// **'永续 · 聚合'**
  String get marketDetailSubtitlePerpAggregated;

  /// No description provided for @marketDetailSubtitlePerpExchange.
  ///
  /// In zh, this message translates to:
  /// **'永续 · {exchange}'**
  String marketDetailSubtitlePerpExchange(Object exchange);

  /// No description provided for @marketDetailSourceAggregated.
  ///
  /// In zh, this message translates to:
  /// **'聚合'**
  String get marketDetailSourceAggregated;

  /// No description provided for @marketDetailSourceAggregatedFull.
  ///
  /// In zh, this message translates to:
  /// **'聚合所有交易所'**
  String get marketDetailSourceAggregatedFull;

  /// No description provided for @marketDetailSourceSheetTitle.
  ///
  /// In zh, this message translates to:
  /// **'数据来源'**
  String get marketDetailSourceSheetTitle;

  /// No description provided for @marketDetail24hHigh.
  ///
  /// In zh, this message translates to:
  /// **'24H 高'**
  String get marketDetail24hHigh;

  /// No description provided for @marketDetail24hLow.
  ///
  /// In zh, this message translates to:
  /// **'24H 低'**
  String get marketDetail24hLow;

  /// No description provided for @marketDetail24hVolume.
  ///
  /// In zh, this message translates to:
  /// **'24H 量'**
  String get marketDetail24hVolume;

  /// No description provided for @marketDetailOpenInterest.
  ///
  /// In zh, this message translates to:
  /// **'持仓量'**
  String get marketDetailOpenInterest;

  /// No description provided for @marketDetailCumTurnover.
  ///
  /// In zh, this message translates to:
  /// **'累计成交额(\$)'**
  String get marketDetailCumTurnover;

  /// No description provided for @marketDetailCumNetInflow.
  ///
  /// In zh, this message translates to:
  /// **'累计净流入(\$)'**
  String get marketDetailCumNetInflow;

  /// No description provided for @marketDetailCumHigh.
  ///
  /// In zh, this message translates to:
  /// **'最高'**
  String get marketDetailCumHigh;

  /// No description provided for @marketDetailCumLow.
  ///
  /// In zh, this message translates to:
  /// **'最低'**
  String get marketDetailCumLow;

  /// No description provided for @marketDetailIndexPrice.
  ///
  /// In zh, this message translates to:
  /// **'指数价格'**
  String get marketDetailIndexPrice;

  /// No description provided for @marketDetailMarkPrice.
  ///
  /// In zh, this message translates to:
  /// **'标记价格'**
  String get marketDetailMarkPrice;

  /// No description provided for @marketDetailFundingRate.
  ///
  /// In zh, this message translates to:
  /// **'资金费率'**
  String get marketDetailFundingRate;

  /// No description provided for @marketDetailPanelOrderbook.
  ///
  /// In zh, this message translates to:
  /// **'盘口'**
  String get marketDetailPanelOrderbook;

  /// No description provided for @marketDetailPanelTrades.
  ///
  /// In zh, this message translates to:
  /// **'成交'**
  String get marketDetailPanelTrades;

  /// No description provided for @marketDetailPanelDepth.
  ///
  /// In zh, this message translates to:
  /// **'深度图'**
  String get marketDetailPanelDepth;

  /// No description provided for @marketDetailColTime.
  ///
  /// In zh, this message translates to:
  /// **'时间'**
  String get marketDetailColTime;

  /// No description provided for @marketDetailColPrice.
  ///
  /// In zh, this message translates to:
  /// **'价格'**
  String get marketDetailColPrice;

  /// No description provided for @marketDetailColQty.
  ///
  /// In zh, this message translates to:
  /// **'数量'**
  String get marketDetailColQty;

  /// No description provided for @marketDetailColTradeTime.
  ///
  /// In zh, this message translates to:
  /// **'成交时间'**
  String get marketDetailColTradeTime;

  /// No description provided for @marketDetailDepthBid.
  ///
  /// In zh, this message translates to:
  /// **'BID'**
  String get marketDetailDepthBid;

  /// No description provided for @marketDetailDepthSpread.
  ///
  /// In zh, this message translates to:
  /// **'SPREAD'**
  String get marketDetailDepthSpread;

  /// No description provided for @marketDetailDepthAsk.
  ///
  /// In zh, this message translates to:
  /// **'ASK'**
  String get marketDetailDepthAsk;

  /// No description provided for @orderbookViewBoth.
  ///
  /// In zh, this message translates to:
  /// **'双向'**
  String get orderbookViewBoth;

  /// No description provided for @orderbookViewAsks.
  ///
  /// In zh, this message translates to:
  /// **'卖单'**
  String get orderbookViewAsks;

  /// No description provided for @orderbookViewBids.
  ///
  /// In zh, this message translates to:
  /// **'买单'**
  String get orderbookViewBids;

  /// No description provided for @orderbookPrecisionTitle.
  ///
  /// In zh, this message translates to:
  /// **'价格精度'**
  String get orderbookPrecisionTitle;

  /// No description provided for @orderbookRefreshFuture.
  ///
  /// In zh, this message translates to:
  /// **'刷新（即将上线）'**
  String get orderbookRefreshFuture;

  /// No description provided for @orderbookSortFuture.
  ///
  /// In zh, this message translates to:
  /// **'排序（即将上线）'**
  String get orderbookSortFuture;

  /// No description provided for @orderbookColPrice.
  ///
  /// In zh, this message translates to:
  /// **'价格({quote})'**
  String orderbookColPrice(String quote);

  /// No description provided for @orderbookColQty.
  ///
  /// In zh, this message translates to:
  /// **'数量({base})'**
  String orderbookColQty(String base);

  /// No description provided for @orderbookColAmount.
  ///
  /// In zh, this message translates to:
  /// **'委托额(\$)'**
  String get orderbookColAmount;

  /// No description provided for @aggSubTabOrders.
  ///
  /// In zh, this message translates to:
  /// **'聚合挂单'**
  String get aggSubTabOrders;

  /// No description provided for @aggSubTabOpenInterest.
  ///
  /// In zh, this message translates to:
  /// **'聚合持仓量'**
  String get aggSubTabOpenInterest;

  /// No description provided for @aggSubTabVolume.
  ///
  /// In zh, this message translates to:
  /// **'聚合成交量'**
  String get aggSubTabVolume;

  /// No description provided for @predMarketSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'基于链上数据的未来趋势预测'**
  String get predMarketSubtitle;

  /// No description provided for @predMarketSearchHint.
  ///
  /// In zh, this message translates to:
  /// **'搜索预测市场'**
  String get predMarketSearchHint;

  /// No description provided for @predMarketSearchHotLabel.
  ///
  /// In zh, this message translates to:
  /// **'热门话题'**
  String get predMarketSearchHotLabel;

  /// No description provided for @predMarketEmpty.
  ///
  /// In zh, this message translates to:
  /// **'无匹配市场'**
  String get predMarketEmpty;

  /// No description provided for @predMarketDetailTitle.
  ///
  /// In zh, this message translates to:
  /// **'市场详情'**
  String get predMarketDetailTitle;

  /// No description provided for @predMarketRules.
  ///
  /// In zh, this message translates to:
  /// **'规则'**
  String get predMarketRules;

  /// No description provided for @predMarketResolutionSource.
  ///
  /// In zh, this message translates to:
  /// **'Resolution source'**
  String get predMarketResolutionSource;

  /// No description provided for @predMarketEventWindow.
  ///
  /// In zh, this message translates to:
  /// **'Event window'**
  String get predMarketEventWindow;

  /// No description provided for @predMarketCreatedAt.
  ///
  /// In zh, this message translates to:
  /// **'创建时间'**
  String get predMarketCreatedAt;

  /// No description provided for @predMarketVolumeLabel.
  ///
  /// In zh, this message translates to:
  /// **'交易量'**
  String get predMarketVolumeLabel;

  /// No description provided for @predMarketStatusOpen.
  ///
  /// In zh, this message translates to:
  /// **'OPEN'**
  String get predMarketStatusOpen;

  /// No description provided for @predMarketStatusClosed.
  ///
  /// In zh, this message translates to:
  /// **'CLOSED'**
  String get predMarketStatusClosed;

  /// No description provided for @coinStockTabAll.
  ///
  /// In zh, this message translates to:
  /// **'全部'**
  String get coinStockTabAll;

  /// No description provided for @coinStockTabOther.
  ///
  /// In zh, this message translates to:
  /// **'其他'**
  String get coinStockTabOther;

  /// No description provided for @coinStockSearchHint.
  ///
  /// In zh, this message translates to:
  /// **'搜索公司 / 股票代码'**
  String get coinStockSearchHint;

  /// No description provided for @coinStockSearchHotLabel.
  ///
  /// In zh, this message translates to:
  /// **'热门标的'**
  String get coinStockSearchHotLabel;

  /// No description provided for @coinStockSearchEmpty.
  ///
  /// In zh, this message translates to:
  /// **'无匹配公司'**
  String get coinStockSearchEmpty;

  /// No description provided for @coinStockEmpty.
  ///
  /// In zh, this message translates to:
  /// **'暂无匹配公司'**
  String get coinStockEmpty;

  /// No description provided for @coinStockStatMnav.
  ///
  /// In zh, this message translates to:
  /// **'MNAV'**
  String get coinStockStatMnav;

  /// No description provided for @coinStockStatMcap.
  ///
  /// In zh, this message translates to:
  /// **'市值'**
  String get coinStockStatMcap;

  /// No description provided for @coinStockStatHoldValue.
  ///
  /// In zh, this message translates to:
  /// **'持币价值'**
  String get coinStockStatHoldValue;

  /// No description provided for @coinStockStatHoldQty.
  ///
  /// In zh, this message translates to:
  /// **'持币量'**
  String get coinStockStatHoldQty;

  /// No description provided for @coinStockSortPrice.
  ///
  /// In zh, this message translates to:
  /// **'股价'**
  String get coinStockSortPrice;

  /// No description provided for @coinStockSortChange.
  ///
  /// In zh, this message translates to:
  /// **'24h 涨跌'**
  String get coinStockSortChange;

  /// No description provided for @coinStockSortBy.
  ///
  /// In zh, this message translates to:
  /// **'按'**
  String get coinStockSortBy;

  /// No description provided for @coinStockSortTitle.
  ///
  /// In zh, this message translates to:
  /// **'筛选 & 排序'**
  String get coinStockSortTitle;

  /// No description provided for @coinStockSortMetricLabel.
  ///
  /// In zh, this message translates to:
  /// **'指标'**
  String get coinStockSortMetricLabel;

  /// No description provided for @coinStockSortDirectionLabel.
  ///
  /// In zh, this message translates to:
  /// **'排序方式'**
  String get coinStockSortDirectionLabel;

  /// No description provided for @coinStockSortAsc.
  ///
  /// In zh, this message translates to:
  /// **'升序'**
  String get coinStockSortAsc;

  /// No description provided for @coinStockSortDesc.
  ///
  /// In zh, this message translates to:
  /// **'降序'**
  String get coinStockSortDesc;

  /// No description provided for @coinStockSortNone.
  ///
  /// In zh, this message translates to:
  /// **'不排序'**
  String get coinStockSortNone;

  /// No description provided for @coinStockSortApply.
  ///
  /// In zh, this message translates to:
  /// **'查看 {count} 个结果'**
  String coinStockSortApply(int count);

  /// No description provided for @coinStockDetailPrice.
  ///
  /// In zh, this message translates to:
  /// **'当前股价 · USD'**
  String get coinStockDetailPrice;

  /// No description provided for @coinStockDetailOverview.
  ///
  /// In zh, this message translates to:
  /// **'公司概况'**
  String get coinStockDetailOverview;

  /// No description provided for @coinStockDetailMetrics.
  ///
  /// In zh, this message translates to:
  /// **'核心指标'**
  String get coinStockDetailMetrics;

  /// No description provided for @coinStockChipListed.
  ///
  /// In zh, this message translates to:
  /// **'上市'**
  String get coinStockChipListed;

  /// No description provided for @coinStockChipRelated.
  ///
  /// In zh, this message translates to:
  /// **'关联'**
  String get coinStockChipRelated;

  /// No description provided for @aggModeFutures.
  ///
  /// In zh, this message translates to:
  /// **'合约'**
  String get aggModeFutures;

  /// No description provided for @aggModeSpot.
  ///
  /// In zh, this message translates to:
  /// **'现货'**
  String get aggModeSpot;

  /// No description provided for @aggStat24hVolume.
  ///
  /// In zh, this message translates to:
  /// **'24h 成交量'**
  String get aggStat24hVolume;

  /// No description provided for @aggStat24hTurnover.
  ///
  /// In zh, this message translates to:
  /// **'24h 成交额'**
  String get aggStat24hTurnover;

  /// No description provided for @aggOrderbookTitle.
  ///
  /// In zh, this message translates to:
  /// **'{coin}/USD 实时订单({mode})'**
  String aggOrderbookTitle(String coin, String mode);

  /// No description provided for @aggColPrice.
  ///
  /// In zh, this message translates to:
  /// **'价格(USDT)'**
  String get aggColPrice;

  /// No description provided for @aggColQty.
  ///
  /// In zh, this message translates to:
  /// **'数量({coin})'**
  String aggColQty(String coin);

  /// No description provided for @aggColTotal.
  ///
  /// In zh, this message translates to:
  /// **'总计({coin})'**
  String aggColTotal(String coin);

  /// No description provided for @aggViewBoth.
  ///
  /// In zh, this message translates to:
  /// **'双向'**
  String get aggViewBoth;

  /// No description provided for @aggViewAsks.
  ///
  /// In zh, this message translates to:
  /// **'卖单'**
  String get aggViewAsks;

  /// No description provided for @aggViewBids.
  ///
  /// In zh, this message translates to:
  /// **'买单'**
  String get aggViewBids;

  /// No description provided for @aggBestBidAsk.
  ///
  /// In zh, this message translates to:
  /// **'买一 / 卖一'**
  String get aggBestBidAsk;

  /// No description provided for @aggPrecisionTitle.
  ///
  /// In zh, this message translates to:
  /// **'价格精度'**
  String get aggPrecisionTitle;

  /// No description provided for @aggExchangeSourceTitle.
  ///
  /// In zh, this message translates to:
  /// **'交易所来源'**
  String get aggExchangeSourceTitle;

  /// No description provided for @aggExchangeSourceTooltip.
  ///
  /// In zh, this message translates to:
  /// **'交易所来源设置'**
  String get aggExchangeSourceTooltip;

  /// No description provided for @aggSelectAll.
  ///
  /// In zh, this message translates to:
  /// **'全选'**
  String get aggSelectAll;

  /// No description provided for @aggClearAll.
  ///
  /// In zh, this message translates to:
  /// **'清空'**
  String get aggClearAll;

  /// No description provided for @aggCancel.
  ///
  /// In zh, this message translates to:
  /// **'取消'**
  String get aggCancel;

  /// No description provided for @aggDepthTitle.
  ///
  /// In zh, this message translates to:
  /// **'订单深度'**
  String get aggDepthTitle;

  /// No description provided for @aggLiquidityHeatmap.
  ///
  /// In zh, this message translates to:
  /// **'流动性热力图'**
  String get aggLiquidityHeatmap;

  /// No description provided for @aggDepthLegendBids.
  ///
  /// In zh, this message translates to:
  /// **'买单累计'**
  String get aggDepthLegendBids;

  /// No description provided for @aggDepthLegendAsks.
  ///
  /// In zh, this message translates to:
  /// **'卖单累计'**
  String get aggDepthLegendAsks;

  /// No description provided for @aggUnit.
  ///
  /// In zh, this message translates to:
  /// **'单位: {coin}'**
  String aggUnit(String coin);

  /// No description provided for @aggOiColExchange.
  ///
  /// In zh, this message translates to:
  /// **'交易所'**
  String get aggOiColExchange;

  /// No description provided for @aggOiColShare.
  ///
  /// In zh, this message translates to:
  /// **'占比'**
  String get aggOiColShare;

  /// No description provided for @aggOiColPosition.
  ///
  /// In zh, this message translates to:
  /// **'持仓'**
  String get aggOiColPosition;

  /// No description provided for @aggOiCol24hChange.
  ///
  /// In zh, this message translates to:
  /// **'24H变化'**
  String get aggOiCol24hChange;

  /// No description provided for @aggOiRowAll.
  ///
  /// In zh, this message translates to:
  /// **'全部'**
  String get aggOiRowAll;

  /// No description provided for @aggCoinSearchHint.
  ///
  /// In zh, this message translates to:
  /// **'搜索币种'**
  String get aggCoinSearchHint;

  /// No description provided for @aggCoinSearchHot.
  ///
  /// In zh, this message translates to:
  /// **'热门币种'**
  String get aggCoinSearchHot;

  /// No description provided for @aggCoinSearchEmpty.
  ///
  /// In zh, this message translates to:
  /// **'无匹配币种'**
  String get aggCoinSearchEmpty;

  /// No description provided for @aggNoData.
  ///
  /// In zh, this message translates to:
  /// **'暂无数据'**
  String get aggNoData;

  /// No description provided for @aggNoMatchExchange.
  ///
  /// In zh, this message translates to:
  /// **'无匹配交易所'**
  String get aggNoMatchExchange;

  /// No description provided for @aggVolumeTotal.
  ///
  /// In zh, this message translates to:
  /// **'总计'**
  String get aggVolumeTotal;

  /// No description provided for @tradesTabLatest.
  ///
  /// In zh, this message translates to:
  /// **'最新成交'**
  String get tradesTabLatest;

  /// No description provided for @tradesTabBig.
  ///
  /// In zh, this message translates to:
  /// **'大额成交'**
  String get tradesTabBig;

  /// No description provided for @tradesSortTooltip.
  ///
  /// In zh, this message translates to:
  /// **'排序'**
  String get tradesSortTooltip;

  /// No description provided for @marketDetailStarTooltip.
  ///
  /// In zh, this message translates to:
  /// **'收藏'**
  String get marketDetailStarTooltip;

  /// No description provided for @marketDetailMoreTooltip.
  ///
  /// In zh, this message translates to:
  /// **'更多'**
  String get marketDetailMoreTooltip;

  /// No description provided for @marketDetailFavoriteAddedToast.
  ///
  /// In zh, this message translates to:
  /// **'已加入自选'**
  String get marketDetailFavoriteAddedToast;

  /// No description provided for @marketDetailFavoriteRemovedToast.
  ///
  /// In zh, this message translates to:
  /// **'已移出自选'**
  String get marketDetailFavoriteRemovedToast;

  /// No description provided for @marketDetailMoreSheetTitle.
  ///
  /// In zh, this message translates to:
  /// **'更多操作'**
  String get marketDetailMoreSheetTitle;

  /// No description provided for @marketDetailMoreCopySymbol.
  ///
  /// In zh, this message translates to:
  /// **'复制交易对'**
  String get marketDetailMoreCopySymbol;

  /// No description provided for @marketDetailMoreCopiedToast.
  ///
  /// In zh, this message translates to:
  /// **'已复制交易对'**
  String get marketDetailMoreCopiedToast;

  /// No description provided for @marketDetailMoreShare.
  ///
  /// In zh, this message translates to:
  /// **'分享'**
  String get marketDetailMoreShare;

  /// No description provided for @marketDetailMoreAlert.
  ///
  /// In zh, this message translates to:
  /// **'价格提醒'**
  String get marketDetailMoreAlert;

  /// No description provided for @marketDetailMoreSwitchExchange.
  ///
  /// In zh, this message translates to:
  /// **'切换交易所'**
  String get marketDetailMoreSwitchExchange;

  /// No description provided for @marketDetailMoreComingSoon.
  ///
  /// In zh, this message translates to:
  /// **'即将上线'**
  String get marketDetailMoreComingSoon;

  /// No description provided for @tradeOrderSheetTabLimit.
  ///
  /// In zh, this message translates to:
  /// **'限价'**
  String get tradeOrderSheetTabLimit;

  /// No description provided for @tradeOrderSheetTabMarket.
  ///
  /// In zh, this message translates to:
  /// **'市价'**
  String get tradeOrderSheetTabMarket;

  /// No description provided for @tradeOrderSheetTabConditional.
  ///
  /// In zh, this message translates to:
  /// **'条件委托'**
  String get tradeOrderSheetTabConditional;

  /// No description provided for @tradeOrderSheetMarginCross.
  ///
  /// In zh, this message translates to:
  /// **'全仓'**
  String get tradeOrderSheetMarginCross;

  /// No description provided for @tradeOrderSheetMarginIsolated.
  ///
  /// In zh, this message translates to:
  /// **'逐仓'**
  String get tradeOrderSheetMarginIsolated;

  /// No description provided for @tradeOrderSheetFieldPrice.
  ///
  /// In zh, this message translates to:
  /// **'价格'**
  String get tradeOrderSheetFieldPrice;

  /// No description provided for @tradeOrderSheetFieldAmount.
  ///
  /// In zh, this message translates to:
  /// **'数量'**
  String get tradeOrderSheetFieldAmount;

  /// No description provided for @tradeOrderSheetFieldTriggerPrice.
  ///
  /// In zh, this message translates to:
  /// **'触发价'**
  String get tradeOrderSheetFieldTriggerPrice;

  /// No description provided for @tradeOrderSheetFieldTakeProfit.
  ///
  /// In zh, this message translates to:
  /// **'止盈价'**
  String get tradeOrderSheetFieldTakeProfit;

  /// No description provided for @tradeOrderSheetFieldStopLoss.
  ///
  /// In zh, this message translates to:
  /// **'止损价'**
  String get tradeOrderSheetFieldStopLoss;

  /// No description provided for @tradeOrderSheetMarketPriceHint.
  ///
  /// In zh, this message translates to:
  /// **'市价'**
  String get tradeOrderSheetMarketPriceHint;

  /// No description provided for @tradeOrderSheetLeverageLabel.
  ///
  /// In zh, this message translates to:
  /// **'杠杆'**
  String get tradeOrderSheetLeverageLabel;

  /// No description provided for @tradeOrderSheetEstLiqPrice.
  ///
  /// In zh, this message translates to:
  /// **'预计强平价'**
  String get tradeOrderSheetEstLiqPrice;

  /// No description provided for @tradeOrderSheetEstLiqPlaceholder.
  ///
  /// In zh, this message translates to:
  /// **'—'**
  String get tradeOrderSheetEstLiqPlaceholder;

  /// No description provided for @tradeOrderSheetErrorPriceRequired.
  ///
  /// In zh, this message translates to:
  /// **'请输入有效的价格'**
  String get tradeOrderSheetErrorPriceRequired;

  /// No description provided for @tradeOrderSheetErrorAmountRequired.
  ///
  /// In zh, this message translates to:
  /// **'请输入有效的数量'**
  String get tradeOrderSheetErrorAmountRequired;

  /// No description provided for @tradeOrderSheetErrorTriggerRequired.
  ///
  /// In zh, this message translates to:
  /// **'请输入有效的触发价'**
  String get tradeOrderSheetErrorTriggerRequired;

  /// No description provided for @tradeOrderSheetSubmitBuyPrefix.
  ///
  /// In zh, this message translates to:
  /// **'买入 '**
  String get tradeOrderSheetSubmitBuyPrefix;

  /// No description provided for @tradeOrderSheetSubmitSellPrefix.
  ///
  /// In zh, this message translates to:
  /// **'卖出 '**
  String get tradeOrderSheetSubmitSellPrefix;

  /// No description provided for @tradeOrderSheetSuccessToast.
  ///
  /// In zh, this message translates to:
  /// **'下单成功'**
  String get tradeOrderSheetSuccessToast;

  /// No description provided for @tradeOrderSheetHeaderTitleBuy.
  ///
  /// In zh, this message translates to:
  /// **'买入 / 做多 {symbol}'**
  String tradeOrderSheetHeaderTitleBuy(Object symbol);

  /// No description provided for @tradeOrderSheetHeaderTitleSell.
  ///
  /// In zh, this message translates to:
  /// **'卖出 / 做空 {symbol}'**
  String tradeOrderSheetHeaderTitleSell(Object symbol);

  /// No description provided for @tradeOrderSheetHeaderSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'{pair} · 永续 · {exchange}'**
  String tradeOrderSheetHeaderSubtitle(Object pair, Object exchange);

  /// No description provided for @tradeOrderSheetCloseTooltip.
  ///
  /// In zh, this message translates to:
  /// **'关闭'**
  String get tradeOrderSheetCloseTooltip;

  /// No description provided for @tradeOrderSheetLeverageGridTitle.
  ///
  /// In zh, this message translates to:
  /// **'选择杠杆倍数'**
  String get tradeOrderSheetLeverageGridTitle;

  /// No description provided for @tradeOrderSheetReferenceLatest.
  ///
  /// In zh, this message translates to:
  /// **'最新'**
  String get tradeOrderSheetReferenceLatest;

  /// No description provided for @tradeOrderSheetReferenceBid1.
  ///
  /// In zh, this message translates to:
  /// **'买一'**
  String get tradeOrderSheetReferenceBid1;

  /// No description provided for @tradeOrderSheetReferenceAsk1.
  ///
  /// In zh, this message translates to:
  /// **'卖一'**
  String get tradeOrderSheetReferenceAsk1;

  /// No description provided for @tradeOrderSheetAvailableLabel.
  ///
  /// In zh, this message translates to:
  /// **'可用 {amount} USDT'**
  String tradeOrderSheetAvailableLabel(Object amount);

  /// No description provided for @tradeOrderSheetMarketHintPrefix.
  ///
  /// In zh, this message translates to:
  /// **'市价立即成交 · 参考价 '**
  String get tradeOrderSheetMarketHintPrefix;

  /// No description provided for @tradeOrderSheetMarketHintSuffix.
  ///
  /// In zh, this message translates to:
  /// **' USDT'**
  String get tradeOrderSheetMarketHintSuffix;

  /// No description provided for @tradeOrderSheetTpsl.
  ///
  /// In zh, this message translates to:
  /// **'止盈 / 止损'**
  String get tradeOrderSheetTpsl;

  /// No description provided for @tradeOrderSheetStatMargin.
  ///
  /// In zh, this message translates to:
  /// **'保证金'**
  String get tradeOrderSheetStatMargin;

  /// No description provided for @tradeOrderSheetStatNotional.
  ///
  /// In zh, this message translates to:
  /// **'名义价值'**
  String get tradeOrderSheetStatNotional;

  /// No description provided for @tradeOrderSheetStatFee.
  ///
  /// In zh, this message translates to:
  /// **'手续费 (taker)'**
  String get tradeOrderSheetStatFee;

  /// No description provided for @tradeOrderSheetStatTpReturn.
  ///
  /// In zh, this message translates to:
  /// **'止盈预计收益'**
  String get tradeOrderSheetStatTpReturn;

  /// No description provided for @tradeOrderSheetStatSlLoss.
  ///
  /// In zh, this message translates to:
  /// **'止损预计损失'**
  String get tradeOrderSheetStatSlLoss;

  /// No description provided for @tradeOrderSheetRiskHint.
  ///
  /// In zh, this message translates to:
  /// **'提交后由 AI 风控自动检查仓位与最大回撤'**
  String get tradeOrderSheetRiskHint;

  /// No description provided for @tradeOrderSheetSubmitEmpty.
  ///
  /// In zh, this message translates to:
  /// **'请选择数量'**
  String get tradeOrderSheetSubmitEmpty;

  /// No description provided for @tradeOrderSheetSubmitting.
  ///
  /// In zh, this message translates to:
  /// **'提交中…'**
  String get tradeOrderSheetSubmitting;

  /// No description provided for @tradeOrderSheetSubmitConfirmBuy.
  ///
  /// In zh, this message translates to:
  /// **'确认买入 {amount} {base}'**
  String tradeOrderSheetSubmitConfirmBuy(Object amount, Object base);

  /// No description provided for @tradeOrderSheetSubmitConfirmSell.
  ///
  /// In zh, this message translates to:
  /// **'确认卖出 {amount} {base}'**
  String tradeOrderSheetSubmitConfirmSell(Object amount, Object base);

  /// No description provided for @orderbookLoadError.
  ///
  /// In zh, this message translates to:
  /// **'盘口加载失败'**
  String get orderbookLoadError;

  /// No description provided for @meHomeLoadErrorPrefix.
  ///
  /// In zh, this message translates to:
  /// **'加载失败：'**
  String get meHomeLoadErrorPrefix;

  /// No description provided for @meStatsActiveStrategies.
  ///
  /// In zh, this message translates to:
  /// **'活跃策略'**
  String get meStatsActiveStrategies;

  /// No description provided for @meStatsCumulativeReturn.
  ///
  /// In zh, this message translates to:
  /// **'累计收益'**
  String get meStatsCumulativeReturn;

  /// No description provided for @meStatsWinRate.
  ///
  /// In zh, this message translates to:
  /// **'胜率'**
  String get meStatsWinRate;

  /// No description provided for @meHeaderCopyUid.
  ///
  /// In zh, this message translates to:
  /// **'复制 UID'**
  String get meHeaderCopyUid;

  /// No description provided for @meHeaderUidCopied.
  ///
  /// In zh, this message translates to:
  /// **'UID 已复制'**
  String get meHeaderUidCopied;

  /// No description provided for @meHeaderTelegramBound.
  ///
  /// In zh, this message translates to:
  /// **'Telegram 已绑定'**
  String get meHeaderTelegramBound;

  /// No description provided for @meHeaderBinanceConnected.
  ///
  /// In zh, this message translates to:
  /// **'Binance ✓'**
  String get meHeaderBinanceConnected;

  /// No description provided for @meSectionAccount.
  ///
  /// In zh, this message translates to:
  /// **'账户'**
  String get meSectionAccount;

  /// No description provided for @meSectionApi.
  ///
  /// In zh, this message translates to:
  /// **'交易所 API'**
  String get meSectionApi;

  /// No description provided for @meSectionPreferences.
  ///
  /// In zh, this message translates to:
  /// **'偏好'**
  String get meSectionPreferences;

  /// No description provided for @meSettingsTelegram.
  ///
  /// In zh, this message translates to:
  /// **'Telegram'**
  String get meSettingsTelegram;

  /// No description provided for @meSettingsTelegramUnbound.
  ///
  /// In zh, this message translates to:
  /// **'未绑定'**
  String get meSettingsTelegramUnbound;

  /// No description provided for @meSettingsTelegramHandle.
  ///
  /// In zh, this message translates to:
  /// **'@victor_qf'**
  String get meSettingsTelegramHandle;

  /// No description provided for @meSettingsSecurity.
  ///
  /// In zh, this message translates to:
  /// **'安全设置'**
  String get meSettingsSecurity;

  /// No description provided for @meSettingsSecurityValue.
  ///
  /// In zh, this message translates to:
  /// **'双重认证 · 已开启'**
  String get meSettingsSecurityValue;

  /// No description provided for @meSettingsNotConfigured.
  ///
  /// In zh, this message translates to:
  /// **'未配置'**
  String get meSettingsNotConfigured;

  /// No description provided for @meSettingsLanguage.
  ///
  /// In zh, this message translates to:
  /// **'语言'**
  String get meSettingsLanguage;

  /// No description provided for @meSettingsLanguageValue.
  ///
  /// In zh, this message translates to:
  /// **'简体中文'**
  String get meSettingsLanguageValue;

  /// No description provided for @meSettingsLanguageSheetTitle.
  ///
  /// In zh, this message translates to:
  /// **'语言'**
  String get meSettingsLanguageSheetTitle;

  /// No description provided for @meSettingsLanguageOptionZh.
  ///
  /// In zh, this message translates to:
  /// **'简体中文'**
  String get meSettingsLanguageOptionZh;

  /// No description provided for @meSettingsLanguageOptionEn.
  ///
  /// In zh, this message translates to:
  /// **'English'**
  String get meSettingsLanguageOptionEn;

  /// No description provided for @meSettingsTheme.
  ///
  /// In zh, this message translates to:
  /// **'主题'**
  String get meSettingsTheme;

  /// No description provided for @meSettingsThemeValue.
  ///
  /// In zh, this message translates to:
  /// **'跟随系统'**
  String get meSettingsThemeValue;

  /// No description provided for @meSettingsNotifications.
  ///
  /// In zh, this message translates to:
  /// **'推送通知'**
  String get meSettingsNotifications;

  /// No description provided for @meSettingsNotificationsValue.
  ///
  /// In zh, this message translates to:
  /// **'Telegram · 开启'**
  String get meSettingsNotificationsValue;

  /// No description provided for @meLogout.
  ///
  /// In zh, this message translates to:
  /// **'退出登录'**
  String get meLogout;

  /// No description provided for @meApiSettingsTitle.
  ///
  /// In zh, this message translates to:
  /// **'交易所 API'**
  String get meApiSettingsTitle;

  /// No description provided for @meApiConnected.
  ///
  /// In zh, this message translates to:
  /// **'已连接 · 读取 + 下单'**
  String get meApiConnected;

  /// No description provided for @meApiNotConfigured.
  ///
  /// In zh, this message translates to:
  /// **'未配置 · 部署策略前请配置'**
  String get meApiNotConfigured;

  /// No description provided for @meApiManage.
  ///
  /// In zh, this message translates to:
  /// **'管理'**
  String get meApiManage;

  /// No description provided for @meApiConnect.
  ///
  /// In zh, this message translates to:
  /// **'连接'**
  String get meApiConnect;

  /// No description provided for @meApiLoadErrorPrefix.
  ///
  /// In zh, this message translates to:
  /// **'加载失败：'**
  String get meApiLoadErrorPrefix;

  /// No description provided for @meApiFormPermissionHint.
  ///
  /// In zh, this message translates to:
  /// **'仅保留读取 + 下单权限'**
  String get meApiFormPermissionHint;

  /// No description provided for @meApiFormPermissionSection.
  ///
  /// In zh, this message translates to:
  /// **'授权权限'**
  String get meApiFormPermissionSection;

  /// No description provided for @meApiFormPermAccountRead.
  ///
  /// In zh, this message translates to:
  /// **'读取账户与持仓'**
  String get meApiFormPermAccountRead;

  /// No description provided for @meApiFormPermSpotOrder.
  ///
  /// In zh, this message translates to:
  /// **'现货下单'**
  String get meApiFormPermSpotOrder;

  /// No description provided for @meApiFormPermFuturesOrder.
  ///
  /// In zh, this message translates to:
  /// **'合约下单'**
  String get meApiFormPermFuturesOrder;

  /// No description provided for @meApiFormPermRequired.
  ///
  /// In zh, this message translates to:
  /// **'必需'**
  String get meApiFormPermRequired;

  /// No description provided for @meApiFormPermOptional.
  ///
  /// In zh, this message translates to:
  /// **'可选'**
  String get meApiFormPermOptional;

  /// No description provided for @meApiFormPermWithdrawLabel.
  ///
  /// In zh, this message translates to:
  /// **'提币'**
  String get meApiFormPermWithdrawLabel;

  /// No description provided for @meApiFormPermWithdrawValue.
  ///
  /// In zh, this message translates to:
  /// **'必须关闭'**
  String get meApiFormPermWithdrawValue;

  /// No description provided for @meApiFormWarningMust.
  ///
  /// In zh, this message translates to:
  /// **'必须 '**
  String get meApiFormWarningMust;

  /// No description provided for @meApiFormWarningBody.
  ///
  /// In zh, this message translates to:
  /// **'在 {exchange} 后台关闭「提币」权限。服务端会再校验一次，发现允许提币的密钥会立即拒绝。'**
  String meApiFormWarningBody(String exchange);

  /// No description provided for @meApiFormLabelNote.
  ///
  /// In zh, this message translates to:
  /// **'备注'**
  String get meApiFormLabelNote;

  /// No description provided for @meApiFormSaveButton.
  ///
  /// In zh, this message translates to:
  /// **'验证并保存'**
  String get meApiFormSaveButton;

  /// No description provided for @meApiFormDefaultLabel.
  ///
  /// In zh, this message translates to:
  /// **'默认'**
  String get meApiFormDefaultLabel;

  /// No description provided for @meApiFormSaveFailedPrefix.
  ///
  /// In zh, this message translates to:
  /// **'保存失败：'**
  String get meApiFormSaveFailedPrefix;

  /// No description provided for @meApiFormSaveFailed.
  ///
  /// In zh, this message translates to:
  /// **'保存失败，请稍后重试'**
  String get meApiFormSaveFailed;

  /// No description provided for @meApiFormApiKeyLabel.
  ///
  /// In zh, this message translates to:
  /// **'API Key'**
  String get meApiFormApiKeyLabel;

  /// No description provided for @meApiFormSecretLabel.
  ///
  /// In zh, this message translates to:
  /// **'Secret'**
  String get meApiFormSecretLabel;

  /// No description provided for @meApiFormNoteTooLong.
  ///
  /// In zh, this message translates to:
  /// **'备注最多 30 字'**
  String get meApiFormNoteTooLong;

  /// No description provided for @meApiFormPleaseEnter.
  ///
  /// In zh, this message translates to:
  /// **'请输入'**
  String get meApiFormPleaseEnter;

  /// No description provided for @meApiFormMinLenSuffix.
  ///
  /// In zh, this message translates to:
  /// **' 位'**
  String get meApiFormMinLenSuffix;

  /// No description provided for @meApiFormMinLenInfix.
  ///
  /// In zh, this message translates to:
  /// **' 至少 '**
  String get meApiFormMinLenInfix;

  /// No description provided for @meApiFormSecretKeyLabel.
  ///
  /// In zh, this message translates to:
  /// **'Secret Key'**
  String get meApiFormSecretKeyLabel;

  /// No description provided for @meApiFormPassphraseLabel.
  ///
  /// In zh, this message translates to:
  /// **'Passphrase'**
  String get meApiFormPassphraseLabel;

  /// No description provided for @meApiFormPassphraseHint.
  ///
  /// In zh, this message translates to:
  /// **'创建 API Key 时由你自行设置的口令，交易所不会再次展示。三项缺一不可，否则无法签名下单。'**
  String get meApiFormPassphraseHint;

  /// No description provided for @meApiFormWalletAddressLabel.
  ///
  /// In zh, this message translates to:
  /// **'主钱包地址'**
  String get meApiFormWalletAddressLabel;

  /// No description provided for @meApiFormAgentKeyLabel.
  ///
  /// In zh, this message translates to:
  /// **'Agent 私钥'**
  String get meApiFormAgentKeyLabel;

  /// No description provided for @meApiFormWalletHint.
  ///
  /// In zh, this message translates to:
  /// **'在 Hyperliquid → More → API 中生成 Agent Wallet，把它的私钥粘到这里。Agent 私钥只能下单、不能动资产；主钱包地址用于读取持仓。'**
  String get meApiFormWalletHint;

  /// No description provided for @meApiFormWalletWarningMust.
  ///
  /// In zh, this message translates to:
  /// **'Agent 钱包'**
  String get meApiFormWalletWarningMust;

  /// No description provided for @meApiFormWalletWarningBody.
  ///
  /// In zh, this message translates to:
  /// **'仅有下单权限，永远无法转账或提币——主钱包资产始终由你掌控。请勿粘贴主钱包私钥。'**
  String get meApiFormWalletWarningBody;

  /// No description provided for @meApiFormPermPerpSpotOrder.
  ///
  /// In zh, this message translates to:
  /// **'永续 / 现货下单'**
  String get meApiFormPermPerpSpotOrder;

  /// No description provided for @meApiFormPermTransferWithdraw.
  ///
  /// In zh, this message translates to:
  /// **'转账 / 提币'**
  String get meApiFormPermTransferWithdraw;

  /// No description provided for @meApiFormPermAgentNoAccess.
  ///
  /// In zh, this message translates to:
  /// **'Agent 无权限'**
  String get meApiFormPermAgentNoAccess;

  /// No description provided for @meApiFormEnvLabel.
  ///
  /// In zh, this message translates to:
  /// **'环境'**
  String get meApiFormEnvLabel;

  /// No description provided for @meApiFormEnvMainnetLabel.
  ///
  /// In zh, this message translates to:
  /// **'主网'**
  String get meApiFormEnvMainnetLabel;

  /// No description provided for @meApiFormEnvMainnetSub.
  ///
  /// In zh, this message translates to:
  /// **'真实资金'**
  String get meApiFormEnvMainnetSub;

  /// No description provided for @meApiFormEnvTestnetLabel.
  ///
  /// In zh, this message translates to:
  /// **'测试网'**
  String get meApiFormEnvTestnetLabel;

  /// No description provided for @meApiFormEnvTestnetSub.
  ///
  /// In zh, this message translates to:
  /// **'模拟资金'**
  String get meApiFormEnvTestnetSub;

  /// No description provided for @meApiFormTestnetSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'测试网 · 模拟资金 · 不影响真实账户'**
  String get meApiFormTestnetSubtitle;

  /// No description provided for @meApiFormTestnetWarningBold.
  ///
  /// In zh, this message translates to:
  /// **'请前往 testnet.binance.vision '**
  String get meApiFormTestnetWarningBold;

  /// No description provided for @meApiFormTestnetWarningBody.
  ///
  /// In zh, this message translates to:
  /// **'申请独立的测试网密钥（主网密钥不可用）。测试网币每 24h 自动重置，可放心调试策略。'**
  String get meApiFormTestnetWarningBody;

  /// No description provided for @meApiFormEndpointLabel.
  ///
  /// In zh, this message translates to:
  /// **'接口域名'**
  String get meApiFormEndpointLabel;

  /// No description provided for @meApiFormPermWithdrawTestnetValue.
  ///
  /// In zh, this message translates to:
  /// **'测试网无提币'**
  String get meApiFormPermWithdrawTestnetValue;

  /// No description provided for @meApiFormSaveTestnetButton.
  ///
  /// In zh, this message translates to:
  /// **'保存测试网密钥'**
  String get meApiFormSaveTestnetButton;

  /// No description provided for @themeSettingsTitle.
  ///
  /// In zh, this message translates to:
  /// **'界面主题'**
  String get themeSettingsTitle;

  /// No description provided for @themeSettingsSyncSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'此设置会同步到 Web 和 App'**
  String get themeSettingsSyncSubtitle;

  /// No description provided for @themeSettingsSyncFootnote.
  ///
  /// In zh, this message translates to:
  /// **'当前主题仅保存在本设备；接入账号同步后，将在 Web 与 App 之间随登录自动应用。'**
  String get themeSettingsSyncFootnote;

  /// No description provided for @themeBgSection.
  ///
  /// In zh, this message translates to:
  /// **'背景主题'**
  String get themeBgSection;

  /// No description provided for @themeAccentSection.
  ///
  /// In zh, this message translates to:
  /// **'强调色'**
  String get themeAccentSection;

  /// No description provided for @themeBgDark.
  ///
  /// In zh, this message translates to:
  /// **'暗色'**
  String get themeBgDark;

  /// No description provided for @themeBgPink.
  ///
  /// In zh, this message translates to:
  /// **'粉红'**
  String get themeBgPink;

  /// No description provided for @themeBgLight.
  ///
  /// In zh, this message translates to:
  /// **'白色'**
  String get themeBgLight;

  /// No description provided for @themeAccentViolet.
  ///
  /// In zh, this message translates to:
  /// **'粉紫'**
  String get themeAccentViolet;

  /// No description provided for @themeAccentCyan.
  ///
  /// In zh, this message translates to:
  /// **'青蓝'**
  String get themeAccentCyan;

  /// No description provided for @themeAccentAmber.
  ///
  /// In zh, this message translates to:
  /// **'琥珀'**
  String get themeAccentAmber;

  /// No description provided for @themePreviewTitle.
  ///
  /// In zh, this message translates to:
  /// **'预览 · AI 策略助手'**
  String get themePreviewTitle;

  /// No description provided for @themePreviewIdentified.
  ///
  /// In zh, this message translates to:
  /// **'已识别为「趋势跟踪」策略'**
  String get themePreviewIdentified;

  /// No description provided for @themePreviewStartBacktest.
  ///
  /// In zh, this message translates to:
  /// **'开始回测'**
  String get themePreviewStartBacktest;

  /// No description provided for @aiConfirmStrategy.
  ///
  /// In zh, this message translates to:
  /// **'确认策略'**
  String get aiConfirmStrategy;

  /// No description provided for @aiConfirmSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'检查参数无误后开始回测'**
  String get aiConfirmSubtitle;

  /// No description provided for @aiStepConfirm.
  ///
  /// In zh, this message translates to:
  /// **'确认策略'**
  String get aiStepConfirm;

  /// No description provided for @aiStepScript.
  ///
  /// In zh, this message translates to:
  /// **'策略脚本'**
  String get aiStepScript;

  /// No description provided for @aiStepBacktestConfig.
  ///
  /// In zh, this message translates to:
  /// **'回测设置'**
  String get aiStepBacktestConfig;

  /// No description provided for @aiStepBacktest.
  ///
  /// In zh, this message translates to:
  /// **'回测'**
  String get aiStepBacktest;

  /// No description provided for @aiStepDeploy.
  ///
  /// In zh, this message translates to:
  /// **'部署'**
  String get aiStepDeploy;

  /// No description provided for @aiConfirmCancel.
  ///
  /// In zh, this message translates to:
  /// **'取消'**
  String get aiConfirmCancel;

  /// No description provided for @aiConfirmHeroSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'由当前对话生成 · 可在对话中继续微调'**
  String get aiConfirmHeroSubtitle;

  /// No description provided for @aiConfirmLogicTitle.
  ///
  /// In zh, this message translates to:
  /// **'策略逻辑'**
  String get aiConfirmLogicTitle;

  /// No description provided for @aiConfirmEditInChat.
  ///
  /// In zh, this message translates to:
  /// **'在对话中修改'**
  String get aiConfirmEditInChat;

  /// No description provided for @aiConfirmRuleIf.
  ///
  /// In zh, this message translates to:
  /// **'IF'**
  String get aiConfirmRuleIf;

  /// No description provided for @aiConfirmRuleThen.
  ///
  /// In zh, this message translates to:
  /// **'THEN'**
  String get aiConfirmRuleThen;

  /// No description provided for @aiConfirmRuleSep.
  ///
  /// In zh, this message translates to:
  /// **'AND AT THEN'**
  String get aiConfirmRuleSep;

  /// No description provided for @aiConfirmExecuteTitle.
  ///
  /// In zh, this message translates to:
  /// **'EXECUTE'**
  String get aiConfirmExecuteTitle;

  /// No description provided for @aiConfirmExecExchange.
  ///
  /// In zh, this message translates to:
  /// **'交易所'**
  String get aiConfirmExecExchange;

  /// No description provided for @aiConfirmExecSymbol.
  ///
  /// In zh, this message translates to:
  /// **'标的'**
  String get aiConfirmExecSymbol;

  /// No description provided for @aiConfirmExecPeriod.
  ///
  /// In zh, this message translates to:
  /// **'周期'**
  String get aiConfirmExecPeriod;

  /// No description provided for @aiConfirmExecPosition.
  ///
  /// In zh, this message translates to:
  /// **'仓位'**
  String get aiConfirmExecPosition;

  /// No description provided for @aiConfirmExecMarket.
  ///
  /// In zh, this message translates to:
  /// **'市场'**
  String get aiConfirmExecMarket;

  /// No description provided for @aiConfirmRiskBadge.
  ///
  /// In zh, this message translates to:
  /// **'风控'**
  String get aiConfirmRiskBadge;

  /// No description provided for @aiConfirmAdviceTitle.
  ///
  /// In zh, this message translates to:
  /// **'AI 提示'**
  String get aiConfirmAdviceTitle;

  /// No description provided for @aiConfirmDisclaimer.
  ///
  /// In zh, this message translates to:
  /// **'回测基于历史数据，无法保证实盘表现。部署前请使用模拟账户验证。'**
  String get aiConfirmDisclaimer;

  /// No description provided for @aiConfirmBackToChat.
  ///
  /// In zh, this message translates to:
  /// **'返回对话'**
  String get aiConfirmBackToChat;

  /// No description provided for @aiConfirmNextScript.
  ///
  /// In zh, this message translates to:
  /// **'下一步：策略脚本'**
  String get aiConfirmNextScript;

  /// No description provided for @aiStartBacktestPrompt.
  ///
  /// In zh, this message translates to:
  /// **'需要我开始回测吗?'**
  String get aiStartBacktestPrompt;

  /// 参数气泡分类 chip 前缀，对齐设计稿 ScreenAIChat「已为你识别为」（#1897）
  ///
  /// In zh, this message translates to:
  /// **'已为你识别为'**
  String get aiParamsBadgePrefix;

  /// 参数气泡分类 chip 后缀，对齐设计稿 ScreenAIChat「类策略，建议参数：」（#1897）
  ///
  /// In zh, this message translates to:
  /// **'类策略，建议参数：'**
  String get aiParamsBadgeSuffix;

  /// 已部署会话参数卡顶部的锁定横幅文案，对齐设计稿 LockedBanner（#1834 / #1897）
  ///
  /// In zh, this message translates to:
  /// **'已归档 · 仅供查看'**
  String get aiParamsLockedBanner;

  /// No description provided for @themeToggleAutoFollowSystem.
  ///
  /// In zh, this message translates to:
  /// **'自动跟随系统'**
  String get themeToggleAutoFollowSystem;

  /// No description provided for @themeToggleReduceMotion.
  ///
  /// In zh, this message translates to:
  /// **'减少动画'**
  String get themeToggleReduceMotion;

  /// No description provided for @strategyHomeTitle.
  ///
  /// In zh, this message translates to:
  /// **'策略广场'**
  String get strategyHomeTitle;

  /// No description provided for @strategyHomeSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'精选策略 · 一键载入对话'**
  String get strategyHomeSubtitle;

  /// No description provided for @strategyHomeSearchHint.
  ///
  /// In zh, this message translates to:
  /// **'搜索策略 · 币对 · 作者'**
  String get strategyHomeSearchHint;

  /// No description provided for @strategyHomeEmpty.
  ///
  /// In zh, this message translates to:
  /// **'暂无匹配策略'**
  String get strategyHomeEmpty;

  /// No description provided for @strategyHomeFavorites.
  ///
  /// In zh, this message translates to:
  /// **'收藏'**
  String get strategyHomeFavorites;

  /// No description provided for @strategyHomeFavEmptyTitle.
  ///
  /// In zh, this message translates to:
  /// **'还没有收藏的策略'**
  String get strategyHomeFavEmptyTitle;

  /// No description provided for @strategyHomeFavEmptyHint.
  ///
  /// In zh, this message translates to:
  /// **'点击策略卡右上角的 ☆ 星标，把感兴趣的策略收藏到这里。'**
  String get strategyHomeFavEmptyHint;

  /// No description provided for @strategyHomeFavEmptyCta.
  ///
  /// In zh, this message translates to:
  /// **'去策略广场看看'**
  String get strategyHomeFavEmptyCta;

  /// No description provided for @strategySearchButton.
  ///
  /// In zh, this message translates to:
  /// **'搜索'**
  String get strategySearchButton;

  /// No description provided for @strategySearchTrendingLabel.
  ///
  /// In zh, this message translates to:
  /// **'热门搜索'**
  String get strategySearchTrendingLabel;

  /// No description provided for @strategySearchHistoryLabel.
  ///
  /// In zh, this message translates to:
  /// **'搜索历史'**
  String get strategySearchHistoryLabel;

  /// No description provided for @strategySearchClearHistory.
  ///
  /// In zh, this message translates to:
  /// **'清空搜索历史'**
  String get strategySearchClearHistory;

  /// No description provided for @strategySearchGuessLabel.
  ///
  /// In zh, this message translates to:
  /// **'猜你想跟'**
  String get strategySearchGuessLabel;

  /// No description provided for @strategySearchTagSection.
  ///
  /// In zh, this message translates to:
  /// **'标签'**
  String get strategySearchTagSection;

  /// No description provided for @strategySearchAuthorSection.
  ///
  /// In zh, this message translates to:
  /// **'作者'**
  String get strategySearchAuthorSection;

  /// No description provided for @strategySearchStrategySection.
  ///
  /// In zh, this message translates to:
  /// **'策略'**
  String get strategySearchStrategySection;

  /// No description provided for @strategySearchTagChip.
  ///
  /// In zh, this message translates to:
  /// **'{tag} 策略'**
  String strategySearchTagChip(Object tag);

  /// No description provided for @strategySearchAuthorCount.
  ///
  /// In zh, this message translates to:
  /// **'{count} 个策略'**
  String strategySearchAuthorCount(int count);

  /// No description provided for @strategySearchNoResults.
  ///
  /// In zh, this message translates to:
  /// **'未找到「{query}」相关结果'**
  String strategySearchNoResults(Object query);

  /// No description provided for @strategySearchStratWinRate.
  ///
  /// In zh, this message translates to:
  /// **'胜率 {win}%'**
  String strategySearchStratWinRate(int win);

  /// No description provided for @strategySearchStratFollow.
  ///
  /// In zh, this message translates to:
  /// **'{users} 跟单'**
  String strategySearchStratFollow(int users);

  /// No description provided for @strategyCategoryTrend.
  ///
  /// In zh, this message translates to:
  /// **'趋势'**
  String get strategyCategoryTrend;

  /// No description provided for @strategyCategoryGrid.
  ///
  /// In zh, this message translates to:
  /// **'网格'**
  String get strategyCategoryGrid;

  /// No description provided for @strategyCategoryArbitrage.
  ///
  /// In zh, this message translates to:
  /// **'套利'**
  String get strategyCategoryArbitrage;

  /// No description provided for @strategyCategoryReversal.
  ///
  /// In zh, this message translates to:
  /// **'反转'**
  String get strategyCategoryReversal;

  /// No description provided for @strategyCategoryHedge.
  ///
  /// In zh, this message translates to:
  /// **'对冲'**
  String get strategyCategoryHedge;

  /// No description provided for @strategyCategoryHighFreq.
  ///
  /// In zh, this message translates to:
  /// **'高频'**
  String get strategyCategoryHighFreq;

  /// No description provided for @strategyDetailTitle.
  ///
  /// In zh, this message translates to:
  /// **'策略详情'**
  String get strategyDetailTitle;

  /// No description provided for @strategyDetailFavoriteTooltip.
  ///
  /// In zh, this message translates to:
  /// **'收藏'**
  String get strategyDetailFavoriteTooltip;

  /// No description provided for @strategyDetailCloseTooltip.
  ///
  /// In zh, this message translates to:
  /// **'关闭'**
  String get strategyDetailCloseTooltip;

  /// No description provided for @strategyDetailReturn7d.
  ///
  /// In zh, this message translates to:
  /// **'7日收益'**
  String get strategyDetailReturn7d;

  /// No description provided for @strategyDetailReturn30d.
  ///
  /// In zh, this message translates to:
  /// **'30日收益'**
  String get strategyDetailReturn30d;

  /// No description provided for @strategyDetailReturnAll.
  ///
  /// In zh, this message translates to:
  /// **'全部收益'**
  String get strategyDetailReturnAll;

  /// No description provided for @strategyDetailMaxDrawdown.
  ///
  /// In zh, this message translates to:
  /// **'最大回撤'**
  String get strategyDetailMaxDrawdown;

  /// No description provided for @strategyDetailSharpe.
  ///
  /// In zh, this message translates to:
  /// **'夏普'**
  String get strategyDetailSharpe;

  /// No description provided for @strategyDetailWinRate.
  ///
  /// In zh, this message translates to:
  /// **'胜率'**
  String get strategyDetailWinRate;

  /// No description provided for @strategyDetailEquityCurve.
  ///
  /// In zh, this message translates to:
  /// **'收益曲线'**
  String get strategyDetailEquityCurve;

  /// No description provided for @strategyDetailCurvePlaceholder.
  ///
  /// In zh, this message translates to:
  /// **'曲线占位（接入 K 线后可视化）'**
  String get strategyDetailCurvePlaceholder;

  /// No description provided for @strategyDetailRecentSignals.
  ///
  /// In zh, this message translates to:
  /// **'近期信号'**
  String get strategyDetailRecentSignals;

  /// No description provided for @strategyDetailSignalsEmpty.
  ///
  /// In zh, this message translates to:
  /// **'暂无信号'**
  String get strategyDetailSignalsEmpty;

  /// No description provided for @strategyDetailSignalsLoadError.
  ///
  /// In zh, this message translates to:
  /// **'信号加载失败'**
  String get strategyDetailSignalsLoadError;

  /// No description provided for @strategyDetailSubscribe.
  ///
  /// In zh, this message translates to:
  /// **'订阅策略'**
  String get strategyDetailSubscribe;

  /// No description provided for @strategyDetailSubscribed.
  ///
  /// In zh, this message translates to:
  /// **'已订阅 · 点击取消'**
  String get strategyDetailSubscribed;

  /// No description provided for @strategyDetailSubscribersSuffix.
  ///
  /// In zh, this message translates to:
  /// **' 订阅'**
  String get strategyDetailSubscribersSuffix;

  /// No description provided for @strategyDetailProfitLossRatio.
  ///
  /// In zh, this message translates to:
  /// **'盈亏比'**
  String get strategyDetailProfitLossRatio;

  /// No description provided for @strategyDetailTradeCount.
  ///
  /// In zh, this message translates to:
  /// **'交易次数'**
  String get strategyDetailTradeCount;

  /// No description provided for @strategyDetailUsers.
  ///
  /// In zh, this message translates to:
  /// **'使用人数'**
  String get strategyDetailUsers;

  /// No description provided for @strategyDetailDescriptionTitle.
  ///
  /// In zh, this message translates to:
  /// **'策略说明'**
  String get strategyDetailDescriptionTitle;

  /// No description provided for @strategyDetailDescriptionBody.
  ///
  /// In zh, this message translates to:
  /// **'{desc}策略基于{tag}框架，使用历史数据回测验证。建议在熟悉风险参数后再投入资金。'**
  String strategyDetailDescriptionBody(String desc, String tag);

  /// No description provided for @strategyDetailCumulativeReturn.
  ///
  /// In zh, this message translates to:
  /// **'{period} 累计收益'**
  String strategyDetailCumulativeReturn(String period);

  /// No description provided for @strategyDetailRunButton.
  ///
  /// In zh, this message translates to:
  /// **'运行'**
  String get strategyDetailRunButton;

  /// No description provided for @strategyCardLoadConversation.
  ///
  /// In zh, this message translates to:
  /// **'载入对话'**
  String get strategyCardLoadConversation;

  /// No description provided for @strategyCardRun.
  ///
  /// In zh, this message translates to:
  /// **'运行'**
  String get strategyCardRun;

  /// No description provided for @strategyDetailLoadConversation.
  ///
  /// In zh, this message translates to:
  /// **'载入到对话'**
  String get strategyDetailLoadConversation;

  /// No description provided for @strategyHomeLoadedToast.
  ///
  /// In zh, this message translates to:
  /// **'「{name}」已载入对话'**
  String strategyHomeLoadedToast(String name);

  /// No description provided for @strategyHomeStartedToast.
  ///
  /// In zh, this message translates to:
  /// **'「{name}」已启动 · 进入实盘监控'**
  String strategyHomeStartedToast(String name);

  /// No description provided for @strategyHomeFeaturedBadge.
  ///
  /// In zh, this message translates to:
  /// **'本周推荐'**
  String get strategyHomeFeaturedBadge;

  /// No description provided for @strategyHomeFeaturedSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'市场中性 · 低回撤'**
  String get strategyHomeFeaturedSubtitle;

  /// No description provided for @strategyHomeFeaturedView.
  ///
  /// In zh, this message translates to:
  /// **'查看详情'**
  String get strategyHomeFeaturedView;

  /// No description provided for @strategyHomeStatCagr.
  ///
  /// In zh, this message translates to:
  /// **'CAGR'**
  String get strategyHomeStatCagr;

  /// No description provided for @strategyHomeStatSharpe.
  ///
  /// In zh, this message translates to:
  /// **'Sharpe'**
  String get strategyHomeStatSharpe;

  /// No description provided for @strategyHomeStatDrawdown.
  ///
  /// In zh, this message translates to:
  /// **'回撤'**
  String get strategyHomeStatDrawdown;

  /// No description provided for @strategyHomeSortHot.
  ///
  /// In zh, this message translates to:
  /// **'热门'**
  String get strategyHomeSortHot;

  /// No description provided for @strategyHomeSortReturn.
  ///
  /// In zh, this message translates to:
  /// **'收益'**
  String get strategyHomeSortReturn;

  /// No description provided for @strategyHomeSortSharpe.
  ///
  /// In zh, this message translates to:
  /// **'Sharpe'**
  String get strategyHomeSortSharpe;

  /// No description provided for @strategyHomeSortLowDrawdown.
  ///
  /// In zh, this message translates to:
  /// **'低回撤'**
  String get strategyHomeSortLowDrawdown;

  /// No description provided for @strategyHomeSortLabel.
  ///
  /// In zh, this message translates to:
  /// **'排序'**
  String get strategyHomeSortLabel;

  /// No description provided for @strategyHomeResultCount.
  ///
  /// In zh, this message translates to:
  /// **'{count} 个'**
  String strategyHomeResultCount(int count);

  /// No description provided for @strategyHomeFilterButton.
  ///
  /// In zh, this message translates to:
  /// **'筛选 & 排序'**
  String get strategyHomeFilterButton;

  /// No description provided for @strategyHomeSheetCategory.
  ///
  /// In zh, this message translates to:
  /// **'类型'**
  String get strategyHomeSheetCategory;

  /// No description provided for @strategyHomeSheetSort.
  ///
  /// In zh, this message translates to:
  /// **'排序方式'**
  String get strategyHomeSheetSort;

  /// No description provided for @strategyHomeSortByOption.
  ///
  /// In zh, this message translates to:
  /// **'按 {label} 排序'**
  String strategyHomeSortByOption(String label);

  /// No description provided for @strategyHomeSheetApply.
  ///
  /// In zh, this message translates to:
  /// **'查看 {count} 个结果'**
  String strategyHomeSheetApply(int count);

  /// No description provided for @strategyBadgeHot.
  ///
  /// In zh, this message translates to:
  /// **'🔥 热门'**
  String get strategyBadgeHot;

  /// No description provided for @strategyBadgeNew.
  ///
  /// In zh, this message translates to:
  /// **'NEW'**
  String get strategyBadgeNew;

  /// No description provided for @strategyBadgeOfficial.
  ///
  /// In zh, this message translates to:
  /// **'官方'**
  String get strategyBadgeOfficial;

  /// No description provided for @strategyBadgePro.
  ///
  /// In zh, this message translates to:
  /// **'PRO'**
  String get strategyBadgePro;

  /// No description provided for @strategyCardStatSharpe.
  ///
  /// In zh, this message translates to:
  /// **'Sharpe'**
  String get strategyCardStatSharpe;

  /// No description provided for @strategyCardStatDrawdown.
  ///
  /// In zh, this message translates to:
  /// **'回撤'**
  String get strategyCardStatDrawdown;

  /// No description provided for @strategyCardStatWinRate.
  ///
  /// In zh, this message translates to:
  /// **'胜率'**
  String get strategyCardStatWinRate;

  /// No description provided for @strategyCardStatUsers.
  ///
  /// In zh, this message translates to:
  /// **'使用'**
  String get strategyCardStatUsers;

  /// No description provided for @strategyDetailEquityTab7d.
  ///
  /// In zh, this message translates to:
  /// **'7D'**
  String get strategyDetailEquityTab7d;

  /// No description provided for @strategyDetailEquityTab30d.
  ///
  /// In zh, this message translates to:
  /// **'30D'**
  String get strategyDetailEquityTab30d;

  /// No description provided for @strategyDetailEquityTab90d.
  ///
  /// In zh, this message translates to:
  /// **'90D'**
  String get strategyDetailEquityTab90d;

  /// No description provided for @strategyDetailEquityTab1y.
  ///
  /// In zh, this message translates to:
  /// **'1Y'**
  String get strategyDetailEquityTab1y;

  /// No description provided for @strategyDetailParamsTitle.
  ///
  /// In zh, this message translates to:
  /// **'策略参数'**
  String get strategyDetailParamsTitle;

  /// No description provided for @strategyDetailParamType.
  ///
  /// In zh, this message translates to:
  /// **'类型'**
  String get strategyDetailParamType;

  /// No description provided for @strategyDetailParamSymbol.
  ///
  /// In zh, this message translates to:
  /// **'交易品种'**
  String get strategyDetailParamSymbol;

  /// No description provided for @strategyDetailParamPeriod.
  ///
  /// In zh, this message translates to:
  /// **'交易周期'**
  String get strategyDetailParamPeriod;

  /// No description provided for @strategyDetailParamStopLoss.
  ///
  /// In zh, this message translates to:
  /// **'止损'**
  String get strategyDetailParamStopLoss;

  /// No description provided for @strategyDetailParamPosition.
  ///
  /// In zh, this message translates to:
  /// **'仓位'**
  String get strategyDetailParamPosition;

  /// No description provided for @strategyDetailParamLeverage.
  ///
  /// In zh, this message translates to:
  /// **'杠杆'**
  String get strategyDetailParamLeverage;

  /// No description provided for @strategyDetailShareButton.
  ///
  /// In zh, this message translates to:
  /// **'分享'**
  String get strategyDetailShareButton;

  /// No description provided for @strategyDetailShareToast.
  ///
  /// In zh, this message translates to:
  /// **'已复制策略链接到剪贴板'**
  String get strategyDetailShareToast;

  /// No description provided for @aiLoadStrategyUserMessage.
  ///
  /// In zh, this message translates to:
  /// **'请基于策略「{name}」（{category}）重新生成，并保留相同标签：{tags}。'**
  String aiLoadStrategyUserMessage(String name, String category, String tags);

  /// No description provided for @aiLoadStrategyReply.
  ///
  /// In zh, this message translates to:
  /// **'好的，已基于策略「{name}」准备复刻方案，建议参数：'**
  String aiLoadStrategyReply(String name);

  /// No description provided for @aiLoadStrategyGuestHint.
  ///
  /// In zh, this message translates to:
  /// **'请先登录后再载入策略对话'**
  String get aiLoadStrategyGuestHint;

  /// No description provided for @strategySignalBuy.
  ///
  /// In zh, this message translates to:
  /// **'买入'**
  String get strategySignalBuy;

  /// No description provided for @strategySignalSell.
  ///
  /// In zh, this message translates to:
  /// **'卖出'**
  String get strategySignalSell;

  /// No description provided for @whaleFilterAll.
  ///
  /// In zh, this message translates to:
  /// **'全部金额'**
  String get whaleFilterAll;

  /// No description provided for @whaleThresholdLabel.
  ///
  /// In zh, this message translates to:
  /// **'阈值:'**
  String get whaleThresholdLabel;

  /// No description provided for @whaleLoadError.
  ///
  /// In zh, this message translates to:
  /// **'加载失败'**
  String get whaleLoadError;

  /// No description provided for @whaleDiscoverSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'发现最有价值的交易者'**
  String get whaleDiscoverSubtitle;

  /// No description provided for @whaleSortLabel.
  ///
  /// In zh, this message translates to:
  /// **'排序'**
  String get whaleSortLabel;

  /// No description provided for @whaleSortByLabel.
  ///
  /// In zh, this message translates to:
  /// **'排序方式:'**
  String get whaleSortByLabel;

  /// No description provided for @whaleSortWinRate.
  ///
  /// In zh, this message translates to:
  /// **'胜率'**
  String get whaleSortWinRate;

  /// No description provided for @whaleSortAum.
  ///
  /// In zh, this message translates to:
  /// **'账户总价值'**
  String get whaleSortAum;

  /// No description provided for @whaleSortPnl.
  ///
  /// In zh, this message translates to:
  /// **'已实现盈亏'**
  String get whaleSortPnl;

  /// No description provided for @whaleLeaderPnlLabel.
  ///
  /// In zh, this message translates to:
  /// **'已实现盈亏(1月)'**
  String get whaleLeaderPnlLabel;

  /// No description provided for @whaleLeaderPositionsLabel.
  ///
  /// In zh, this message translates to:
  /// **'当前持仓'**
  String get whaleLeaderPositionsLabel;

  /// No description provided for @whaleLeaderWinRateLabel.
  ///
  /// In zh, this message translates to:
  /// **'胜率(1月)'**
  String get whaleLeaderWinRateLabel;

  /// No description provided for @whaleLeaderAiTagsLabel.
  ///
  /// In zh, this message translates to:
  /// **'AI 标签'**
  String get whaleLeaderAiTagsLabel;

  /// No description provided for @whaleLeaderTagsEmpty.
  ///
  /// In zh, this message translates to:
  /// **'暂无'**
  String get whaleLeaderTagsEmpty;

  /// No description provided for @whaleLeaderCopyTooltip.
  ///
  /// In zh, this message translates to:
  /// **'复制地址'**
  String get whaleLeaderCopyTooltip;

  /// No description provided for @whaleLeaderCopied.
  ///
  /// In zh, this message translates to:
  /// **'地址已复制'**
  String get whaleLeaderCopied;

  /// No description provided for @whaleLeaderTrendTooltip.
  ///
  /// In zh, this message translates to:
  /// **'交易统计'**
  String get whaleLeaderTrendTooltip;

  /// No description provided for @whaleHoldingsBadge.
  ///
  /// In zh, this message translates to:
  /// **'巨鲸'**
  String get whaleHoldingsBadge;

  /// No description provided for @whaleFeedEmpty.
  ///
  /// In zh, this message translates to:
  /// **'暂无符合条件的巨鲸事件'**
  String get whaleFeedEmpty;

  /// No description provided for @whaleTimeJustNow.
  ///
  /// In zh, this message translates to:
  /// **'刚刚'**
  String get whaleTimeJustNow;

  /// No description provided for @whaleTimeMinutesAgoSuffix.
  ///
  /// In zh, this message translates to:
  /// **' 分钟前'**
  String get whaleTimeMinutesAgoSuffix;

  /// No description provided for @whaleTimeHoursAgoSuffix.
  ///
  /// In zh, this message translates to:
  /// **' 小时前'**
  String get whaleTimeHoursAgoSuffix;

  /// No description provided for @whaleTimeDaysAgoSuffix.
  ///
  /// In zh, this message translates to:
  /// **' 天前'**
  String get whaleTimeDaysAgoSuffix;

  /// No description provided for @whaleTabDiscover.
  ///
  /// In zh, this message translates to:
  /// **'发现'**
  String get whaleTabDiscover;

  /// No description provided for @whaleTabLive.
  ///
  /// In zh, this message translates to:
  /// **'实时'**
  String get whaleTabLive;

  /// No description provided for @whaleTabHoldings.
  ///
  /// In zh, this message translates to:
  /// **'持仓'**
  String get whaleTabHoldings;

  /// No description provided for @whaleTabWatch.
  ///
  /// In zh, this message translates to:
  /// **'监控'**
  String get whaleTabWatch;

  /// No description provided for @whaleLiveLabel.
  ///
  /// In zh, this message translates to:
  /// **'LIVE'**
  String get whaleLiveLabel;

  /// No description provided for @whaleGroupNow.
  ///
  /// In zh, this message translates to:
  /// **'最近 5 分钟'**
  String get whaleGroupNow;

  /// No description provided for @whaleGroup15m.
  ///
  /// In zh, this message translates to:
  /// **'15 分钟内'**
  String get whaleGroup15m;

  /// No description provided for @whaleGroup1h.
  ///
  /// In zh, this message translates to:
  /// **'过去 1 小时'**
  String get whaleGroup1h;

  /// No description provided for @whaleRowLong.
  ///
  /// In zh, this message translates to:
  /// **'做多'**
  String get whaleRowLong;

  /// No description provided for @whaleRowShort.
  ///
  /// In zh, this message translates to:
  /// **'做空'**
  String get whaleRowShort;

  /// No description provided for @whaleRowPositionValue.
  ///
  /// In zh, this message translates to:
  /// **'持仓价值'**
  String get whaleRowPositionValue;

  /// No description provided for @whaleRowQuantity.
  ///
  /// In zh, this message translates to:
  /// **'数量'**
  String get whaleRowQuantity;

  /// No description provided for @whaleRowOpenPrice.
  ///
  /// In zh, this message translates to:
  /// **'开盘价格'**
  String get whaleRowOpenPrice;

  /// No description provided for @whaleRowWinRate.
  ///
  /// In zh, this message translates to:
  /// **'胜率'**
  String get whaleRowWinRate;

  /// No description provided for @whaleAddWatchAddress.
  ///
  /// In zh, this message translates to:
  /// **'添加地址监控'**
  String get whaleAddWatchAddress;

  /// No description provided for @whaleSectionSmartMoney.
  ///
  /// In zh, this message translates to:
  /// **'聪明钱榜'**
  String get whaleSectionSmartMoney;

  /// No description provided for @whaleSectionSmartMoneySub.
  ///
  /// In zh, this message translates to:
  /// **'过去 7 日盈利前 5 · 链上 + 交易所合并'**
  String get whaleSectionSmartMoneySub;

  /// No description provided for @whaleSectionViewAll.
  ///
  /// In zh, this message translates to:
  /// **'查看全部 ›'**
  String get whaleSectionViewAll;

  /// No description provided for @whaleSectionTrending.
  ///
  /// In zh, this message translates to:
  /// **'趋势资产'**
  String get whaleSectionTrending;

  /// No description provided for @whaleSectionTrendingSub.
  ///
  /// In zh, this message translates to:
  /// **'巨鲸 7D 净增持'**
  String get whaleSectionTrendingSub;

  /// No description provided for @whaleSectionEmergingWhales.
  ///
  /// In zh, this message translates to:
  /// **'新晋巨鲸'**
  String get whaleSectionEmergingWhales;

  /// No description provided for @whaleSectionEmergingWhalesTitle.
  ///
  /// In zh, this message translates to:
  /// **'过去 24H 出现 6 个新巨鲸'**
  String get whaleSectionEmergingWhalesTitle;

  /// No description provided for @whaleSectionEmergingWhalesSub.
  ///
  /// In zh, this message translates to:
  /// **'累计净增持 1,840 BTC · 平均建仓 \$42M'**
  String get whaleSectionEmergingWhalesSub;

  /// No description provided for @whaleSectionExchangeFlow.
  ///
  /// In zh, this message translates to:
  /// **'交易所 BTC 余额'**
  String get whaleSectionExchangeFlow;

  /// No description provided for @whaleSectionExchangeFlowSub.
  ///
  /// In zh, this message translates to:
  /// **'24H 净变动 · 负值=资金离场'**
  String get whaleSectionExchangeFlowSub;

  /// No description provided for @whaleSectionTopHolders.
  ///
  /// In zh, this message translates to:
  /// **'头部地址持仓'**
  String get whaleSectionTopHolders;

  /// No description provided for @whaleSectionTopHoldersSub.
  ///
  /// In zh, this message translates to:
  /// **'公开标签 · 7D 变化'**
  String get whaleSectionTopHoldersSub;

  /// No description provided for @whaleSectionMyWatch.
  ///
  /// In zh, this message translates to:
  /// **'我的监控'**
  String get whaleSectionMyWatch;

  /// No description provided for @whaleSectionMyWatchCountSuffix.
  ///
  /// In zh, this message translates to:
  /// **' 个地址'**
  String get whaleSectionMyWatchCountSuffix;

  /// No description provided for @whaleSectionRecentAlerts.
  ///
  /// In zh, this message translates to:
  /// **'最近告警'**
  String get whaleSectionRecentAlerts;

  /// No description provided for @whaleSectionRecentAlertsAction.
  ///
  /// In zh, this message translates to:
  /// **'规则 ›'**
  String get whaleSectionRecentAlertsAction;

  /// No description provided for @whaleWatchPnl7d.
  ///
  /// In zh, this message translates to:
  /// **'7D PnL'**
  String get whaleWatchPnl7d;

  /// No description provided for @whaleHoldingsLabel24h.
  ///
  /// In zh, this message translates to:
  /// **'24H'**
  String get whaleHoldingsLabel24h;

  /// No description provided for @whaleHoldingsSectionTitle.
  ///
  /// In zh, this message translates to:
  /// **'巨鲸持仓'**
  String get whaleHoldingsSectionTitle;

  /// No description provided for @whaleHoldingsEmpty.
  ///
  /// In zh, this message translates to:
  /// **'无匹配持仓'**
  String get whaleHoldingsEmpty;

  /// No description provided for @whaleHoldingsCoinAll.
  ///
  /// In zh, this message translates to:
  /// **'全部'**
  String get whaleHoldingsCoinAll;

  /// No description provided for @whaleHoldingsFilterDir.
  ///
  /// In zh, this message translates to:
  /// **'方向'**
  String get whaleHoldingsFilterDir;

  /// No description provided for @whaleHoldingsFilterPnl.
  ///
  /// In zh, this message translates to:
  /// **'盈亏'**
  String get whaleHoldingsFilterPnl;

  /// No description provided for @whaleHoldingsDirLong.
  ///
  /// In zh, this message translates to:
  /// **'做多'**
  String get whaleHoldingsDirLong;

  /// No description provided for @whaleHoldingsDirShort.
  ///
  /// In zh, this message translates to:
  /// **'做空'**
  String get whaleHoldingsDirShort;

  /// No description provided for @whaleHoldingsPnlProfit.
  ///
  /// In zh, this message translates to:
  /// **'盈利'**
  String get whaleHoldingsPnlProfit;

  /// No description provided for @whaleHoldingsPnlLoss.
  ///
  /// In zh, this message translates to:
  /// **'亏损'**
  String get whaleHoldingsPnlLoss;

  /// No description provided for @whaleHoldingsSortValue.
  ///
  /// In zh, this message translates to:
  /// **'持仓价值'**
  String get whaleHoldingsSortValue;

  /// No description provided for @whaleHoldingsSortMargin.
  ///
  /// In zh, this message translates to:
  /// **'保证金'**
  String get whaleHoldingsSortMargin;

  /// No description provided for @whaleHoldingsSortTime.
  ///
  /// In zh, this message translates to:
  /// **'创建时间'**
  String get whaleHoldingsSortTime;

  /// No description provided for @whaleHoldingsDirAll.
  ///
  /// In zh, this message translates to:
  /// **'所有方向'**
  String get whaleHoldingsDirAll;

  /// No description provided for @whaleHoldingsPnlAll.
  ///
  /// In zh, this message translates to:
  /// **'所有未实现盈亏'**
  String get whaleHoldingsPnlAll;

  /// No description provided for @whaleHoldingsFilterDirTitle.
  ///
  /// In zh, this message translates to:
  /// **'持仓方向'**
  String get whaleHoldingsFilterDirTitle;

  /// No description provided for @whaleHoldingsFilterPnlTitle.
  ///
  /// In zh, this message translates to:
  /// **'未实现盈亏'**
  String get whaleHoldingsFilterPnlTitle;

  /// No description provided for @whaleHoldingsMoreSort.
  ///
  /// In zh, this message translates to:
  /// **'更多排序'**
  String get whaleHoldingsMoreSort;

  /// No description provided for @whaleHoldingsSortSectionMetric.
  ///
  /// In zh, this message translates to:
  /// **'指标'**
  String get whaleHoldingsSortSectionMetric;

  /// No description provided for @whaleHoldingsSortSectionDir.
  ///
  /// In zh, this message translates to:
  /// **'排序方式'**
  String get whaleHoldingsSortSectionDir;

  /// No description provided for @whaleHoldingsSortDirAsc.
  ///
  /// In zh, this message translates to:
  /// **'升序'**
  String get whaleHoldingsSortDirAsc;

  /// No description provided for @whaleHoldingsSortDirDesc.
  ///
  /// In zh, this message translates to:
  /// **'降序'**
  String get whaleHoldingsSortDirDesc;

  /// No description provided for @whaleHoldingsSortDirNone.
  ///
  /// In zh, this message translates to:
  /// **'不排序'**
  String get whaleHoldingsSortDirNone;

  /// No description provided for @whaleHoldingsSortDone.
  ///
  /// In zh, this message translates to:
  /// **'完成'**
  String get whaleHoldingsSortDone;

  /// No description provided for @whaleHoldingsCoinSearchTooltip.
  ///
  /// In zh, this message translates to:
  /// **'搜索币种'**
  String get whaleHoldingsCoinSearchTooltip;

  /// No description provided for @whaleHoldingsCoinSearchHint.
  ///
  /// In zh, this message translates to:
  /// **'搜索币种'**
  String get whaleHoldingsCoinSearchHint;

  /// No description provided for @whaleHoldingsCoinSearchEmpty.
  ///
  /// In zh, this message translates to:
  /// **'无匹配币种'**
  String get whaleHoldingsCoinSearchEmpty;

  /// No description provided for @whaleHoldingsColValue.
  ///
  /// In zh, this message translates to:
  /// **'持仓价值'**
  String get whaleHoldingsColValue;

  /// No description provided for @whaleHoldingsColPnl.
  ///
  /// In zh, this message translates to:
  /// **'未实现盈亏'**
  String get whaleHoldingsColPnl;

  /// No description provided for @whaleHoldingsColMargin.
  ///
  /// In zh, this message translates to:
  /// **'保证金'**
  String get whaleHoldingsColMargin;

  /// No description provided for @whaleHoldingsColOpen.
  ///
  /// In zh, this message translates to:
  /// **'开盘价'**
  String get whaleHoldingsColOpen;

  /// No description provided for @whaleHoldingsColLiq.
  ///
  /// In zh, this message translates to:
  /// **'清算价'**
  String get whaleHoldingsColLiq;

  /// No description provided for @whaleSmartMoneyHoldingsPrefix.
  ///
  /// In zh, this message translates to:
  /// **'主要持仓 · '**
  String get whaleSmartMoneyHoldingsPrefix;

  /// No description provided for @whaleWinRatePrefix.
  ///
  /// In zh, this message translates to:
  /// **'胜率 '**
  String get whaleWinRatePrefix;

  /// No description provided for @whaleTrendingParticipantsSuffix.
  ///
  /// In zh, this message translates to:
  /// **' 个巨鲸参与'**
  String get whaleTrendingParticipantsSuffix;

  /// No description provided for @whaleProfileTitle.
  ///
  /// In zh, this message translates to:
  /// **'地址详情'**
  String get whaleProfileTitle;

  /// No description provided for @whaleProfileTabOverview.
  ///
  /// In zh, this message translates to:
  /// **'概览'**
  String get whaleProfileTabOverview;

  /// No description provided for @whaleProfileTabStats.
  ///
  /// In zh, this message translates to:
  /// **'交易统计'**
  String get whaleProfileTabStats;

  /// No description provided for @whaleProfileCopyTooltip.
  ///
  /// In zh, this message translates to:
  /// **'复制地址'**
  String get whaleProfileCopyTooltip;

  /// No description provided for @whaleProfileShareTooltip.
  ///
  /// In zh, this message translates to:
  /// **'分享'**
  String get whaleProfileShareTooltip;

  /// No description provided for @whaleProfileCopied.
  ///
  /// In zh, this message translates to:
  /// **'地址已复制'**
  String get whaleProfileCopied;

  /// No description provided for @whaleProfileWatch.
  ///
  /// In zh, this message translates to:
  /// **'一键监控'**
  String get whaleProfileWatch;

  /// No description provided for @whaleProfileRefreshTooltip.
  ///
  /// In zh, this message translates to:
  /// **'刷新'**
  String get whaleProfileRefreshTooltip;

  /// No description provided for @whaleProfileAssetSummaryPrefix.
  ///
  /// In zh, this message translates to:
  /// **'主要持仓 · '**
  String get whaleProfileAssetSummaryPrefix;

  /// No description provided for @whaleProfileHoldingsValueLabel.
  ///
  /// In zh, this message translates to:
  /// **'总持仓估值'**
  String get whaleProfileHoldingsValueLabel;

  /// No description provided for @whaleProfileSectionHoldings.
  ///
  /// In zh, this message translates to:
  /// **'持仓'**
  String get whaleProfileSectionHoldings;

  /// No description provided for @whaleProfileSectionRecentActions.
  ///
  /// In zh, this message translates to:
  /// **'近期动作'**
  String get whaleProfileSectionRecentActions;

  /// No description provided for @whaleProfileRecentActionsEmpty.
  ///
  /// In zh, this message translates to:
  /// **'暂无近期动作'**
  String get whaleProfileRecentActionsEmpty;

  /// No description provided for @whaleProfileStatPnl.
  ///
  /// In zh, this message translates to:
  /// **'总盈亏'**
  String get whaleProfileStatPnl;

  /// No description provided for @whaleProfileStatWinRate.
  ///
  /// In zh, this message translates to:
  /// **'胜率'**
  String get whaleProfileStatWinRate;

  /// No description provided for @whaleProfileWinRateValue.
  ///
  /// In zh, this message translates to:
  /// **'{pct}%'**
  String whaleProfileWinRateValue(int pct);

  /// No description provided for @whaleProfileStatRealized.
  ///
  /// In zh, this message translates to:
  /// **'已实现'**
  String get whaleProfileStatRealized;

  /// No description provided for @whaleProfileStatUnrealized.
  ///
  /// In zh, this message translates to:
  /// **'未实现'**
  String get whaleProfileStatUnrealized;

  /// No description provided for @whaleProfileDirectionBias.
  ///
  /// In zh, this message translates to:
  /// **'方向偏好'**
  String get whaleProfileDirectionBias;

  /// No description provided for @whaleProfileLong.
  ///
  /// In zh, this message translates to:
  /// **'做多'**
  String get whaleProfileLong;

  /// No description provided for @whaleProfileShort.
  ///
  /// In zh, this message translates to:
  /// **'做空'**
  String get whaleProfileShort;

  /// No description provided for @whaleProfileSectionAssetPerf.
  ///
  /// In zh, this message translates to:
  /// **'资产表现'**
  String get whaleProfileSectionAssetPerf;

  /// No description provided for @whaleProfileLoadError.
  ///
  /// In zh, this message translates to:
  /// **'地址详情加载失败'**
  String get whaleProfileLoadError;

  /// No description provided for @whaleProfileTabBasic.
  ///
  /// In zh, this message translates to:
  /// **'基本信息'**
  String get whaleProfileTabBasic;

  /// No description provided for @whaleProfileTabSpot.
  ///
  /// In zh, this message translates to:
  /// **'现货持仓'**
  String get whaleProfileTabSpot;

  /// No description provided for @whaleProfileTabPerp.
  ///
  /// In zh, this message translates to:
  /// **'永续合约持仓'**
  String get whaleProfileTabPerp;

  /// No description provided for @whaleProfileTabOrders.
  ///
  /// In zh, this message translates to:
  /// **'挂单'**
  String get whaleProfileTabOrders;

  /// No description provided for @whaleProfileTabTrades.
  ///
  /// In zh, this message translates to:
  /// **'最近成交'**
  String get whaleProfileTabTrades;

  /// No description provided for @whaleProfileTabHistory.
  ///
  /// In zh, this message translates to:
  /// **'历史委托'**
  String get whaleProfileTabHistory;

  /// No description provided for @whaleProfileColShare.
  ///
  /// In zh, this message translates to:
  /// **'占比'**
  String get whaleProfileColShare;

  /// No description provided for @whaleProfileColQty.
  ///
  /// In zh, this message translates to:
  /// **'数量'**
  String get whaleProfileColQty;

  /// No description provided for @whaleProfileColPrice.
  ///
  /// In zh, this message translates to:
  /// **'价格'**
  String get whaleProfileColPrice;

  /// No description provided for @whaleProfileColValue.
  ///
  /// In zh, this message translates to:
  /// **'价值'**
  String get whaleProfileColValue;

  /// No description provided for @whaleProfileColChain.
  ///
  /// In zh, this message translates to:
  /// **'链'**
  String get whaleProfileColChain;

  /// No description provided for @whaleProfileColPosValue.
  ///
  /// In zh, this message translates to:
  /// **'持仓价值'**
  String get whaleProfileColPosValue;

  /// No description provided for @whaleProfileColUnrealized.
  ///
  /// In zh, this message translates to:
  /// **'未实现盈亏'**
  String get whaleProfileColUnrealized;

  /// No description provided for @whaleProfileColEntry.
  ///
  /// In zh, this message translates to:
  /// **'入场均价'**
  String get whaleProfileColEntry;

  /// No description provided for @whaleProfileColMark.
  ///
  /// In zh, this message translates to:
  /// **'标记价格'**
  String get whaleProfileColMark;

  /// No description provided for @whaleProfileColLiq.
  ///
  /// In zh, this message translates to:
  /// **'清算价格'**
  String get whaleProfileColLiq;

  /// No description provided for @whaleProfileColMargin.
  ///
  /// In zh, this message translates to:
  /// **'保证金'**
  String get whaleProfileColMargin;

  /// No description provided for @whaleProfileColFunding.
  ///
  /// In zh, this message translates to:
  /// **'资金费'**
  String get whaleProfileColFunding;

  /// No description provided for @whaleProfileColTpSl.
  ///
  /// In zh, this message translates to:
  /// **'止盈/止损'**
  String get whaleProfileColTpSl;

  /// No description provided for @whaleProfileCross.
  ///
  /// In zh, this message translates to:
  /// **'全仓'**
  String get whaleProfileCross;

  /// No description provided for @whaleProfileColTime.
  ///
  /// In zh, this message translates to:
  /// **'时间'**
  String get whaleProfileColTime;

  /// No description provided for @whaleProfileColTrigger.
  ///
  /// In zh, this message translates to:
  /// **'触发条件'**
  String get whaleProfileColTrigger;

  /// No description provided for @whaleProfileColStatus.
  ///
  /// In zh, this message translates to:
  /// **'状态'**
  String get whaleProfileColStatus;

  /// No description provided for @whaleProfileColOrderId.
  ///
  /// In zh, this message translates to:
  /// **'订单 ID'**
  String get whaleProfileColOrderId;

  /// No description provided for @whaleProfileColType.
  ///
  /// In zh, this message translates to:
  /// **'类型'**
  String get whaleProfileColType;

  /// No description provided for @whaleProfileColStart.
  ///
  /// In zh, this message translates to:
  /// **'起始仓位'**
  String get whaleProfileColStart;

  /// No description provided for @whaleProfileColClosedPnl.
  ///
  /// In zh, this message translates to:
  /// **'已平盈亏'**
  String get whaleProfileColClosedPnl;

  /// No description provided for @whaleProfileColFee.
  ///
  /// In zh, this message translates to:
  /// **'费用'**
  String get whaleProfileColFee;

  /// No description provided for @whaleProfileColExecStatus.
  ///
  /// In zh, this message translates to:
  /// **'执行状态'**
  String get whaleProfileColExecStatus;

  /// No description provided for @whaleProfileStatAccountValue.
  ///
  /// In zh, this message translates to:
  /// **'账户总价值'**
  String get whaleProfileStatAccountValue;

  /// No description provided for @whaleProfileStatAvailMargin.
  ///
  /// In zh, this message translates to:
  /// **'可用保证金'**
  String get whaleProfileStatAvailMargin;

  /// No description provided for @whaleProfileStatWithdrawable.
  ///
  /// In zh, this message translates to:
  /// **'可提取'**
  String get whaleProfileStatWithdrawable;

  /// No description provided for @whaleProfileStatPositionValue.
  ///
  /// In zh, this message translates to:
  /// **'总持仓价值'**
  String get whaleProfileStatPositionValue;

  /// No description provided for @whaleProfileStatLeverage.
  ///
  /// In zh, this message translates to:
  /// **'杠杆比'**
  String get whaleProfileStatLeverage;

  /// No description provided for @whaleProfileLegendPerp.
  ///
  /// In zh, this message translates to:
  /// **'永续合约'**
  String get whaleProfileLegendPerp;

  /// No description provided for @whaleProfileLegendSpot.
  ///
  /// In zh, this message translates to:
  /// **'现货'**
  String get whaleProfileLegendSpot;

  /// No description provided for @whaleProfilePerpTotalValue.
  ///
  /// In zh, this message translates to:
  /// **'永续合约总价值'**
  String get whaleProfilePerpTotalValue;

  /// No description provided for @whaleProfileMarginUsage.
  ///
  /// In zh, this message translates to:
  /// **'平均保证金使用率'**
  String get whaleProfileMarginUsage;

  /// No description provided for @whaleProfileDirectionBias2.
  ///
  /// In zh, this message translates to:
  /// **'方向偏差'**
  String get whaleProfileDirectionBias2;

  /// No description provided for @whaleProfileBiasNeutral.
  ///
  /// In zh, this message translates to:
  /// **'中性'**
  String get whaleProfileBiasNeutral;

  /// No description provided for @whaleProfileLongPosition.
  ///
  /// In zh, this message translates to:
  /// **'多头持仓'**
  String get whaleProfileLongPosition;

  /// No description provided for @whaleProfileShortPosition.
  ///
  /// In zh, this message translates to:
  /// **'空头持仓'**
  String get whaleProfileShortPosition;

  /// No description provided for @whaleProfilePositionDist.
  ///
  /// In zh, this message translates to:
  /// **'仓位分布'**
  String get whaleProfilePositionDist;

  /// No description provided for @whaleProfileLongValue.
  ///
  /// In zh, this message translates to:
  /// **'多头价值'**
  String get whaleProfileLongValue;

  /// No description provided for @whaleProfileShortValue.
  ///
  /// In zh, this message translates to:
  /// **'空头价值'**
  String get whaleProfileShortValue;

  /// No description provided for @whaleProfileCurrentPosition.
  ///
  /// In zh, this message translates to:
  /// **'当前持仓'**
  String get whaleProfileCurrentPosition;

  /// No description provided for @whaleProfileRoi.
  ///
  /// In zh, this message translates to:
  /// **'投资回报率'**
  String get whaleProfileRoi;

  /// No description provided for @whaleProfilePerfTitle.
  ///
  /// In zh, this message translates to:
  /// **'交易表现'**
  String get whaleProfilePerfTitle;

  /// No description provided for @whaleProfileTradeCount.
  ///
  /// In zh, this message translates to:
  /// **'交易次数'**
  String get whaleProfileTradeCount;

  /// No description provided for @whaleProfileMaxDrawdown.
  ///
  /// In zh, this message translates to:
  /// **'最大回撤'**
  String get whaleProfileMaxDrawdown;

  /// No description provided for @whaleProfileFilledOrders.
  ///
  /// In zh, this message translates to:
  /// **'已成交订单'**
  String get whaleProfileFilledOrders;

  /// No description provided for @whaleProfileClosedCount.
  ///
  /// In zh, this message translates to:
  /// **'平仓次数'**
  String get whaleProfileClosedCount;

  /// No description provided for @whaleProfilePeriodDay.
  ///
  /// In zh, this message translates to:
  /// **'1天'**
  String get whaleProfilePeriodDay;

  /// No description provided for @whaleProfilePeriodWeek.
  ///
  /// In zh, this message translates to:
  /// **'1周'**
  String get whaleProfilePeriodWeek;

  /// No description provided for @whaleProfilePeriodMonth.
  ///
  /// In zh, this message translates to:
  /// **'1月'**
  String get whaleProfilePeriodMonth;

  /// No description provided for @whaleProfilePeriodAll.
  ///
  /// In zh, this message translates to:
  /// **'全部'**
  String get whaleProfilePeriodAll;

  /// No description provided for @whaleProfileScopePerpOnly.
  ///
  /// In zh, this message translates to:
  /// **'仅永续合约'**
  String get whaleProfileScopePerpOnly;

  /// No description provided for @whaleProfileScopePerpSpot.
  ///
  /// In zh, this message translates to:
  /// **'永续合约和现货'**
  String get whaleProfileScopePerpSpot;

  /// No description provided for @whaleProfileMetricTotalPnl.
  ///
  /// In zh, this message translates to:
  /// **'总盈亏'**
  String get whaleProfileMetricTotalPnl;

  /// No description provided for @whaleProfileMetricAccountValue.
  ///
  /// In zh, this message translates to:
  /// **'账户价值'**
  String get whaleProfileMetricAccountValue;

  /// No description provided for @whaleProfilePillPeriodTitle.
  ///
  /// In zh, this message translates to:
  /// **'时间范围'**
  String get whaleProfilePillPeriodTitle;

  /// No description provided for @whaleProfilePillScopeTitle.
  ///
  /// In zh, this message translates to:
  /// **'统计范围'**
  String get whaleProfilePillScopeTitle;

  /// No description provided for @whaleProfilePillMetricTitle.
  ///
  /// In zh, this message translates to:
  /// **'指标'**
  String get whaleProfilePillMetricTitle;

  /// No description provided for @whaleProfilePillCancel.
  ///
  /// In zh, this message translates to:
  /// **'取消'**
  String get whaleProfilePillCancel;

  /// No description provided for @whaleProfileEmptySpot.
  ///
  /// In zh, this message translates to:
  /// **'暂无现货持仓'**
  String get whaleProfileEmptySpot;

  /// No description provided for @whaleProfileEmptyPerp.
  ///
  /// In zh, this message translates to:
  /// **'暂无永续合约持仓'**
  String get whaleProfileEmptyPerp;

  /// No description provided for @whaleProfileEmptyOrders.
  ///
  /// In zh, this message translates to:
  /// **'暂无挂单'**
  String get whaleProfileEmptyOrders;

  /// No description provided for @whaleProfileEmptyTrades.
  ///
  /// In zh, this message translates to:
  /// **'暂无最近成交'**
  String get whaleProfileEmptyTrades;

  /// No description provided for @whaleProfileEmptyHistory.
  ///
  /// In zh, this message translates to:
  /// **'暂无历史委托'**
  String get whaleProfileEmptyHistory;

  /// No description provided for @whaleProfileFilterCoin.
  ///
  /// In zh, this message translates to:
  /// **'币种筛选'**
  String get whaleProfileFilterCoin;

  /// No description provided for @whaleProfileFilterLabel.
  ///
  /// In zh, this message translates to:
  /// **'筛选'**
  String get whaleProfileFilterLabel;

  /// No description provided for @whaleProfileFilterAll.
  ///
  /// In zh, this message translates to:
  /// **'全部'**
  String get whaleProfileFilterAll;

  /// No description provided for @whaleProfileFilterTitle.
  ///
  /// In zh, this message translates to:
  /// **'币种筛选'**
  String get whaleProfileFilterTitle;

  /// No description provided for @whaleProfileMoreSort.
  ///
  /// In zh, this message translates to:
  /// **'更多排序'**
  String get whaleProfileMoreSort;

  /// No description provided for @whaleProfileSortMetric.
  ///
  /// In zh, this message translates to:
  /// **'指标'**
  String get whaleProfileSortMetric;

  /// No description provided for @whaleProfileSortDirection.
  ///
  /// In zh, this message translates to:
  /// **'排序方式'**
  String get whaleProfileSortDirection;

  /// No description provided for @whaleProfileSortAsc.
  ///
  /// In zh, this message translates to:
  /// **'升序'**
  String get whaleProfileSortAsc;

  /// No description provided for @whaleProfileSortDesc.
  ///
  /// In zh, this message translates to:
  /// **'降序'**
  String get whaleProfileSortDesc;

  /// No description provided for @whaleProfileSortNone.
  ///
  /// In zh, this message translates to:
  /// **'不排序'**
  String get whaleProfileSortNone;

  /// No description provided for @whaleProfileSortDone.
  ///
  /// In zh, this message translates to:
  /// **'完成'**
  String get whaleProfileSortDone;

  /// No description provided for @whaleProfileSortValue.
  ///
  /// In zh, this message translates to:
  /// **'价值'**
  String get whaleProfileSortValue;

  /// No description provided for @whaleProfileSortAmount.
  ///
  /// In zh, this message translates to:
  /// **'金额'**
  String get whaleProfileSortAmount;

  /// No description provided for @whaleProfilePnlChartTitle.
  ///
  /// In zh, this message translates to:
  /// **'{period} 总盈亏（{scope}）'**
  String whaleProfilePnlChartTitle(String period, String scope);

  /// No description provided for @whaleTradeStatsTitle.
  ///
  /// In zh, this message translates to:
  /// **'交易统计'**
  String get whaleTradeStatsTitle;

  /// No description provided for @whaleTradeStatsClosedPnl.
  ///
  /// In zh, this message translates to:
  /// **'已平仓盈亏'**
  String get whaleTradeStatsClosedPnl;

  /// No description provided for @whaleTradeStatsFeeAdjusted.
  ///
  /// In zh, this message translates to:
  /// **'扣除费用后'**
  String get whaleTradeStatsFeeAdjusted;

  /// No description provided for @whaleTradeStatsTradeCount.
  ///
  /// In zh, this message translates to:
  /// **'交易次数'**
  String get whaleTradeStatsTradeCount;

  /// No description provided for @whaleTradeStatsWins.
  ///
  /// In zh, this message translates to:
  /// **'盈利'**
  String get whaleTradeStatsWins;

  /// No description provided for @whaleTradeStatsLosses.
  ///
  /// In zh, this message translates to:
  /// **'亏损'**
  String get whaleTradeStatsLosses;

  /// No description provided for @whaleTradeStatsPerfTitle.
  ///
  /// In zh, this message translates to:
  /// **'盈亏表现'**
  String get whaleTradeStatsPerfTitle;

  /// No description provided for @whaleTradeStatsByAsset.
  ///
  /// In zh, this message translates to:
  /// **'按资产的表现'**
  String get whaleTradeStatsByAsset;

  /// No description provided for @whaleTradeStatsByPosition.
  ///
  /// In zh, this message translates to:
  /// **'按仓位的表现'**
  String get whaleTradeStatsByPosition;

  /// No description provided for @whaleTradeStatsNetPnl.
  ///
  /// In zh, this message translates to:
  /// **'净盈亏'**
  String get whaleTradeStatsNetPnl;

  /// No description provided for @whaleTradeStatsSize.
  ///
  /// In zh, this message translates to:
  /// **'规模'**
  String get whaleTradeStatsSize;

  /// No description provided for @whaleTradeStatsFee.
  ///
  /// In zh, this message translates to:
  /// **'费用'**
  String get whaleTradeStatsFee;

  /// No description provided for @whaleTradeStatsEmpty.
  ///
  /// In zh, this message translates to:
  /// **'暂无成交记录'**
  String get whaleTradeStatsEmpty;

  /// No description provided for @whaleTradeStatsTradeUnit.
  ///
  /// In zh, this message translates to:
  /// **'{count} 笔交易'**
  String whaleTradeStatsTradeUnit(int count);

  /// No description provided for @whaleTradeStatsPeriodDay.
  ///
  /// In zh, this message translates to:
  /// **'1天'**
  String get whaleTradeStatsPeriodDay;

  /// No description provided for @whaleTradeStatsPeriodWeek.
  ///
  /// In zh, this message translates to:
  /// **'1周'**
  String get whaleTradeStatsPeriodWeek;

  /// No description provided for @whaleTradeStatsPeriodMonth.
  ///
  /// In zh, this message translates to:
  /// **'1月'**
  String get whaleTradeStatsPeriodMonth;

  /// No description provided for @whaleTradeStatsPeriodAll.
  ///
  /// In zh, this message translates to:
  /// **'全部'**
  String get whaleTradeStatsPeriodAll;

  /// No description provided for @whaleNotificationTitle.
  ///
  /// In zh, this message translates to:
  /// **'通知中心'**
  String get whaleNotificationTitle;

  /// No description provided for @whaleNotificationTabAll.
  ///
  /// In zh, this message translates to:
  /// **'全部'**
  String get whaleNotificationTabAll;

  /// No description provided for @whaleNotificationTabAlert.
  ///
  /// In zh, this message translates to:
  /// **'巨鲸预警'**
  String get whaleNotificationTabAlert;

  /// No description provided for @whaleNotificationTabWatch.
  ///
  /// In zh, this message translates to:
  /// **'监控触发'**
  String get whaleNotificationTabWatch;

  /// No description provided for @whaleNotificationTabSystem.
  ///
  /// In zh, this message translates to:
  /// **'系统'**
  String get whaleNotificationTabSystem;

  /// No description provided for @whaleNotificationMarkAllRead.
  ///
  /// In zh, this message translates to:
  /// **'全部已读'**
  String get whaleNotificationMarkAllRead;

  /// No description provided for @whaleNotificationEmpty.
  ///
  /// In zh, this message translates to:
  /// **'暂无通知'**
  String get whaleNotificationEmpty;

  /// No description provided for @whaleNotificationTooltip.
  ///
  /// In zh, this message translates to:
  /// **'通知'**
  String get whaleNotificationTooltip;

  /// No description provided for @whaleNotificationCloseTooltip.
  ///
  /// In zh, this message translates to:
  /// **'关闭'**
  String get whaleNotificationCloseTooltip;

  /// No description provided for @whaleNotificationUnreadBadge.
  ///
  /// In zh, this message translates to:
  /// **'{count} 条未读'**
  String whaleNotificationUnreadBadge(int count);

  /// No description provided for @whaleNotificationSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'巨鲸预警 · 监控触发 · 资金流向'**
  String get whaleNotificationSubtitle;

  /// No description provided for @whaleNotificationFooterHint.
  ///
  /// In zh, this message translates to:
  /// **'仅显示最近 24 小时通知'**
  String get whaleNotificationFooterHint;

  /// No description provided for @whaleNotificationSettings.
  ///
  /// In zh, this message translates to:
  /// **'通知设置'**
  String get whaleNotificationSettings;

  /// No description provided for @whaleNotifKindAlert.
  ///
  /// In zh, this message translates to:
  /// **'巨鲸预警'**
  String get whaleNotifKindAlert;

  /// No description provided for @whaleNotifKindWatch.
  ///
  /// In zh, this message translates to:
  /// **'监控触发'**
  String get whaleNotifKindWatch;

  /// No description provided for @whaleNotifKindFlow.
  ///
  /// In zh, this message translates to:
  /// **'资金流向'**
  String get whaleNotifKindFlow;

  /// No description provided for @whaleNotifKindSystem.
  ///
  /// In zh, this message translates to:
  /// **'系统消息'**
  String get whaleNotifKindSystem;

  /// No description provided for @whaleWatchSubTabLive.
  ///
  /// In zh, this message translates to:
  /// **'实时巨鲸'**
  String get whaleWatchSubTabLive;

  /// No description provided for @whaleWatchSubTabAddresses.
  ///
  /// In zh, this message translates to:
  /// **'监控地址'**
  String get whaleWatchSubTabAddresses;

  /// No description provided for @whaleWatchSubTabNotifications.
  ///
  /// In zh, this message translates to:
  /// **'通知中心'**
  String get whaleWatchSubTabNotifications;

  /// No description provided for @whaleWatchCreateMonitor.
  ///
  /// In zh, this message translates to:
  /// **'创建监控'**
  String get whaleWatchCreateMonitor;

  /// No description provided for @whaleWatchAddressesEmpty.
  ///
  /// In zh, this message translates to:
  /// **'暂无监控地址'**
  String get whaleWatchAddressesEmpty;

  /// No description provided for @whaleWatchMarkAllReadCount.
  ///
  /// In zh, this message translates to:
  /// **'全部已读 ({count})'**
  String whaleWatchMarkAllReadCount(int count);

  /// No description provided for @whaleWatchPerpValue.
  ///
  /// In zh, this message translates to:
  /// **'永续合约总价值'**
  String get whaleWatchPerpValue;

  /// No description provided for @whaleWatchUnrealizedPnl.
  ///
  /// In zh, this message translates to:
  /// **'未实现盈亏'**
  String get whaleWatchUnrealizedPnl;

  /// No description provided for @whaleWatchAvailMargin.
  ///
  /// In zh, this message translates to:
  /// **'可用保证金'**
  String get whaleWatchAvailMargin;

  /// No description provided for @whaleWatchMarginUsage.
  ///
  /// In zh, this message translates to:
  /// **'保证金使用率'**
  String get whaleWatchMarginUsage;

  /// No description provided for @whaleWatchPositions.
  ///
  /// In zh, this message translates to:
  /// **'持仓'**
  String get whaleWatchPositions;

  /// No description provided for @whaleRuleAliasLabel.
  ///
  /// In zh, this message translates to:
  /// **'地址备注'**
  String get whaleRuleAliasLabel;

  /// No description provided for @whaleRuleAliasHint.
  ///
  /// In zh, this message translates to:
  /// **'可选'**
  String get whaleRuleAliasHint;

  /// No description provided for @whaleRuleChannelTelegramUnbound.
  ///
  /// In zh, this message translates to:
  /// **'请先完成 Telegram 登录/绑定后再开启 Telegram 推送'**
  String get whaleRuleChannelTelegramUnbound;

  /// No description provided for @whaleLiveCoinPush.
  ///
  /// In zh, this message translates to:
  /// **'关注币种推送'**
  String get whaleLiveCoinPush;

  /// No description provided for @whaleLiveCoinPushDone.
  ///
  /// In zh, this message translates to:
  /// **'已开启关注币种推送'**
  String get whaleLiveCoinPushDone;

  /// No description provided for @whaleLiveCreateMonitor.
  ///
  /// In zh, this message translates to:
  /// **'创建监控'**
  String get whaleLiveCreateMonitor;

  /// No description provided for @whaleLiveThresholdPrefix.
  ///
  /// In zh, this message translates to:
  /// **'≥ \$'**
  String get whaleLiveThresholdPrefix;

  /// No description provided for @whaleLiveFeedEmpty.
  ///
  /// In zh, this message translates to:
  /// **'无匹配推送'**
  String get whaleLiveFeedEmpty;

  /// No description provided for @whaleLiveSecondsUntilUpdate.
  ///
  /// In zh, this message translates to:
  /// **'{seconds} 秒后更新'**
  String whaleLiveSecondsUntilUpdate(int seconds);

  /// No description provided for @whaleLiveWinSort.
  ///
  /// In zh, this message translates to:
  /// **'胜率'**
  String get whaleLiveWinSort;

  /// No description provided for @whaleLiveWinSortNone.
  ///
  /// In zh, this message translates to:
  /// **'胜率不排序'**
  String get whaleLiveWinSortNone;

  /// No description provided for @whaleLiveWinSortDesc.
  ///
  /// In zh, this message translates to:
  /// **'胜率降序'**
  String get whaleLiveWinSortDesc;

  /// No description provided for @whaleLiveWinSortAsc.
  ///
  /// In zh, this message translates to:
  /// **'胜率升序'**
  String get whaleLiveWinSortAsc;

  /// No description provided for @klineLoadError.
  ///
  /// In zh, this message translates to:
  /// **'K 线加载失败'**
  String get klineLoadError;

  /// No description provided for @klineMoreIntervalsEmpty.
  ///
  /// In zh, this message translates to:
  /// **'暂无更多周期'**
  String get klineMoreIntervalsEmpty;

  /// No description provided for @tabMarket.
  ///
  /// In zh, this message translates to:
  /// **'数据'**
  String get tabMarket;

  /// No description provided for @tabWhale.
  ///
  /// In zh, this message translates to:
  /// **'巨鲸'**
  String get tabWhale;

  /// No description provided for @tabStrategy.
  ///
  /// In zh, this message translates to:
  /// **'策略'**
  String get tabStrategy;

  /// No description provided for @tabMe.
  ///
  /// In zh, this message translates to:
  /// **'我的'**
  String get tabMe;

  /// No description provided for @liveStrategyEntryTitle.
  ///
  /// In zh, this message translates to:
  /// **'查看实盘策略'**
  String get liveStrategyEntryTitle;

  /// No description provided for @liveStrategyEntrySubtitle.
  ///
  /// In zh, this message translates to:
  /// **'查看运行状态、持仓与收益'**
  String get liveStrategyEntrySubtitle;

  /// No description provided for @liveListTitle.
  ///
  /// In zh, this message translates to:
  /// **'实盘策略'**
  String get liveListTitle;

  /// No description provided for @liveListTotalAssets.
  ///
  /// In zh, this message translates to:
  /// **'总资产 (持仓 + 可用)'**
  String get liveListTotalAssets;

  /// No description provided for @liveListTodayPnl.
  ///
  /// In zh, this message translates to:
  /// **'今日盈亏'**
  String get liveListTodayPnl;

  /// No description provided for @liveListTotalPnl.
  ///
  /// In zh, this message translates to:
  /// **'累计盈亏'**
  String get liveListTotalPnl;

  /// No description provided for @liveListCapital.
  ///
  /// In zh, this message translates to:
  /// **'投入本金'**
  String get liveListCapital;

  /// No description provided for @liveFilterAll.
  ///
  /// In zh, this message translates to:
  /// **'全部'**
  String get liveFilterAll;

  /// No description provided for @liveFilterRunning.
  ///
  /// In zh, this message translates to:
  /// **'运行中'**
  String get liveFilterRunning;

  /// No description provided for @liveFilterPaused.
  ///
  /// In zh, this message translates to:
  /// **'已暂停'**
  String get liveFilterPaused;

  /// No description provided for @liveFilterStopped.
  ///
  /// In zh, this message translates to:
  /// **'已停止'**
  String get liveFilterStopped;

  /// No description provided for @liveStoppedRetentionHint.
  ///
  /// In zh, this message translates to:
  /// **'已停止策略保留 30 天，期间可随时恢复或导出历史。超期后会自动永久删除。'**
  String get liveStoppedRetentionHint;

  /// No description provided for @liveEmptyTitle.
  ///
  /// In zh, this message translates to:
  /// **'暂无实盘策略'**
  String get liveEmptyTitle;

  /// No description provided for @liveEmptyHint.
  ///
  /// In zh, this message translates to:
  /// **'从 AI 对话生成并部署策略后，会在这里追踪运行状态与收益。'**
  String get liveEmptyHint;

  /// No description provided for @liveCreateFromAi.
  ///
  /// In zh, this message translates to:
  /// **'从 AI 对话创建新策略'**
  String get liveCreateFromAi;

  /// No description provided for @liveSortComingSoon.
  ///
  /// In zh, this message translates to:
  /// **'筛选与排序即将上线'**
  String get liveSortComingSoon;

  /// No description provided for @liveLoadError.
  ///
  /// In zh, this message translates to:
  /// **'实盘策略加载失败'**
  String get liveLoadError;

  /// No description provided for @liveStatusRunning.
  ///
  /// In zh, this message translates to:
  /// **'运行中'**
  String get liveStatusRunning;

  /// No description provided for @liveStatusPaused.
  ///
  /// In zh, this message translates to:
  /// **'已暂停'**
  String get liveStatusPaused;

  /// No description provided for @liveStatusWarning.
  ///
  /// In zh, this message translates to:
  /// **'需关注'**
  String get liveStatusWarning;

  /// No description provided for @liveStatusStopped.
  ///
  /// In zh, this message translates to:
  /// **'已停止'**
  String get liveStatusStopped;

  /// No description provided for @liveDetailTitle.
  ///
  /// In zh, this message translates to:
  /// **'策略详情'**
  String get liveDetailTitle;

  /// No description provided for @liveDetailTotalPnl.
  ///
  /// In zh, this message translates to:
  /// **'累计盈亏'**
  String get liveDetailTotalPnl;

  /// No description provided for @liveTabOverview.
  ///
  /// In zh, this message translates to:
  /// **'概览'**
  String get liveTabOverview;

  /// No description provided for @liveTabPositions.
  ///
  /// In zh, this message translates to:
  /// **'持仓'**
  String get liveTabPositions;

  /// No description provided for @liveTabHistory.
  ///
  /// In zh, this message translates to:
  /// **'交易记录'**
  String get liveTabHistory;

  /// No description provided for @liveTabParams.
  ///
  /// In zh, this message translates to:
  /// **'参数'**
  String get liveTabParams;

  /// No description provided for @liveStatToday.
  ///
  /// In zh, this message translates to:
  /// **'今日盈亏'**
  String get liveStatToday;

  /// No description provided for @liveStatTodayPct.
  ///
  /// In zh, this message translates to:
  /// **'今日 %'**
  String get liveStatTodayPct;

  /// No description provided for @liveStatTotalPct.
  ///
  /// In zh, this message translates to:
  /// **'累计 %'**
  String get liveStatTotalPct;

  /// No description provided for @liveStatCapital.
  ///
  /// In zh, this message translates to:
  /// **'投入本金'**
  String get liveStatCapital;

  /// No description provided for @liveStatTrades.
  ///
  /// In zh, this message translates to:
  /// **'交易笔数'**
  String get liveStatTrades;

  /// No description provided for @liveStatWinRate.
  ///
  /// In zh, this message translates to:
  /// **'胜率'**
  String get liveStatWinRate;

  /// No description provided for @liveStatRunFor.
  ///
  /// In zh, this message translates to:
  /// **'运行天数'**
  String get liveStatRunFor;

  /// No description provided for @liveStatExchange.
  ///
  /// In zh, this message translates to:
  /// **'交易所'**
  String get liveStatExchange;

  /// No description provided for @liveStatTradesUnit.
  ///
  /// In zh, this message translates to:
  /// **'笔'**
  String get liveStatTradesUnit;

  /// No description provided for @liveAiObservationLabel.
  ///
  /// In zh, this message translates to:
  /// **'AI 观察'**
  String get liveAiObservationLabel;

  /// No description provided for @liveAiObservationWarning.
  ///
  /// In zh, this message translates to:
  /// **'近 3 笔交易连续止损，日内已亏损接近设定上限。建议暂停或在对话中调整止损阈值。'**
  String get liveAiObservationWarning;

  /// No description provided for @liveAiObservationPaused.
  ///
  /// In zh, this message translates to:
  /// **'当前已暂停，持仓已平。开启后会等待下一个开仓信号触发。'**
  String get liveAiObservationPaused;

  /// No description provided for @liveAiObservationRunning.
  ///
  /// In zh, this message translates to:
  /// **'策略运行平稳，近 7 天胜率高于回测均值。波动率上升时可考虑降仓位。'**
  String get liveAiObservationRunning;

  /// No description provided for @liveArchiveSectionTitle.
  ///
  /// In zh, this message translates to:
  /// **'策略档案'**
  String get liveArchiveSectionTitle;

  /// No description provided for @liveArchiveScript.
  ///
  /// In zh, this message translates to:
  /// **'策略脚本'**
  String get liveArchiveScript;

  /// No description provided for @liveArchiveScriptSub.
  ///
  /// In zh, this message translates to:
  /// **'部署时生成'**
  String get liveArchiveScriptSub;

  /// No description provided for @liveArchiveBacktest.
  ///
  /// In zh, this message translates to:
  /// **'回测记录'**
  String get liveArchiveBacktest;

  /// No description provided for @liveArchiveBacktestSub.
  ///
  /// In zh, this message translates to:
  /// **'部署前的历史回测结果'**
  String get liveArchiveBacktestSub;

  /// No description provided for @liveArchiveDeploy.
  ///
  /// In zh, this message translates to:
  /// **'部署配置'**
  String get liveArchiveDeploy;

  /// No description provided for @liveArchiveDeploySub.
  ///
  /// In zh, this message translates to:
  /// **'初始资金 / 仓位 / 风控'**
  String get liveArchiveDeploySub;

  /// No description provided for @liveArchiveComingSoon.
  ///
  /// In zh, this message translates to:
  /// **'即将上线'**
  String get liveArchiveComingSoon;

  /// No description provided for @livePositionEmptyTitle.
  ///
  /// In zh, this message translates to:
  /// **'策略已暂停'**
  String get livePositionEmptyTitle;

  /// No description provided for @livePositionEmptyHint.
  ///
  /// In zh, this message translates to:
  /// **'持仓已平，等待开启后接收新信号'**
  String get livePositionEmptyHint;

  /// No description provided for @livePositionEntry.
  ///
  /// In zh, this message translates to:
  /// **'入场价'**
  String get livePositionEntry;

  /// No description provided for @livePositionCurrent.
  ///
  /// In zh, this message translates to:
  /// **'当前价'**
  String get livePositionCurrent;

  /// No description provided for @livePositionStop.
  ///
  /// In zh, this message translates to:
  /// **'止损价'**
  String get livePositionStop;

  /// No description provided for @livePositionStopLabel.
  ///
  /// In zh, this message translates to:
  /// **'止损'**
  String get livePositionStopLabel;

  /// No description provided for @livePositionStopDistance.
  ///
  /// In zh, this message translates to:
  /// **'距止损'**
  String get livePositionStopDistance;

  /// No description provided for @livePositionHold.
  ///
  /// In zh, this message translates to:
  /// **'持仓'**
  String get livePositionHold;

  /// No description provided for @livePositionSideLong.
  ///
  /// In zh, this message translates to:
  /// **'多'**
  String get livePositionSideLong;

  /// No description provided for @livePositionSideShort.
  ///
  /// In zh, this message translates to:
  /// **'空'**
  String get livePositionSideShort;

  /// No description provided for @liveParamsTuneInAi.
  ///
  /// In zh, this message translates to:
  /// **'在 AI 对话中调优参数'**
  String get liveParamsTuneInAi;

  /// No description provided for @liveActionStart.
  ///
  /// In zh, this message translates to:
  /// **'开启策略'**
  String get liveActionStart;

  /// No description provided for @liveActionPause.
  ///
  /// In zh, this message translates to:
  /// **'暂停策略'**
  String get liveActionPause;

  /// No description provided for @liveActionResume.
  ///
  /// In zh, this message translates to:
  /// **'恢复策略'**
  String get liveActionResume;

  /// No description provided for @liveActionDelete.
  ///
  /// In zh, this message translates to:
  /// **'删除'**
  String get liveActionDelete;

  /// No description provided for @liveActionDeletePermanent.
  ///
  /// In zh, this message translates to:
  /// **'永久删除'**
  String get liveActionDeletePermanent;

  /// No description provided for @liveActionComingSoon.
  ///
  /// In zh, this message translates to:
  /// **'策略操作即将上线'**
  String get liveActionComingSoon;

  /// No description provided for @liveActionCancel.
  ///
  /// In zh, this message translates to:
  /// **'取消'**
  String get liveActionCancel;

  /// No description provided for @liveSortSheetTitle.
  ///
  /// In zh, this message translates to:
  /// **'筛选 & 排序'**
  String get liveSortSheetTitle;

  /// No description provided for @liveSortStatusLabel.
  ///
  /// In zh, this message translates to:
  /// **'状态'**
  String get liveSortStatusLabel;

  /// No description provided for @liveSortMetricLabel.
  ///
  /// In zh, this message translates to:
  /// **'排序指标'**
  String get liveSortMetricLabel;

  /// No description provided for @liveSortDirectionLabel.
  ///
  /// In zh, this message translates to:
  /// **'排序方式'**
  String get liveSortDirectionLabel;

  /// No description provided for @liveSortMetricTodayPnl.
  ///
  /// In zh, this message translates to:
  /// **'今日盈亏'**
  String get liveSortMetricTodayPnl;

  /// No description provided for @liveSortMetricTotalPnl.
  ///
  /// In zh, this message translates to:
  /// **'累计盈亏'**
  String get liveSortMetricTotalPnl;

  /// No description provided for @liveSortMetricTotalPct.
  ///
  /// In zh, this message translates to:
  /// **'收益率'**
  String get liveSortMetricTotalPct;

  /// No description provided for @liveSortMetricWinRate.
  ///
  /// In zh, this message translates to:
  /// **'胜率'**
  String get liveSortMetricWinRate;

  /// No description provided for @liveSortMetricCapital.
  ///
  /// In zh, this message translates to:
  /// **'投入本金'**
  String get liveSortMetricCapital;

  /// No description provided for @liveSortMetricRunFor.
  ///
  /// In zh, this message translates to:
  /// **'运行天数'**
  String get liveSortMetricRunFor;

  /// No description provided for @liveSortDirAsc.
  ///
  /// In zh, this message translates to:
  /// **'升序'**
  String get liveSortDirAsc;

  /// No description provided for @liveSortDirDesc.
  ///
  /// In zh, this message translates to:
  /// **'降序'**
  String get liveSortDirDesc;

  /// No description provided for @liveSortDirNone.
  ///
  /// In zh, this message translates to:
  /// **'不排序'**
  String get liveSortDirNone;

  /// No description provided for @liveSortApply.
  ///
  /// In zh, this message translates to:
  /// **'查看 {count} 个策略'**
  String liveSortApply(int count);

  /// No description provided for @livePauseSheetTitle.
  ///
  /// In zh, this message translates to:
  /// **'暂停策略'**
  String get livePauseSheetTitle;

  /// No description provided for @livePauseSheetSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'「{name}」当前有 1 笔持仓，请选择如何处理后再暂停。'**
  String livePauseSheetSubtitle(String name);

  /// No description provided for @livePauseModeMarketLabel.
  ///
  /// In zh, this message translates to:
  /// **'市价平仓后暂停'**
  String get livePauseModeMarketLabel;

  /// No description provided for @livePauseModeMarketTag.
  ///
  /// In zh, this message translates to:
  /// **'推荐'**
  String get livePauseModeMarketTag;

  /// No description provided for @livePauseModeMarketDesc.
  ///
  /// In zh, this message translates to:
  /// **'立即按市价单平掉持仓，实现当前盈亏后暂停策略。'**
  String get livePauseModeMarketDesc;

  /// No description provided for @livePauseModeMarketEffect.
  ///
  /// In zh, this message translates to:
  /// **'预计实现盈亏 {pnl}'**
  String livePauseModeMarketEffect(String pnl);

  /// No description provided for @livePauseModeNaturalLabel.
  ///
  /// In zh, this message translates to:
  /// **'等待止损/止盈触发'**
  String get livePauseModeNaturalLabel;

  /// No description provided for @livePauseModeNaturalDesc.
  ///
  /// In zh, this message translates to:
  /// **'保持运行直到触发止损或止盈，然后自动暂停。'**
  String get livePauseModeNaturalDesc;

  /// No description provided for @livePauseModeNaturalEffect.
  ///
  /// In zh, this message translates to:
  /// **'距止损 {stop}   距止盈 {tp}'**
  String livePauseModeNaturalEffect(String stop, String tp);

  /// No description provided for @livePauseModeKeepLabel.
  ///
  /// In zh, this message translates to:
  /// **'保留持仓，仅暂停策略'**
  String get livePauseModeKeepLabel;

  /// No description provided for @livePauseModeKeepDesc.
  ///
  /// In zh, this message translates to:
  /// **'策略不再监控，持仓需要你在交易所手动管理，恢复后可继续接管。'**
  String get livePauseModeKeepDesc;

  /// No description provided for @livePauseModeKeepEffect.
  ///
  /// In zh, this message translates to:
  /// **'⚠ 暂停期间 止损 / 止盈 / 加减仓 等自动指令将不生效'**
  String get livePauseModeKeepEffect;

  /// No description provided for @livePauseResumeNote.
  ///
  /// In zh, this message translates to:
  /// **'暂停后策略保留全部参数和历史，随时可在「已暂停」中一键恢复。'**
  String get livePauseResumeNote;

  /// No description provided for @livePausePrimaryMarket.
  ///
  /// In zh, this message translates to:
  /// **'市价平仓并暂停'**
  String get livePausePrimaryMarket;

  /// No description provided for @livePausePrimaryNatural.
  ///
  /// In zh, this message translates to:
  /// **'保持运行 · 等待平仓'**
  String get livePausePrimaryNatural;

  /// No description provided for @livePausePrimaryKeep.
  ///
  /// In zh, this message translates to:
  /// **'暂停策略 · 保留持仓'**
  String get livePausePrimaryKeep;

  /// No description provided for @livePausePositionHolding.
  ///
  /// In zh, this message translates to:
  /// **'1 笔持仓'**
  String get livePausePositionHolding;

  /// No description provided for @livePausePositionEntry.
  ///
  /// In zh, this message translates to:
  /// **'入场'**
  String get livePausePositionEntry;

  /// No description provided for @livePausePositionCurrent.
  ///
  /// In zh, this message translates to:
  /// **'现价'**
  String get livePausePositionCurrent;

  /// No description provided for @livePausePositionFloatingPnl.
  ///
  /// In zh, this message translates to:
  /// **'浮动盈亏'**
  String get livePausePositionFloatingPnl;

  /// No description provided for @liveDeleteSheetTitleSoft.
  ///
  /// In zh, this message translates to:
  /// **'删除策略？'**
  String get liveDeleteSheetTitleSoft;

  /// No description provided for @liveDeleteSheetTitlePermanent.
  ///
  /// In zh, this message translates to:
  /// **'永久删除策略？'**
  String get liveDeleteSheetTitlePermanent;

  /// No description provided for @liveDeleteBodySoft.
  ///
  /// In zh, this message translates to:
  /// **'「{name}」会立即停止运行，历史记录保留 30 天，可在「已停止」中查看。'**
  String liveDeleteBodySoft(String name);

  /// No description provided for @liveDeleteBodyPermanentRunning.
  ///
  /// In zh, this message translates to:
  /// **'「{name}」会立即停止运行，历史记录将不予保留，此操作不可撤销。'**
  String liveDeleteBodyPermanentRunning(String name);

  /// No description provided for @liveDeleteBodyStopped.
  ///
  /// In zh, this message translates to:
  /// **'「{name}」的历史记录会被立即永久删除，此操作不可撤销。'**
  String liveDeleteBodyStopped(String name);

  /// No description provided for @liveDeleteToggleExpand.
  ///
  /// In zh, this message translates to:
  /// **'不保留历史？'**
  String get liveDeleteToggleExpand;

  /// No description provided for @liveDeleteToggleCollapse.
  ///
  /// In zh, this message translates to:
  /// **'收起'**
  String get liveDeleteToggleCollapse;

  /// No description provided for @liveDeleteDangerNote.
  ///
  /// In zh, this message translates to:
  /// **'立即永久删除 · 删除后将不保留 30 天历史。通常仅在合规或隐私要求时选择。'**
  String get liveDeleteDangerNote;

  /// No description provided for @liveDeleteDangerCheckbox.
  ///
  /// In zh, this message translates to:
  /// **'同时立即永久删除策略历史（不可撤销）'**
  String get liveDeleteDangerCheckbox;

  /// No description provided for @liveDeletePrimarySoft.
  ///
  /// In zh, this message translates to:
  /// **'删除策略'**
  String get liveDeletePrimarySoft;

  /// No description provided for @liveDeletePrimaryPermanent.
  ///
  /// In zh, this message translates to:
  /// **'永久删除'**
  String get liveDeletePrimaryPermanent;

  /// No description provided for @liveNeedPauseTitle.
  ///
  /// In zh, this message translates to:
  /// **'需要先暂停策略'**
  String get liveNeedPauseTitle;

  /// No description provided for @liveNeedPauseBody.
  ///
  /// In zh, this message translates to:
  /// **'「{name}」当前仍在运行，为避免误删持仓和正在进行的交易，请先暂停策略后再删除。'**
  String liveNeedPauseBody(String name);

  /// No description provided for @liveNeedPausePrimary.
  ///
  /// In zh, this message translates to:
  /// **'去暂停策略'**
  String get liveNeedPausePrimary;

  /// No description provided for @liveCardRunFor.
  ///
  /// In zh, this message translates to:
  /// **'运行 {runFor}'**
  String liveCardRunFor(String runFor);

  /// No description provided for @liveCardTrades.
  ///
  /// In zh, this message translates to:
  /// **'{trades} 笔'**
  String liveCardTrades(int trades);

  /// No description provided for @liveCardWinRate.
  ///
  /// In zh, this message translates to:
  /// **'胜率 {winRate}%'**
  String liveCardWinRate(String winRate);

  /// No description provided for @liveCardMenuTooltip.
  ///
  /// In zh, this message translates to:
  /// **'更多'**
  String get liveCardMenuTooltip;

  /// No description provided for @deployViewLiveStrategies.
  ///
  /// In zh, this message translates to:
  /// **'查看实盘策略'**
  String get deployViewLiveStrategies;

  /// No description provided for @whaleSearchHint.
  ///
  /// In zh, this message translates to:
  /// **'输入地址 / 标签 / 资产 / 交易所'**
  String get whaleSearchHint;

  /// No description provided for @whaleSearchPrompt.
  ///
  /// In zh, this message translates to:
  /// **'搜索地址、标签、资产、交易所或事件类型'**
  String get whaleSearchPrompt;

  /// No description provided for @whaleSearchEmpty.
  ///
  /// In zh, this message translates to:
  /// **'未找到匹配结果'**
  String get whaleSearchEmpty;

  /// No description provided for @whaleSearchKindAddress.
  ///
  /// In zh, this message translates to:
  /// **'地址'**
  String get whaleSearchKindAddress;

  /// No description provided for @whaleSearchKindLabel.
  ///
  /// In zh, this message translates to:
  /// **'标签'**
  String get whaleSearchKindLabel;

  /// No description provided for @whaleSearchKindAsset.
  ///
  /// In zh, this message translates to:
  /// **'资产'**
  String get whaleSearchKindAsset;

  /// No description provided for @whaleSearchKindExchange.
  ///
  /// In zh, this message translates to:
  /// **'交易所'**
  String get whaleSearchKindExchange;

  /// No description provided for @whaleSearchKindEventType.
  ///
  /// In zh, this message translates to:
  /// **'事件类型'**
  String get whaleSearchKindEventType;

  /// No description provided for @whaleWatchEmpty.
  ///
  /// In zh, this message translates to:
  /// **'暂无监控地址，点击下方添加'**
  String get whaleWatchEmpty;

  /// No description provided for @whaleRuleAddTitle.
  ///
  /// In zh, this message translates to:
  /// **'添加地址监控'**
  String get whaleRuleAddTitle;

  /// No description provided for @whaleRuleEditTitle.
  ///
  /// In zh, this message translates to:
  /// **'编辑监控规则'**
  String get whaleRuleEditTitle;

  /// No description provided for @whaleRuleAddressLabel.
  ///
  /// In zh, this message translates to:
  /// **'监控地址'**
  String get whaleRuleAddressLabel;

  /// No description provided for @whaleRuleAddressHint.
  ///
  /// In zh, this message translates to:
  /// **'0x… 地址或缩写'**
  String get whaleRuleAddressHint;

  /// No description provided for @whaleRuleAddressRequired.
  ///
  /// In zh, this message translates to:
  /// **'请输入监控地址'**
  String get whaleRuleAddressRequired;

  /// No description provided for @whaleRuleAddressInvalid.
  ///
  /// In zh, this message translates to:
  /// **'地址格式不正确'**
  String get whaleRuleAddressInvalid;

  /// No description provided for @whaleRuleThresholdLabel.
  ///
  /// In zh, this message translates to:
  /// **'触发阈值（USD）'**
  String get whaleRuleThresholdLabel;

  /// No description provided for @whaleRuleThresholdHint.
  ///
  /// In zh, this message translates to:
  /// **'例如 1000000'**
  String get whaleRuleThresholdHint;

  /// No description provided for @whaleRuleThresholdRequired.
  ///
  /// In zh, this message translates to:
  /// **'请输入触发阈值'**
  String get whaleRuleThresholdRequired;

  /// No description provided for @whaleRuleThresholdInvalid.
  ///
  /// In zh, this message translates to:
  /// **'阈值需为大于 0 的数字'**
  String get whaleRuleThresholdInvalid;

  /// No description provided for @whaleRuleChannelLabel.
  ///
  /// In zh, this message translates to:
  /// **'推送渠道'**
  String get whaleRuleChannelLabel;

  /// No description provided for @whaleRuleChannelPush.
  ///
  /// In zh, this message translates to:
  /// **'网页通知'**
  String get whaleRuleChannelPush;

  /// No description provided for @whaleRuleChannelTelegram.
  ///
  /// In zh, this message translates to:
  /// **'Telegram'**
  String get whaleRuleChannelTelegram;

  /// No description provided for @whaleRuleChannelEmail.
  ///
  /// In zh, this message translates to:
  /// **'邮件'**
  String get whaleRuleChannelEmail;

  /// No description provided for @whaleRuleChannelRequired.
  ///
  /// In zh, this message translates to:
  /// **'至少选择一个推送渠道'**
  String get whaleRuleChannelRequired;

  /// No description provided for @whaleRuleCreate.
  ///
  /// In zh, this message translates to:
  /// **'创建监控'**
  String get whaleRuleCreate;

  /// No description provided for @whaleRuleSave.
  ///
  /// In zh, this message translates to:
  /// **'保存'**
  String get whaleRuleSave;

  /// No description provided for @whaleRuleMenuTooltip.
  ///
  /// In zh, this message translates to:
  /// **'监控规则操作'**
  String get whaleRuleMenuTooltip;

  /// No description provided for @whaleRuleMenuEdit.
  ///
  /// In zh, this message translates to:
  /// **'编辑'**
  String get whaleRuleMenuEdit;

  /// No description provided for @whaleRuleMenuMute.
  ///
  /// In zh, this message translates to:
  /// **'静音'**
  String get whaleRuleMenuMute;

  /// No description provided for @whaleRuleMenuUnmute.
  ///
  /// In zh, this message translates to:
  /// **'取消静音'**
  String get whaleRuleMenuUnmute;

  /// No description provided for @whaleRuleMenuDelete.
  ///
  /// In zh, this message translates to:
  /// **'删除'**
  String get whaleRuleMenuDelete;

  /// No description provided for @whaleRuleDeleteTitle.
  ///
  /// In zh, this message translates to:
  /// **'删除监控'**
  String get whaleRuleDeleteTitle;

  /// No description provided for @whaleRuleDeleteBody.
  ///
  /// In zh, this message translates to:
  /// **'确定删除对「{name}」的监控吗？'**
  String whaleRuleDeleteBody(String name);

  /// No description provided for @whaleRuleDeleteConfirm.
  ///
  /// In zh, this message translates to:
  /// **'删除'**
  String get whaleRuleDeleteConfirm;

  /// No description provided for @aiScriptTitle.
  ///
  /// In zh, this message translates to:
  /// **'策略脚本'**
  String get aiScriptTitle;

  /// No description provided for @aiScriptSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'生成可执行脚本，推送回测引擎'**
  String get aiScriptSubtitle;

  /// No description provided for @aiScriptStatusPending.
  ///
  /// In zh, this message translates to:
  /// **'待生成'**
  String get aiScriptStatusPending;

  /// No description provided for @aiScriptStatusReady.
  ///
  /// In zh, this message translates to:
  /// **'已生成'**
  String get aiScriptStatusReady;

  /// No description provided for @aiScriptGeneratingTitle.
  ///
  /// In zh, this message translates to:
  /// **'正在生成策略脚本'**
  String get aiScriptGeneratingTitle;

  /// No description provided for @aiScriptGeneratingSteps.
  ///
  /// In zh, this message translates to:
  /// **'编译参数 · 校验语法 · 注入风控'**
  String get aiScriptGeneratingSteps;

  /// No description provided for @aiScriptReadyBadge.
  ///
  /// In zh, this message translates to:
  /// **'✓ READY'**
  String get aiScriptReadyBadge;

  /// No description provided for @aiScriptCopy.
  ///
  /// In zh, this message translates to:
  /// **'复制脚本'**
  String get aiScriptCopy;

  /// No description provided for @aiScriptCopied.
  ///
  /// In zh, this message translates to:
  /// **'已复制'**
  String get aiScriptCopied;

  /// No description provided for @aiScriptCopiedToast.
  ///
  /// In zh, this message translates to:
  /// **'已复制脚本'**
  String get aiScriptCopiedToast;

  /// No description provided for @aiScriptExpand.
  ///
  /// In zh, this message translates to:
  /// **'查看全部 {count} 行'**
  String aiScriptExpand(int count);

  /// No description provided for @aiScriptCollapse.
  ///
  /// In zh, this message translates to:
  /// **'收起'**
  String get aiScriptCollapse;

  /// No description provided for @aiScriptSuccessHint.
  ///
  /// In zh, this message translates to:
  /// **'脚本已生成、风控已注入，可继续下一步配置回测。'**
  String get aiScriptSuccessHint;

  /// No description provided for @aiScriptPrev.
  ///
  /// In zh, this message translates to:
  /// **'上一步'**
  String get aiScriptPrev;

  /// No description provided for @aiScriptNext.
  ///
  /// In zh, this message translates to:
  /// **'下一步：回测设置'**
  String get aiScriptNext;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'zh'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'zh':
      return AppLocalizationsZh();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
