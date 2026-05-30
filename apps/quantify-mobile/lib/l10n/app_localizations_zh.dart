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
  String get commonYes => '是';

  @override
  String get commonNo => '否';

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
  String get aiAppBarParamsButton => '参数';

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
  String get backtestSheetSubtitle => '策略参数请通过对话调整';

  @override
  String get backtestFieldCapital => '初始资金';

  @override
  String get backtestFieldRange => '历史回测区间';

  @override
  String get backtestRangeCustom => '自定义';

  @override
  String get backtestFieldSlippage => '滑点';

  @override
  String get backtestFieldFee => '手续费';

  @override
  String get backtestFieldFillSource => '成交价来源';

  @override
  String get backtestFillOpen => '开盘价';

  @override
  String get backtestFillClose => '收盘价';

  @override
  String get backtestFillAvg => '逐笔成交价';

  @override
  String get backtestFieldPartialData => '允许部分覆盖数据继续回测';

  @override
  String get backtestShieldHint =>
      '回测结果仅供参考，不构成投资建议；AI 会保留当前对话的策略参数，想换参数请回到对话修改。';

  @override
  String get backtestCollapseButton => '收起';

  @override
  String get backtestStartButton => '确认并开始回测';

  @override
  String get backtestErrorInvalidDate => '请输入正确的起止时间（YYYY-MM-DD）';

  @override
  String get backtestErrorEndBeforeStart => '结束时间必须晚于开始时间';

  @override
  String get backtestErrorInvalidCapital => '请输入正数初始资金';

  @override
  String get backtestErrorInvalidSlippage => '请输入非负滑点（bps）';

  @override
  String get backtestErrorInvalidFee => '请输入非负手续费（bps）';

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
  String get backtestProgressTitle => '回测进行中';

  @override
  String get backtestProgressSubtitle => '正在回放历史 K 线，请稍候…';

  @override
  String get backtestProgressCancel => '取消回测';

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
  String get deployExchangeEmptyHint => '尚未配置任何交易所 API，添加后再试。';

  @override
  String get deployGoConfigureButton => '添加 API';

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
  String get deployRiskBannerOk => '风控通过 · 严格按方案执行';

  @override
  String get deployFooterSafety => '我们绝不持有你的密钥，签名仅在你的设备完成';

  @override
  String get deployExchangeTagOnchain => '链上';

  @override
  String get deployExchangeTagRecommended => '推荐';

  @override
  String get deployUnauthorizedTitle => '授权步骤';

  @override
  String get deployUnauthorizedSubtitle => '3 步完成，全程加密';

  @override
  String get deployUnauthorizedIdentityWarning => '未授权 · 无法接收订单';

  @override
  String get deployUnauthorizedStep1Title => '在交易所创建 API Key';

  @override
  String get deployUnauthorizedStep1Sub => '登录交易所 → API 管理 → 创建新密钥';

  @override
  String get deployUnauthorizedStep2Title => '仅勾选「读取 + 现货/合约下单」';

  @override
  String get deployUnauthorizedStep2Sub => '务必关闭「提币」权限，服务端会二次校验';

  @override
  String get deployUnauthorizedStep3Title => '把 API Key / Secret 粘到 Quantify';

  @override
  String get deployUnauthorizedStep3Sub => '加密存储在你的设备本地，不会上传';

  @override
  String get deployUnauthorizedWithdrawWarning =>
      '必须关闭提币权限。我们会再校验一次，发现允许提币的密钥会立即拒绝部署。';

  @override
  String get deployUnauthorizedConsent =>
      '我已了解：API 密钥将仅用于按本方案执行交易，可以随时在「我的 → API 管理」撤销。';

  @override
  String get deployUnauthorizedOpenFormButton => '打开 API 配置';

  @override
  String get deployUnauthorizedCancelButton => '取消';

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
  String get authLoginWelcome => '欢迎回来';

  @override
  String get authLoginWelcomeSubtitle => '使用邮箱或 Telegram 继续';

  @override
  String get authLoginOr => '或者';

  @override
  String get authLoginEmailLabel => '邮箱';

  @override
  String get authLoginPasswordLabel => '密码';

  @override
  String get authLoginPasswordHint => '至少 6 位';

  @override
  String get authLoginButton => '登录';

  @override
  String get authLoginTelegramButton => '通过 Telegram 登录';

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
  String get authLoginHeroTitleLine1 => '把交易想法';

  @override
  String get authLoginHeroTitleLine2 => '变成可回测的策略';

  @override
  String get authLoginHeroSubtitle => '对话生成 · 历史回测 · API 部署';

  @override
  String get authLoginForgotPassword => '忘记?';

  @override
  String get authLoginGuestButton => '以游客身份先看看';

  @override
  String get authLoginGuestHint => '· 无需注册';

  @override
  String get authLoginTermsPrefix => '继续即表示同意 ';

  @override
  String get authLoginTermsLink => '服务条款';

  @override
  String get authLoginTermsAnd => ' 与 ';

  @override
  String get authLoginPrivacyLink => '隐私政策';

  @override
  String get authLoginGuestFailedPrefix => '游客登录失败：';

  @override
  String get authLoginForgotMockToast => '重置密码（mock）';

  @override
  String get marketHomeTitle => '行情';

  @override
  String get marketHomeTabWatchlist => '自选';

  @override
  String get marketHomeTabSpot => '现货';

  @override
  String get marketHomeTabPerp => '合约';

  @override
  String get marketHomeTabGainers => '涨幅榜';

  @override
  String get marketHomeTabLosers => '跌幅榜';

  @override
  String get marketHomeLoadError => '行情加载失败';

  @override
  String get marketHomeEmpty => '暂无行情';

  @override
  String get marketHomeWatchlistEmpty => '暂无自选';

  @override
  String get marketHomeSearchEmpty => '无匹配结果';

  @override
  String get marketHomeSearchTooltip => '搜索';

  @override
  String get marketHomeSearchClose => '关闭搜索';

  @override
  String get marketHomeSearchPlaceholder => '搜索币种 · BTC, ETH, SOL…';

  @override
  String get marketHomeNotificationTooltip => '通知';

  @override
  String get marketHomeColumnName => '名称 / 24H量';

  @override
  String get marketHomeColumnPrice => '最新价';

  @override
  String get marketHomeColumnChange => '24H 涨跌';

  @override
  String get marketLongShortTitle => '多空比';

  @override
  String get marketLongShortSubtitle => '全市场永续合约 · 4H';

  @override
  String get marketLongShortLoadError => '多空比加载失败';

  @override
  String get marketLongShortHistory => '历史';

  @override
  String get marketLongShortHistorySection => '历史多空比';

  @override
  String get marketLongShortHeroSuffix => '全市场';

  @override
  String marketLongShortTotalNotional(String total) {
    return '$total 总持仓 · 4H 数据';
  }

  @override
  String get marketLongShortLongHolding => '多头持仓';

  @override
  String get marketLongShortShortHolding => '空头持仓';

  @override
  String get marketLongShortExchangesTitle => '交易所分布';

  @override
  String get marketLongShortExchangesSortBy => '按多头量排序';

  @override
  String get marketLongShortRefreshTooltip => '刷新';

  @override
  String get marketLongShortLive => 'LIVE';

  @override
  String marketLongShortRowLongPct(String pct) {
    return '多 $pct%';
  }

  @override
  String marketLongShortRowShortPct(String pct) {
    return '空 $pct%';
  }

  @override
  String get marketDetailSymbolNotFound => '未找到该交易对';

  @override
  String get marketDetailTickerPrefix => '行情详情：';

  @override
  String get marketDetailSectionOrderbook => '盘口';

  @override
  String get marketDetailBuyButton => '买入 / 做多';

  @override
  String get marketDetailBuySubLabel => '开多 · 10x';

  @override
  String get marketDetailSellButton => '卖出 / 做空';

  @override
  String get marketDetailSellSubLabel => '开空 · 10x';

  @override
  String get marketDetailSubtitlePerpBinance => '永续 · Binance';

  @override
  String get marketDetail24hHigh => '24H 高';

  @override
  String get marketDetail24hLow => '24H 低';

  @override
  String get marketDetail24hVolume => '24H 量';

  @override
  String get marketDetailOpenInterest => '持仓量';

  @override
  String get marketDetailPanelOrderbook => '盘口';

  @override
  String get marketDetailPanelTrades => '成交';

  @override
  String get marketDetailPanelDepth => '深度图';

  @override
  String get marketDetailColTime => '时间';

  @override
  String get marketDetailColPrice => '价格';

  @override
  String get marketDetailColQty => '数量';

  @override
  String get marketDetailDepthBid => 'BID';

  @override
  String get marketDetailDepthSpread => 'SPREAD';

  @override
  String get marketDetailDepthAsk => 'ASK';

  @override
  String get orderbookViewBoth => '双向';

  @override
  String get orderbookViewAsks => '卖单';

  @override
  String get orderbookViewBids => '买单';

  @override
  String get orderbookPrecisionTitle => '价格精度';

  @override
  String get orderbookRefreshFuture => '刷新（即将上线）';

  @override
  String get orderbookSortFuture => '排序（即将上线）';

  @override
  String get tradesTabLatest => '最新成交';

  @override
  String get tradesTabBig => '大额成交';

  @override
  String get tradesSortTooltip => '排序';

  @override
  String get marketDetailStarTooltip => '收藏';

  @override
  String get marketDetailMoreTooltip => '更多';

  @override
  String get marketDetailFavoriteAddedToast => '已加入自选';

  @override
  String get marketDetailFavoriteRemovedToast => '已移出自选';

  @override
  String get marketDetailMoreSheetTitle => '更多操作';

  @override
  String get marketDetailMoreCopySymbol => '复制交易对';

  @override
  String get marketDetailMoreCopiedToast => '已复制交易对';

  @override
  String get marketDetailMoreShare => '分享';

  @override
  String get marketDetailMoreAlert => '价格提醒';

  @override
  String get marketDetailMoreSwitchExchange => '切换交易所';

  @override
  String get marketDetailMoreComingSoon => '即将上线';

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
  String tradeOrderSheetHeaderTitleBuy(Object symbol) {
    return '买入 / 做多 $symbol';
  }

  @override
  String tradeOrderSheetHeaderTitleSell(Object symbol) {
    return '卖出 / 做空 $symbol';
  }

  @override
  String tradeOrderSheetHeaderSubtitle(Object pair, Object exchange) {
    return '$pair · 永续 · $exchange';
  }

  @override
  String get tradeOrderSheetCloseTooltip => '关闭';

  @override
  String get tradeOrderSheetLeverageGridTitle => '选择杠杆倍数';

  @override
  String get tradeOrderSheetReferenceLatest => '最新';

  @override
  String get tradeOrderSheetReferenceBid1 => '买一';

  @override
  String get tradeOrderSheetReferenceAsk1 => '卖一';

  @override
  String tradeOrderSheetAvailableLabel(Object amount) {
    return '可用 $amount USDT';
  }

  @override
  String get tradeOrderSheetMarketHintPrefix => '市价立即成交 · 参考价 ';

  @override
  String get tradeOrderSheetMarketHintSuffix => ' USDT';

  @override
  String get tradeOrderSheetTpsl => '止盈 / 止损';

  @override
  String get tradeOrderSheetStatMargin => '保证金';

  @override
  String get tradeOrderSheetStatNotional => '名义价值';

  @override
  String get tradeOrderSheetStatFee => '手续费 (taker)';

  @override
  String get tradeOrderSheetStatTpReturn => '止盈预计收益';

  @override
  String get tradeOrderSheetStatSlLoss => '止损预计损失';

  @override
  String get tradeOrderSheetRiskHint => '提交后由 AI 风控自动检查仓位与最大回撤';

  @override
  String get tradeOrderSheetSubmitEmpty => '请选择数量';

  @override
  String get tradeOrderSheetSubmitting => '提交中…';

  @override
  String tradeOrderSheetSubmitConfirmBuy(Object amount, Object base) {
    return '确认买入 $amount $base';
  }

  @override
  String tradeOrderSheetSubmitConfirmSell(Object amount, Object base) {
    return '确认卖出 $amount $base';
  }

  @override
  String get orderbookLoadError => '盘口加载失败';

  @override
  String get meHomeLoadErrorPrefix => '加载失败：';

  @override
  String get meStatsActiveStrategies => '活跃策略';

  @override
  String get meStatsCumulativeReturn => '累计收益';

  @override
  String get meStatsWinRate => '胜率';

  @override
  String get meHeaderCopyUid => '复制 UID';

  @override
  String get meHeaderUidCopied => 'UID 已复制';

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
  String get meSettingsTelegramHandle => '@victor_qf';

  @override
  String get meSettingsSecurity => '安全设置';

  @override
  String get meSettingsSecurityValue => '双重认证 · 已开启';

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
  String get meApiFormPermissionSection => '授权权限';

  @override
  String get meApiFormPermAccountRead => '读取账户与持仓';

  @override
  String get meApiFormPermSpotOrder => '现货下单';

  @override
  String get meApiFormPermFuturesOrder => '合约下单';

  @override
  String get meApiFormPermRequired => '必需';

  @override
  String get meApiFormPermOptional => '可选';

  @override
  String get meApiFormPermWithdrawLabel => '提币';

  @override
  String get meApiFormPermWithdrawValue => '必须关闭';

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
  String get meApiFormDefaultLabel => '默认';

  @override
  String get meApiFormSaveFailedPrefix => '保存失败：';

  @override
  String get meApiFormSaveFailed => '保存失败，请稍后重试';

  @override
  String get meApiFormApiKeyLabel => 'API Key';

  @override
  String get meApiFormSecretLabel => 'Secret';

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
  String get themeSettingsSyncSubtitle => '此设置会同步到 Web 和 App';

  @override
  String get themeSettingsSyncFootnote =>
      '当前主题仅保存在本设备；接入账号同步后，将在 Web 与 App 之间随登录自动应用。';

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
  String get themeToggleAutoFollowSystem => '自动跟随系统';

  @override
  String get themeToggleReduceMotion => '减少动画';

  @override
  String get strategyHomeTitle => '策略广场';

  @override
  String get strategyHomeSubtitle => '精选策略 · 一键载入对话';

  @override
  String get strategyHomeSearchHint => '搜索策略 · 币对 · 作者';

  @override
  String get strategyHomeEmpty => '暂无匹配策略';

  @override
  String get strategyCategoryTrend => '趋势';

  @override
  String get strategyCategoryGrid => '网格';

  @override
  String get strategyCategoryArbitrage => '套利';

  @override
  String get strategyCategoryReversal => '反转';

  @override
  String get strategyCategoryHedge => '对冲';

  @override
  String get strategyCategoryHighFreq => '高频';

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
  String strategyHomeLoadedToast(String name) {
    return '「$name」已载入对话';
  }

  @override
  String get strategyHomeFeaturedBadge => '本周推荐';

  @override
  String get strategyHomeFeaturedSubtitle => '市场中性 · 低回撤';

  @override
  String get strategyHomeFeaturedView => '查看 →';

  @override
  String get strategyHomeStatCagr => 'CAGR';

  @override
  String get strategyHomeStatSharpe => 'Sharpe';

  @override
  String get strategyHomeStatDrawdown => '回撤';

  @override
  String get strategyHomeSortHot => '热门';

  @override
  String get strategyHomeSortReturn => '收益';

  @override
  String get strategyHomeSortSharpe => 'Sharpe';

  @override
  String get strategyHomeSortLowDrawdown => '低回撤';

  @override
  String get strategyHomeSortLabel => '排序';

  @override
  String strategyHomeResultCount(int count) {
    return '$count 个';
  }

  @override
  String get strategyHomeFilterButton => '筛选 & 排序';

  @override
  String get strategyHomeSheetCategory => '类型';

  @override
  String get strategyHomeSheetSort => '排序方式';

  @override
  String strategyHomeSheetApply(int count) {
    return '查看 $count 个结果';
  }

  @override
  String get strategyBadgeHot => '🔥 热门';

  @override
  String get strategyBadgeNew => 'NEW';

  @override
  String get strategyBadgeOfficial => '官方';

  @override
  String get strategyBadgePro => 'PRO';

  @override
  String get strategyCardStatSharpe => 'Sharpe';

  @override
  String get strategyCardStatDrawdown => '回撤';

  @override
  String get strategyCardStatWinRate => '胜率';

  @override
  String get strategyCardStatUsers => '使用';

  @override
  String get strategyDetailEquityTab7d => '7D';

  @override
  String get strategyDetailEquityTab30d => '30D';

  @override
  String get strategyDetailEquityTab90d => '90D';

  @override
  String get strategyDetailEquityTab1y => '1Y';

  @override
  String get strategyDetailParamsTitle => '策略参数';

  @override
  String get strategyDetailParamType => '类型';

  @override
  String get strategyDetailParamSymbol => '交易品种';

  @override
  String get strategyDetailParamPeriod => '交易周期';

  @override
  String get strategyDetailParamStopLoss => '止损';

  @override
  String get strategyDetailParamPosition => '仓位';

  @override
  String get strategyDetailParamLeverage => '杠杆';

  @override
  String get strategyDetailReviewsTitle => '用户评价';

  @override
  String get strategyDetailReviewsEmpty => '暂无评价';

  @override
  String get strategyDetailShareButton => '分享';

  @override
  String get strategyDetailShareToast => '已复制策略链接到剪贴板';

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
  String get whaleProfileTitle => '地址详情';

  @override
  String get whaleProfileTabOverview => '概览';

  @override
  String get whaleProfileTabStats => '交易统计';

  @override
  String get whaleProfileCopyTooltip => '复制地址';

  @override
  String get whaleProfileCopied => '地址已复制';

  @override
  String get whaleProfileAssetSummaryPrefix => '主要持仓 · ';

  @override
  String get whaleProfileHoldingsValueLabel => '总持仓估值';

  @override
  String get whaleProfileSectionHoldings => '持仓';

  @override
  String get whaleProfileSectionRecentActions => '近期动作';

  @override
  String get whaleProfileRecentActionsEmpty => '暂无近期动作';

  @override
  String get whaleProfileStatPnl => '总盈亏';

  @override
  String get whaleProfileStatWinRate => '胜率';

  @override
  String whaleProfileWinRateValue(int pct) {
    return '$pct%';
  }

  @override
  String get whaleProfileStatRealized => '已实现';

  @override
  String get whaleProfileStatUnrealized => '未实现';

  @override
  String get whaleProfileDirectionBias => '方向偏好';

  @override
  String get whaleProfileLong => '做多';

  @override
  String get whaleProfileShort => '做空';

  @override
  String get whaleProfileSectionAssetPerf => '资产表现';

  @override
  String get whaleProfileLoadError => '地址详情加载失败';

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
  String whaleNotificationUnreadBadge(int count) {
    return '$count 条未读';
  }

  @override
  String get whaleNotificationSubtitle => '巨鲸预警 · 监控触发 · 资金流向';

  @override
  String get whaleNotificationFooterHint => '仅显示最近 24 小时通知';

  @override
  String get whaleNotificationSettings => '通知设置';

  @override
  String get whaleNotifKindAlert => '巨鲸预警';

  @override
  String get whaleNotifKindWatch => '监控触发';

  @override
  String get whaleNotifKindFlow => '资金流向';

  @override
  String get whaleNotifKindSystem => '系统消息';

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

  @override
  String get liveStrategyEntryTitle => '实盘策略';

  @override
  String get liveStrategyEntrySubtitle => '查看运行状态、持仓与收益';

  @override
  String get liveListTitle => '实盘策略';

  @override
  String get liveListTotalAssets => '总资产 (持仓 + 可用)';

  @override
  String get liveListTodayPnl => '今日盈亏';

  @override
  String get liveListTotalPnl => '累计盈亏';

  @override
  String get liveListCapital => '投入本金';

  @override
  String get liveFilterAll => '全部';

  @override
  String get liveFilterRunning => '运行中';

  @override
  String get liveFilterPaused => '已暂停';

  @override
  String get liveFilterStopped => '已停止';

  @override
  String get liveStoppedRetentionHint =>
      '已停止策略保留 30 天，期间可随时恢复或导出历史。超期后会自动永久删除。';

  @override
  String get liveEmptyTitle => '暂无实盘策略';

  @override
  String get liveEmptyHint => '从 AI 对话生成并部署策略后，会在这里追踪运行状态与收益。';

  @override
  String get liveCreateFromAi => '从 AI 对话创建新策略';

  @override
  String get liveSortComingSoon => '筛选与排序即将上线';

  @override
  String get liveLoadError => '实盘策略加载失败';

  @override
  String get liveStatusRunning => '运行中';

  @override
  String get liveStatusPaused => '已暂停';

  @override
  String get liveStatusWarning => '需关注';

  @override
  String get liveStatusStopped => '已停止';

  @override
  String get liveDetailTitle => '策略详情';

  @override
  String get liveDetailTotalPnl => '累计盈亏';

  @override
  String get liveTabOverview => '概览';

  @override
  String get liveTabPositions => '持仓';

  @override
  String get liveTabHistory => '交易记录';

  @override
  String get liveTabParams => '参数';

  @override
  String get liveStatToday => '今日盈亏';

  @override
  String get liveStatTodayPct => '今日 %';

  @override
  String get liveStatTotalPct => '累计 %';

  @override
  String get liveStatCapital => '投入本金';

  @override
  String get liveStatTrades => '交易笔数';

  @override
  String get liveStatWinRate => '胜率';

  @override
  String get liveStatRunFor => '运行天数';

  @override
  String get liveStatExchange => '交易所';

  @override
  String get liveStatTradesUnit => '笔';

  @override
  String get liveAiObservationLabel => 'AI 观察';

  @override
  String get liveAiObservationWarning =>
      '近 3 笔交易连续止损，日内已亏损接近设定上限。建议暂停或在对话中调整止损阈值。';

  @override
  String get liveAiObservationPaused => '当前已暂停，持仓已平。开启后会等待下一个开仓信号触发。';

  @override
  String get liveAiObservationRunning => '策略运行平稳，近 7 天胜率高于回测均值。波动率上升时可考虑降仓位。';

  @override
  String get liveArchiveSectionTitle => '策略档案';

  @override
  String get liveArchiveScript => '策略脚本';

  @override
  String get liveArchiveScriptSub => '部署时生成';

  @override
  String get liveArchiveBacktest => '回测记录';

  @override
  String get liveArchiveBacktestSub => '部署前的历史回测结果';

  @override
  String get liveArchiveDeploy => '部署配置';

  @override
  String get liveArchiveDeploySub => '初始资金 / 仓位 / 风控';

  @override
  String get liveArchiveComingSoon => '即将上线';

  @override
  String get livePositionEmptyTitle => '策略已暂停';

  @override
  String get livePositionEmptyHint => '持仓已平，等待开启后接收新信号';

  @override
  String get livePositionEntry => '入场价';

  @override
  String get livePositionCurrent => '当前价';

  @override
  String get livePositionStop => '止损价';

  @override
  String get livePositionStopLabel => '止损';

  @override
  String get livePositionStopDistance => '距止损';

  @override
  String get livePositionHold => '持仓';

  @override
  String get livePositionSideLong => '多';

  @override
  String get livePositionSideShort => '空';

  @override
  String get liveParamsTuneInAi => '在 AI 对话中调优参数';

  @override
  String get liveActionStart => '开启策略';

  @override
  String get liveActionPause => '暂停策略';

  @override
  String get liveActionResume => '恢复策略';

  @override
  String get liveActionDelete => '删除';

  @override
  String get liveActionDeletePermanent => '永久删除';

  @override
  String get liveActionComingSoon => '策略操作即将上线';

  @override
  String get deployViewLiveStrategies => '查看实盘策略';

  @override
  String get whaleSearchHint => '输入地址 / 标签 / 资产 / 交易所';

  @override
  String get whaleSearchPrompt => '搜索地址、标签、资产、交易所或事件类型';

  @override
  String get whaleSearchEmpty => '未找到匹配结果';

  @override
  String get whaleSearchKindAddress => '地址';

  @override
  String get whaleSearchKindLabel => '标签';

  @override
  String get whaleSearchKindAsset => '资产';

  @override
  String get whaleSearchKindExchange => '交易所';

  @override
  String get whaleSearchKindEventType => '事件类型';

  @override
  String get whaleWatchEmpty => '暂无监控地址，点击下方添加';

  @override
  String get whaleRuleAddTitle => '添加地址监控';

  @override
  String get whaleRuleEditTitle => '编辑监控规则';

  @override
  String get whaleRuleAddressLabel => '监控地址';

  @override
  String get whaleRuleAddressHint => '0x… 地址或缩写';

  @override
  String get whaleRuleAddressRequired => '请输入监控地址';

  @override
  String get whaleRuleAddressInvalid => '地址格式不正确';

  @override
  String get whaleRuleThresholdLabel => '触发阈值（USD）';

  @override
  String get whaleRuleThresholdHint => '例如 1000000';

  @override
  String get whaleRuleThresholdRequired => '请输入触发阈值';

  @override
  String get whaleRuleThresholdInvalid => '阈值需为大于 0 的数字';

  @override
  String get whaleRuleDirectionLabel => '监控方向';

  @override
  String get whaleRuleDirectionInflow => '流入';

  @override
  String get whaleRuleDirectionOutflow => '流出';

  @override
  String get whaleRuleDirectionBoth => '双向';

  @override
  String get whaleRuleChannelLabel => '推送渠道';

  @override
  String get whaleRuleChannelPush => '应用推送';

  @override
  String get whaleRuleChannelTelegram => 'Telegram';

  @override
  String get whaleRuleChannelEmail => '邮件';

  @override
  String get whaleRuleChannelRequired => '至少选择一个推送渠道';

  @override
  String get whaleRuleCreate => '创建监控';

  @override
  String get whaleRuleSave => '保存';

  @override
  String get whaleRuleMenuTooltip => '监控规则操作';

  @override
  String get whaleRuleMenuEdit => '编辑';

  @override
  String get whaleRuleMenuMute => '静音';

  @override
  String get whaleRuleMenuUnmute => '取消静音';

  @override
  String get whaleRuleMenuDelete => '删除';

  @override
  String get whaleRuleDeleteTitle => '删除监控';

  @override
  String whaleRuleDeleteBody(String name) {
    return '确定删除对「$name」的监控吗？';
  }

  @override
  String get whaleRuleDeleteConfirm => '删除';
}
