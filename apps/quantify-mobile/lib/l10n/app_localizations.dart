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

  /// No description provided for @backtestFieldCapital.
  ///
  /// In zh, this message translates to:
  /// **'初始资金 (USD)'**
  String get backtestFieldCapital;

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

  /// No description provided for @backtestErrorFailedPrefix.
  ///
  /// In zh, this message translates to:
  /// **'回测失败：'**
  String get backtestErrorFailedPrefix;

  /// No description provided for @backtestSheetSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'策略参数请通过对话调整'**
  String get backtestSheetSubtitle;

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

  /// No description provided for @backtestFillAvg.
  ///
  /// In zh, this message translates to:
  /// **'平均价'**
  String get backtestFillAvg;

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
  /// **'收起'**
  String get backtestCollapseButton;

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
  /// **'尚未配置任何交易所 API，去「我的 / API」添加后再试。'**
  String get deployExchangeEmptyHint;

  /// No description provided for @deployGoConfigureButton.
  ///
  /// In zh, this message translates to:
  /// **'去配置 API'**
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

  /// No description provided for @authLoginTitle.
  ///
  /// In zh, this message translates to:
  /// **'登录'**
  String get authLoginTitle;

  /// No description provided for @authLoginWelcome.
  ///
  /// In zh, this message translates to:
  /// **'欢迎回到 Quantify'**
  String get authLoginWelcome;

  /// No description provided for @authLoginEmailLabel.
  ///
  /// In zh, this message translates to:
  /// **'邮箱'**
  String get authLoginEmailLabel;

  /// No description provided for @authLoginPasswordLabel.
  ///
  /// In zh, this message translates to:
  /// **'密码'**
  String get authLoginPasswordLabel;

  /// No description provided for @authLoginPasswordHint.
  ///
  /// In zh, this message translates to:
  /// **'至少 6 位'**
  String get authLoginPasswordHint;

  /// No description provided for @authLoginButton.
  ///
  /// In zh, this message translates to:
  /// **'登录'**
  String get authLoginButton;

  /// No description provided for @authLoginTelegramButton.
  ///
  /// In zh, this message translates to:
  /// **'使用 Telegram 一键登录'**
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

  /// No description provided for @authLoginPasswordRequired.
  ///
  /// In zh, this message translates to:
  /// **'请输入密码'**
  String get authLoginPasswordRequired;

  /// No description provided for @authLoginPasswordTooShort.
  ///
  /// In zh, this message translates to:
  /// **'密码至少 6 位'**
  String get authLoginPasswordTooShort;

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

  /// No description provided for @authLoginHeroTitleLine1.
  ///
  /// In zh, this message translates to:
  /// **'把交易想法'**
  String get authLoginHeroTitleLine1;

  /// No description provided for @authLoginHeroTitleLine2.
  ///
  /// In zh, this message translates to:
  /// **'变成可回测的策略'**
  String get authLoginHeroTitleLine2;

  /// No description provided for @authLoginHeroSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'对话生成 · 历史回测 · API 部署'**
  String get authLoginHeroSubtitle;

  /// No description provided for @authLoginForgotPassword.
  ///
  /// In zh, this message translates to:
  /// **'忘记?'**
  String get authLoginForgotPassword;

  /// No description provided for @authLoginGuestButton.
  ///
  /// In zh, this message translates to:
  /// **'以游客身份先看看'**
  String get authLoginGuestButton;

  /// No description provided for @authLoginGuestHint.
  ///
  /// In zh, this message translates to:
  /// **'· 无需注册'**
  String get authLoginGuestHint;

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

  /// No description provided for @authLoginGuestFailedPrefix.
  ///
  /// In zh, this message translates to:
  /// **'游客登录失败：'**
  String get authLoginGuestFailedPrefix;

  /// No description provided for @authLoginForgotMockToast.
  ///
  /// In zh, this message translates to:
  /// **'重置密码（mock）'**
  String get authLoginForgotMockToast;

  /// No description provided for @marketHomeTitle.
  ///
  /// In zh, this message translates to:
  /// **'行情'**
  String get marketHomeTitle;

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
  /// **'搜索币种 · BTC, ETH, SOL…'**
  String get marketHomeSearchPlaceholder;

  /// No description provided for @marketHomeNotificationTooltip.
  ///
  /// In zh, this message translates to:
  /// **'通知'**
  String get marketHomeNotificationTooltip;

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

  /// No description provided for @marketDetailSellButton.
  ///
  /// In zh, this message translates to:
  /// **'卖出 / 做空'**
  String get marketDetailSellButton;

  /// No description provided for @marketDetailSubtitlePerpBinance.
  ///
  /// In zh, this message translates to:
  /// **'永续 · Binance'**
  String get marketDetailSubtitlePerpBinance;

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

  /// No description provided for @meSettingsSecurity.
  ///
  /// In zh, this message translates to:
  /// **'安全设置'**
  String get meSettingsSecurity;

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

  /// No description provided for @meApiFormTestButton.
  ///
  /// In zh, this message translates to:
  /// **'测试连接'**
  String get meApiFormTestButton;

  /// No description provided for @meApiFormConnectionOk.
  ///
  /// In zh, this message translates to:
  /// **'连接成功'**
  String get meApiFormConnectionOk;

  /// No description provided for @meApiFormConnectionFailed.
  ///
  /// In zh, this message translates to:
  /// **'连接失败'**
  String get meApiFormConnectionFailed;

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

  /// No description provided for @themeSettingsTitle.
  ///
  /// In zh, this message translates to:
  /// **'界面主题'**
  String get themeSettingsTitle;

  /// No description provided for @themeSettingsDeviceOnly.
  ///
  /// In zh, this message translates to:
  /// **'仅本设备生效'**
  String get themeSettingsDeviceOnly;

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

  /// No description provided for @meApiFormPermissionSection.
  ///
  /// In zh, this message translates to:
  /// **'授权权限'**
  String get meApiFormPermissionSection;

  /// No description provided for @meApiFormPermSpotRead.
  ///
  /// In zh, this message translates to:
  /// **'现货读'**
  String get meApiFormPermSpotRead;

  /// No description provided for @meApiFormPermSpotTrade.
  ///
  /// In zh, this message translates to:
  /// **'现货交易'**
  String get meApiFormPermSpotTrade;

  /// No description provided for @meApiFormPermFuturesRead.
  ///
  /// In zh, this message translates to:
  /// **'合约读'**
  String get meApiFormPermFuturesRead;

  /// No description provided for @meApiFormPermFuturesTrade.
  ///
  /// In zh, this message translates to:
  /// **'合约交易'**
  String get meApiFormPermFuturesTrade;

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

  /// No description provided for @strategyHomeTitle.
  ///
  /// In zh, this message translates to:
  /// **'策略'**
  String get strategyHomeTitle;

  /// No description provided for @strategyHomeSearchHint.
  ///
  /// In zh, this message translates to:
  /// **'搜索策略 / 作者 / 标签'**
  String get strategyHomeSearchHint;

  /// No description provided for @strategyHomeEmpty.
  ///
  /// In zh, this message translates to:
  /// **'暂无匹配策略'**
  String get strategyHomeEmpty;

  /// No description provided for @strategyCategoryHighReturn.
  ///
  /// In zh, this message translates to:
  /// **'高收益'**
  String get strategyCategoryHighReturn;

  /// No description provided for @strategyCategoryLowDrawdown.
  ///
  /// In zh, this message translates to:
  /// **'低回撤'**
  String get strategyCategoryLowDrawdown;

  /// No description provided for @strategyCategoryNewListing.
  ///
  /// In zh, this message translates to:
  /// **'新上架'**
  String get strategyCategoryNewListing;

  /// No description provided for @strategyDetailTitle.
  ///
  /// In zh, this message translates to:
  /// **'策略详情'**
  String get strategyDetailTitle;

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

  /// No description provided for @strategyCardLoadConversation.
  ///
  /// In zh, this message translates to:
  /// **'载入对话'**
  String get strategyCardLoadConversation;

  /// No description provided for @strategyDetailLoadConversation.
  ///
  /// In zh, this message translates to:
  /// **'载入到对话'**
  String get strategyDetailLoadConversation;

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
  /// **'查看 →'**
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

  /// No description provided for @strategyDetailReviewsTitle.
  ///
  /// In zh, this message translates to:
  /// **'用户评价'**
  String get strategyDetailReviewsTitle;

  /// No description provided for @strategyDetailReviewsEmpty.
  ///
  /// In zh, this message translates to:
  /// **'暂无评价'**
  String get strategyDetailReviewsEmpty;

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

  /// No description provided for @whaleFeedTitle.
  ///
  /// In zh, this message translates to:
  /// **'巨鲸动向'**
  String get whaleFeedTitle;

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

  /// No description provided for @whaleTopBarSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'链上 + 交易所'**
  String get whaleTopBarSubtitle;

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

  /// No description provided for @whaleNetFlowLabel.
  ///
  /// In zh, this message translates to:
  /// **'{symbol} 净流入 · 1H'**
  String whaleNetFlowLabel(String symbol);

  /// No description provided for @whaleStatBigTrades.
  ///
  /// In zh, this message translates to:
  /// **'大额交易'**
  String get whaleStatBigTrades;

  /// No description provided for @whaleStatActiveWhales.
  ///
  /// In zh, this message translates to:
  /// **'活跃巨鲸'**
  String get whaleStatActiveWhales;

  /// No description provided for @whaleStatNetAccumulation.
  ///
  /// In zh, this message translates to:
  /// **'净增持'**
  String get whaleStatNetAccumulation;

  /// No description provided for @whaleStatPast1h.
  ///
  /// In zh, this message translates to:
  /// **'过去 1H'**
  String get whaleStatPast1h;

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

  /// No description provided for @whaleSearchTooltip.
  ///
  /// In zh, this message translates to:
  /// **'搜索'**
  String get whaleSearchTooltip;

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

  /// No description provided for @klineLoadError.
  ///
  /// In zh, this message translates to:
  /// **'K 线加载失败'**
  String get klineLoadError;

  /// No description provided for @tabMarket.
  ///
  /// In zh, this message translates to:
  /// **'行情'**
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
