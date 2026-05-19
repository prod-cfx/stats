// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Chinese (`zh`).
class AppLocalizationsZh extends AppLocalizations {
  AppLocalizationsZh([String locale = 'zh']) : super(locale);

  @override
  String get appTitle => 'Quantify';

  @override
  String get commonCancel => '取消';

  @override
  String get commonAll => '全部';

  @override
  String get commonOr => '或';

  @override
  String get commonLoadError => '加载失败';

  @override
  String get commonRetry => '重试';

  @override
  String get commonStart => '开始';

  @override
  String get commonEnd => '结束';

  @override
  String get commonView => '查看';

  @override
  String get devPreviewPrimaryButton => '主按钮';

  @override
  String get devPreviewSoftBubble => '软气泡';

  @override
  String get aiEmptyHint => '描述你想要的策略，我会帮你生成并回测。';

  @override
  String get aiInputHint => '输入消息…';

  @override
  String get aiBacktestButton => '回测';

  @override
  String get aiSendButton => '发送';

  @override
  String get aiAppBarHistoryTooltip => '历史会话';

  @override
  String get aiAppBarNewSessionTooltip => '新建会话';

  @override
  String get aiAppBarParamsTooltip => '参数';

  @override
  String get aiSessionDrawerTitle => '策略方案';

  @override
  String get aiSessionDrawerSubtitle => '每个方案独立上下文 · 互不污染';

  @override
  String get aiSessionNewButton => '新建方案';

  @override
  String get aiSessionEmptyHint => '暂无会话，点击「新建方案」开始一个策略对话。';

  @override
  String get aiSessionUntitled => '新方案';

  @override
  String get aiQuickReply1 => '再跑一次回测';

  @override
  String get aiQuickReply2 => '把止损改成 1.5%';

  @override
  String get aiQuickReply3 => '换成 ETH 看看';

  @override
  String get aiQuickReply4 => '部署到 Binance';

  @override
  String get backtestSheetTitle => '回测参数';

  @override
  String get backtestFieldSymbol => '交易对';

  @override
  String get backtestFieldPeriod => '周期';

  @override
  String get backtestFieldLeverage => '杠杆';

  @override
  String get backtestFieldCapital => '初始资金 (USD)';

  @override
  String get backtestStartButton => '开始回测';

  @override
  String get backtestErrorInvalidDate => '请输入正确的起止时间（YYYY-MM-DD）';

  @override
  String get backtestErrorEndBeforeStart => '结束时间必须晚于开始时间';

  @override
  String get backtestErrorInvalidCapital => '请输入正数初始资金';

  @override
  String get backtestErrorFailedPrefix => '回测失败：';

  @override
  String get backtestResultTitle => '回测结果';

  @override
  String get backtestResultTotalReturn => '总收益';

  @override
  String get backtestResultMaxDrawdown => '最大回撤';

  @override
  String get backtestResultSharpe => '夏普';

  @override
  String get backtestResultTrades => '成交';

  @override
  String get backtestResultTradesSuffix => ' 笔';

  @override
  String get deployButton => '一键部署';

  @override
  String get deploySheetTitleExchange => '选择交易所';

  @override
  String get deploySheetTitleAuthorize => '授权部署';

  @override
  String get deploySheetTitleDeploying => '正在部署…';

  @override
  String get deploySheetTitleDone => '部署成功';

  @override
  String get deployExchangeConfigured => '已配置';

  @override
  String get deployExchangeNotConfigured => '未配置';

  @override
  String get deployExchangeEmptyHint => '尚未配置任何交易所 API，去「我的 / API」添加后再试。';

  @override
  String get deployGoConfigureButton => '去配置 API';

  @override
  String get deployAuthorizePermissionTitle => '将向交易所申请以下权限';

  @override
  String get deployAuthorizePermissionSpot => '现货下单';

  @override
  String get deployAuthorizePermissionFutures => '合约下单';

  @override
  String get deployAuthorizePermissionBalance => '读取余额';

  @override
  String get deployAuthorizeConfirmButton => '同意并部署';

  @override
  String get deployDoneToast => '策略已部署';

  @override
  String get deployDoneCloseButton => '完成';

  @override
  String get deploySystemMessagePrefix => '策略已部署到 ';

  @override
  String get deploySystemMessageInstanceInfix => ' · 实例 ID ';

  @override
  String get authLoginTitle => '登录';

  @override
  String get authLoginWelcome => '欢迎回到 Quantify';

