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

  /// No description provided for @backtestSheetTitle.
  ///
  /// In zh, this message translates to:
  /// **'回测参数'**
  String get backtestSheetTitle;

  /// No description provided for @backtestFieldSymbol.
  ///
  /// In zh, this message translates to:
  /// **'交易对'**
  String get backtestFieldSymbol;

  /// No description provided for @backtestFieldPeriod.
  ///
  /// In zh, this message translates to:
  /// **'周期'**
  String get backtestFieldPeriod;

  /// No description provided for @backtestFieldLeverage.
  ///
  /// In zh, this message translates to:
  /// **'杠杆'**
  String get backtestFieldLeverage;

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

  /// No description provided for @meStatsTotalEquity.
  ///
  /// In zh, this message translates to:
  /// **'总权益'**
  String get meStatsTotalEquity;

  /// No description provided for @meStatsAvailableBalance.
  ///
  /// In zh, this message translates to:
  /// **'可用余额'**
  String get meStatsAvailableBalance;

  /// No description provided for @meStatsUnrealizedPnl.
  ///
  /// In zh, this message translates to:
  /// **'未实现盈亏'**
  String get meStatsUnrealizedPnl;

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

  /// No description provided for @meSettingsApiManage.
  ///
  /// In zh, this message translates to:
  /// **'管理交易所凭据'**
  String get meSettingsApiManage;

  /// No description provided for @meSettingsApiConfiguredSuffix.
  ///
  /// In zh, this message translates to:
  /// **' 个已配置'**
  String get meSettingsApiConfiguredSuffix;

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