  @override
  String get authLoginEmailLabel => '邮箱';

  @override
  String get authLoginPasswordLabel => '密码';

  @override
  String get authLoginPasswordHint => '至少 6 位';

  @override
  String get authLoginButton => '登录';

  @override
  String get authLoginTelegramButton => '使用 Telegram 一键登录';

  @override
  String get authLoginEmailRequired => '请输入邮箱';

  @override
  String get authLoginEmailInvalid => '邮箱格式不正确';

  @override
  String get authLoginPasswordRequired => '请输入密码';

  @override
  String get authLoginPasswordTooShort => '密码至少 6 位';

  @override
  String get authLoginFailedPrefix => '登录失败：';

  @override
  String get authTelegramLoginFailedPrefix => 'Telegram 登录失败：';

  @override
  String get marketHomeTitle => '行情';

  @override
  String get marketHomeTabWatchlist => '自选';

  @override
  String get marketHomeLoadError => '行情加载失败';

  @override
  String get marketHomeEmpty => '暂无行情';

  @override
  String get marketLongShortTitle => '多空比';

  @override
  String get marketLongShortLoadError => '多空比加载失败';

  @override
  String get marketLongShortHistory => '历史';

  @override
  String get marketDetailSymbolNotFound => '未找到该交易对';

  @override
  String get marketDetailTickerPrefix => '行情详情：';

  @override
  String get marketDetailSectionOrderbook => '盘口';

  @override
  String get marketDetailBuyButton => '买入 / 做多';

  @override
  String get marketDetailSellButton => '卖出 / 做空';

  @override
  String get tradeOrderSheetTabLimit => '限价';

  @override
  String get tradeOrderSheetTabMarket => '市价';

  @override
  String get tradeOrderSheetTabConditional => '条件委托';

  @override
  String get tradeOrderSheetMarginCross => '全仓';

  @override
  String get tradeOrderSheetMarginIsolated => '逐仓';

  @override
  String get tradeOrderSheetFieldPrice => '价格';

  @override
  String get tradeOrderSheetFieldAmount => '数量';

  @override
  String get tradeOrderSheetFieldTriggerPrice => '触发价';

  @override
  String get tradeOrderSheetFieldTakeProfit => '止盈价';

  @override
  String get tradeOrderSheetFieldStopLoss => '止损价';

  @override
  String get tradeOrderSheetMarketPriceHint => '市价';

  @override
  String get tradeOrderSheetLeverageLabel => '杠杆';

  @override
  String get tradeOrderSheetEstLiqPrice => '预计强平价';

  @override
  String get tradeOrderSheetEstLiqPlaceholder => '—';

  @override
  String get tradeOrderSheetErrorPriceRequired => '请输入有效的价格';

  @override
  String get tradeOrderSheetErrorAmountRequired => '请输入有效的数量';

  @override
  String get tradeOrderSheetErrorTriggerRequired => '请输入有效的触发价';

  @override
  String get tradeOrderSheetSubmitBuyPrefix => '买入 ';

  @override
  String get tradeOrderSheetSubmitSellPrefix => '卖出 ';

  @override
  String get tradeOrderSheetSuccessToast => '下单成功';

  @override
  String get orderbookLoadError => '盘口加载失败';

  @override
  String get meHomeLoadErrorPrefix => '加载失败：';

  @override
  String get meStatsTotalEquity => '总权益';

  @override
  String get meStatsAvailableBalance => '可用余额';

  @override
  String get meStatsUnrealizedPnl => '未实现盈亏';

  @override
  String get meHeaderTelegramBound => 'Telegram 已绑定';

  @override
  String get meHeaderBinanceConnected => 'Binance ✓';

  @override
  String get meSectionAccount => '账户';

  @override
  String get meSectionApi => '交易所 API';

  @override
  String get meSectionPreferences => '偏好';

  @override
  String get meSettingsTelegram => 'Telegram';

  @override
  String get meSettingsTelegramUnbound => '未绑定';

  @override
  String get meSettingsSecurity => '安全设置';

  @override
  String get meSettingsApiManage => '管理交易所凭据';

  @override
  String get meSettingsApiConfiguredSuffix => ' 个已配置';

  @override
  String get meSettingsNotConfigured => '未配置';

  @override
  String get meSettingsLanguage => '语言';

  @override
  String get meSettingsLanguageValue => '简体中文';

  @override
  String get meSettingsTheme => '主题';

  @override
  String get meSettingsThemeValue => '跟随系统';

  @override
  String get meSettingsNotifications => '推送通知';

  @override
  String get meLogout => '退出登录';

  @override
  String get meApiSettingsTitle => '交易所 API';

  @override
  String get meApiConnected => '已连接 · 读取 + 下单';

  @override
  String get meApiNotConfigured => '未配置 · 部署策略前请配置';

  @override
  String get meApiManage => '管理';

  @override
  String get meApiConnect => '连接';

  @override
  String get meApiLoadErrorPrefix => '加载失败：';

  @override
  String get meApiFormPermissionHint => '仅保留读取 + 下单权限';

  @override
  String get meApiFormWarningMust => '必须 ';

  @override
  String meApiFormWarningBody(String exchange) {
    return '在 $exchange 后台关闭「提币」权限。服务端会再校验一次，发现允许提币的密钥会立即拒绝。';
  }

  @override
  String get meApiFormLabelNote => '备注';

  @override
  String get meApiFormSaveButton => '验证并保存';

  @override
  String get meApiFormTestButton => '测试连接';

  @override
  String get meApiFormConnectionOk => '连接成功';

  @override
  String get meApiFormConnectionFailed => '连接失败';

  @override
  String get meApiFormDefaultLabel => '默认';

  @override
  String get meApiFormSaveFailedPrefix => '保存失败：';

  @override
  String get meApiFormNoteTooLong => '备注最多 30 字';

  @override
  String get meApiFormPleaseEnter => '请输入';

  @override
  String get meApiFormMinLenSuffix => ' 位';

  @override
  String get meApiFormMinLenInfix => ' 至少 ';

  @override
  String get themeSettingsTitle => '界面主题';

  @override
  String get themeSettingsDeviceOnly => '仅本设备生效';

  @override
  String get themeBgSection => '背景主题';

  @override
  String get themeAccentSection => '强调色';

  @override
  String get themeBgDark => '暗色';

  @override
  String get themeBgPink => '粉红';

  @override
  String get themeBgLight => '白色';

  @override
  String get themeAccentViolet => '粉紫';

  @override
  String get themeAccentCyan => '青蓝';

  @override
  String get themeAccentAmber => '琥珀';

  @override
  String get themePreviewTitle => '预览 · AI 策略助手';

  @override
  String get themePreviewIdentified => '已识别为「趋势跟踪」策略';

  @override
  String get themePreviewStartBacktest => '开始回测';

  @override
  String get strategyHomeTitle => '策略';

  @override
  String get strategyHomeSearchHint => '搜索策略 / 作者 / 标签';

  @override
  String get strategyHomeEmpty => '暂无匹配策略';

  @override
  String get strategyCategoryHighReturn => '高收益';

  @override
  String get strategyCategoryLowDrawdown => '低回撤';

  @override
  String get strategyCategoryNewListing => '新上架';

  @override
  String get strategyDetailTitle => '策略详情';

  @override
  String get strategyDetailReturn7d => '7日收益';

  @override
  String get strategyDetailReturn30d => '30日收益';

  @override
  String get strategyDetailReturnAll => '全部收益';

  @override
  String get strategyDetailMaxDrawdown => '最大回撤';

  @override
  String get strategyDetailSharpe => '夏普';

  @override
  String get strategyDetailWinRate => '胜率';

  @override
  String get strategyDetailEquityCurve => '收益曲线';

  @override
  String get strategyDetailCurvePlaceholder => '曲线占位（接入 K 线后可视化）';

  @override
  String get strategyDetailRecentSignals => '近期信号';

  @override
  String get strategyDetailSignalsEmpty => '暂无信号';

  @override
  String get strategyDetailSignalsLoadError => '信号加载失败';

  @override
  String get strategyDetailSubscribe => '订阅策略';

  @override
  String get strategyDetailSubscribed => '已订阅 · 点击取消';

  @override
  String get strategyDetailSubscribersSuffix => ' 订阅';

  @override
  String get strategyCardLoadConversation => '载入对话';

  @override
  String get strategyDetailLoadConversation => '载入到对话';

  @override
  String aiLoadStrategyUserMessage(String name, String category, String tags) {
    return '请基于策略「$name」（$category）重新生成，并保留相同标签：$tags。';
  }

  @override
  String aiLoadStrategyReply(String name) {
    return '好的，已基于策略「$name」准备复刻方案，建议参数：';
  }

  @override
  String get aiLoadStrategyGuestHint => '请先登录后再载入策略对话';

  @override
  String get strategySignalBuy => '买入';

  @override
  String get strategySignalSell => '卖出';

  @override
  String get whaleFeedTitle => '巨鲸动向';

  @override
  String get whaleFilterAll => '全部金额';

  @override
  String get whaleThresholdLabel => '阈值:';

  @override
  String get whaleLoadError => '加载失败';

  @override
  String get whaleFeedEmpty => '暂无符合条件的巨鲸事件';

  @override
  String get whaleTimeJustNow => '刚刚';

  @override
  String get whaleTimeMinutesAgoSuffix => ' 分钟前';

  @override
  String get whaleTimeHoursAgoSuffix => ' 小时前';

  @override
  String get whaleTimeDaysAgoSuffix => ' 天前';

  @override
  String get whaleTopBarSubtitle => '链上 + 交易所';

  @override
  String get whaleTabDiscover => '发现';

  @override
  String get whaleTabLive => '实时';

  @override
  String get whaleTabHoldings => '持仓';

  @override
  String get whaleTabWatch => '监控';

  @override
  String whaleNetFlowLabel(String symbol) {
    return '$symbol 净流入 · 1H';
  }

  @override
  String get whaleStatBigTrades => '大额交易';

  @override
  String get whaleStatActiveWhales => '活跃巨鲸';

  @override
  String get whaleStatNetAccumulation => '净增持';

  @override
  String get whaleStatPast1h => '过去 1H';

  @override
  String get whaleLiveLabel => 'LIVE';

  @override
  String get whaleGroupNow => '最近 5 分钟';

  @override
  String get whaleGroup15m => '15 分钟内';

  @override
  String get whaleGroup1h => '过去 1 小时';

  @override
  String get whaleAddWatchAddress => '添加地址监控';

  @override
  String get whaleSectionSmartMoney => '聪明钱榜';

  @override
  String get whaleSectionSmartMoneySub => '过去 7 日盈利前 5 · 链上 + 交易所合并';

  @override
  String get whaleSectionViewAll => '查看全部 ›';

  @override
  String get whaleSectionTrending => '趋势资产';

  @override
  String get whaleSectionTrendingSub => '巨鲸 7D 净增持';

  @override
  String get whaleSectionEmergingWhales => '新晋巨鲸';

  @override
  String get whaleSectionEmergingWhalesTitle => '过去 24H 出现 6 个新巨鲸';

  @override
  String get whaleSectionEmergingWhalesSub => '累计净增持 1,840 BTC · 平均建仓 \$42M';

  @override
  String get whaleSectionExchangeFlow => '交易所 BTC 余额';

  @override
  String get whaleSectionExchangeFlowSub => '24H 净变动 · 负值=资金离场';

  @override
  String get whaleSectionTopHolders => '头部地址持仓';

  @override
  String get whaleSectionTopHoldersSub => '公开标签 · 7D 变化';

  @override
  String get whaleSectionMyWatch => '我的监控';

  @override
  String get whaleSectionMyWatchCountSuffix => ' 个地址';

  @override
  String get whaleSectionRecentAlerts => '最近告警';

  @override
  String get whaleSectionRecentAlertsAction => '规则 ›';

  @override
  String get whaleWatchPnl7d => '7D PnL';

  @override
  String get whaleHoldingsLabel24h => '24H';

  @override
  String get whaleSmartMoneyHoldingsPrefix => '主要持仓 · ';

  @override
  String get whaleWinRatePrefix => '胜率 ';

  @override
  String get whaleTrendingParticipantsSuffix => ' 个巨鲸参与';

  @override
  String get whaleNotificationTitle => '通知中心';

  @override
  String get whaleNotificationTabAll => '全部';

  @override
  String get whaleNotificationTabAlert => '巨鲸预警';

  @override
  String get whaleNotificationTabWatch => '监控触发';

  @override
  String get whaleNotificationTabSystem => '系统';

  @override
  String get whaleNotificationMarkAllRead => '全部已读';

  @override
  String get whaleNotificationEmpty => '暂无通知';

  @override
  String get whaleSearchTooltip => '搜索';

  @override
  String get whaleNotificationTooltip => '通知';

  @override
  String get whaleNotificationCloseTooltip => '关闭';

  @override
  String get klineLoadError => 'K 线加载失败';

  @override
  String get tabMarket => '行情';

  @override
  String get tabWhale => '巨鲸';

  @override
  String get tabStrategy => '策略';

  @override
  String get tabMe => '我的';
}
