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
  String get backtestFillMid => '中间价';

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
  String backtestRecap(Object strategy) {
    return '正在为「$strategy」配置回测参数';
  }

  @override
  String backtestRangeDataLabel(Object start, Object end) {
    return '数据范围: $start → $end';
  }

  @override
  String backtestRangeCustomSummary(Object days, Object bars) {
    return '共 $days 天 · 覆盖 $bars 根 15m K 线';
  }

  @override
  String get backtestCapitalPresetHint => '模拟资金，仅用于本次回测，不影响实盘';

  @override
  String get backtestFieldMarket => '交易市场';

  @override
  String get backtestMarketSpot => '现货';

  @override
  String get backtestMarketFutures => '合约';

  @override
  String get backtestFieldLeverage => '杠杆倍数';

  @override
  String get backtestLeverageHint => '回测会同步放大盈亏与资金占用';

  @override
  String get backtestLeverageWarn => '高杠杆会显著放大爆仓风险，请确认风险承受能力';

  @override
  String get backtestSectionMatching => '撮合参数';

  @override
  String get backtestSectionMatchingRight => '影响成交模拟';

  @override
  String get backtestHintSlippage => '按 bps 模拟下单偏离';

  @override
  String get backtestHintFee => '单边费率（taker）';

  @override
  String get backtestHintFillSource => 'K 线内成交价取值';

  @override
  String get backtestHintPartialData => '历史数据有缺口时怎么处理';

  @override
  String get backtestPartialAllow => '允许';

  @override
  String get backtestPartialDisallow => '不允许';

  @override
  String get backtestSummaryTitle => '本次回测设定';

  @override
  String get backtestSummaryRange => '区间';

  @override
  String get backtestSummaryCapital => '资金';

  @override
  String get backtestSummaryMarket => '市场';

  @override
  String get backtestSummaryMatching => '撮合';

  @override
  String get backtestSummaryData => '数据';

  @override
  String get backtestSummaryMarketSpot => '现货';

  @override
  String backtestSummaryMarketFutures(Object leverage) {
    return '合约 · $leverage';
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
  String get backtestSummaryDataAllow => '允许缺口续跑';

  @override
  String get backtestSummaryDataStrict => '严格要求完整';

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
  String get backtestResultStatusDone => '回测完成';

  @override
  String get backtestResultStatusDeployable => '可部署';

  @override
  String get backtestResultCumulativeNetValue => '累计净值';

  @override
  String get backtestResultCagrInline => 'CAGR';

  @override
  String get backtestResultDownloadLabel => '下载回测报告';

  @override
  String get backtestResultMetricCagr => 'CAGR';

  @override
  String get backtestResultMetricCagrSub => '年化复合收益';

  @override
  String get backtestResultMetricSharpeSub => '风险调整后收益';

  @override
  String get backtestResultMetricMaxDrawdownSub => '峰谷最大跌幅';

  @override
  String get backtestResultMetricCalmar => 'Calmar';

  @override
  String get backtestResultMetricCalmarSub => 'CAGR / |MDD|';

  @override
  String get backtestResultMetricWinRate => '胜率';

  @override
  String get backtestResultMetricWinRateSub => '盈利交易占比';

  @override
  String get backtestResultMetricProfitLoss => '盈亏比';

  @override
  String get backtestResultMetricProfitLossSub => '平均盈/平均亏';

  @override
  String get backtestResultMetricTotalTrades => '总交易';

  @override
  String get backtestResultMetricTotalTradesSub => '5 年内开仓次数';

  @override
  String get backtestResultMetricAvgHold => '平均持仓';

  @override
  String get backtestResultMetricAvgHoldSub => '单笔交易时长';

  @override
  String get backtestResultTabMonthly => '月度回报';

  @override
  String get backtestResultTabTrades => '交易记录';

  @override
  String get backtestResultTabRisk => '风险分析';

  @override
  String get backtestResultMonthlyLegendLabel => '月度 % 收益';

  @override
  String get backtestResultTradeSideLong => '多';

  @override
  String get backtestResultTradeSideShort => '空';

  @override
  String get backtestResultTradeHoldPrefix => '持仓';

  @override
  String get backtestResultAiPrefix => 'AI 评估：';

  @override
  String get backtestProgressTitle => '回测进行中';

  @override
  String get backtestProgressSubtitle => '正在回放历史 K 线，请稍候…';

  @override
  String get backtestProgressCancel => '取消回测';

  @override
  String backtestRunEta(Object seconds) {
    return '预计剩余 ${seconds}s';
  }

  @override
  String backtestRunReplayingPeriod(Object period) {
    return '正在回放 · $period';
  }

  @override
  String get backtestRunCounterProcessedBars => '已处理 K 线';

  @override
  String backtestRunCounterProcessedBarsSub(Object total) {
    return '/ $total';
  }

  @override
  String get backtestRunCounterTrades => '已生成交易';

  @override
  String backtestRunCounterTradesSub(Object wins, Object losses) {
    return '胜 $wins · 负 $losses';
  }

  @override
  String get backtestRunCounterMaxDrawdown => '当前最大回撤';

  @override
  String get backtestRunCounterCumReturn => '当前累计收益';

  @override
  String get backtestRunSectionEquity => '实时净值';

  @override
  String get backtestRunSectionLog => '引擎日志';

  @override
  String get backtestRunPrivacyNote => '回测在你设备本地运行，数据与策略均不上传。完成后可继续追问 AI 调整参数。';

  @override
  String get backtestRunLogLoad => '载入 BTC/USDT 15m K 线 · 52,416 条';

  @override
  String get backtestRunLogIndex => '索引 fast_MA(5) / slow_MA(20) ... ✓';

  @override
  String get backtestRunLogReplay => '回放开始 · 滑点 5bps · 手续费 2bps';

  @override
  String get backtestRunLogOpenLong1 => '触发开多 @ 41,820.50 · 仓位 100%';

  @override
  String get backtestRunLogCloseLong1 => '平多 @ 43,108.00 · +3.08%';

  @override
  String get backtestRunLogOpenLong2 => '触发开多 @ 44,260.00 · 仓位 100%';

  @override
  String get backtestRunLogStopLoss => '止损触发 @ 43,375.00 · -2.00%';

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
  String deployedBubbleStrategyId(Object id) {
    return '策略 ID $id · 当前运行中';
  }

  @override
  String get deployedBubbleArchivedNotice => '这条对话已归档，后续调整请新建方案或在实盘策略中操作。';

  @override
  String get deploySheetTitleAllocate => '资金配置';

  @override
  String get deploySheetTitlePreflight => '部署前检查';

  @override
  String deployStepIndicator(Object current, Object total) {
    return '$current/$total';
  }

  @override
  String get deployAllocateAmountLabel => '投入金额';

  @override
  String get deployAllocateAmountHint => '建议：首次部署不超过总资金的 30%';

  @override
  String get deployAllocatePerTradeLabel => '单笔仓位上限';

  @override
  String get deployAllocatePerTradeCaption => '每笔最多占用';

  @override
  String get deployAllocateMaxDailyLossLabel => '日内最大亏损';

  @override
  String get deployAllocateMaxDailyLossCaption => '触发后自动暂停当日交易';

  @override
  String get deployAllocateNotifySectionLabel => '通知';

  @override
  String get deployAllocateNotifyOpenLabel => '开仓时通知';

  @override
  String get deployAllocateNotifyOpenCaption => '推送 + 应用内消息';

  @override
  String get deployAllocateNotifyCloseLabel => '平仓时通知';

  @override
  String get deployAllocateNotifyCloseCaption => '推送 + 应用内消息';

  @override
  String get deployAllocateNotifyStopLossLabel => '触发止损时通知';

  @override
  String get deployAllocateNotifyStopLossCaption => '推送 + 邮件';

  @override
  String get deployAllocateNextButton => '下一步';

  @override
  String get deployPreflightStrategyName => 'BTC 趋势 · 双均线';

  @override
  String get deployPreflightStrategyMeta => 'BTC/USDT · 15m · 永续 · 5x';

  @override
  String deployPreflightScanning(Object done, Object total) {
    return '检测中 $done/$total';
  }

  @override
  String deployPreflightPassed(Object pass, Object total) {
    return '$pass/$total 通过';
  }

  @override
  String deployPreflightFailed(Object fail, Object total) {
    return '$fail/$total 未通过';
  }

  @override
  String get deployPreflightRecheck => '重新检测';

  @override
  String get deployPreflightRechecking => '检测中…';

  @override
  String deployPreflightApiOkTitle(Object exchange) {
    return '$exchange API 已绑定';
  }

  @override
  String get deployPreflightApiOkSub => '读取 + 现货 + 永续 · 未启用提币（安全）';

  @override
  String get deployPreflightBalanceOkTitle => '账户余额充足';

  @override
  String get deployPreflightBalanceOkSub => '可用资金满足部署所需，留有余裕';

  @override
  String get deployPreflightLatencyOkTitle => '网络与交易所时延正常';

  @override
  String get deployPreflightLatencyOkSub => '下单延时 < 200ms · 数据流稳定';

  @override
  String get deployPreflightBackButton => '返回';

  @override
  String get deployPreflightConfirmButton => '确认无误，立即部署';

  @override
  String get deployPreflightApiFailTitle => '交易所 API 未绑定';

  @override
  String get deployPreflightApiFailSub => '未检测到可用密钥，去绑定 API 后重试';

  @override
  String get deployPreflightBalanceFailTitle => '账户余额不足';

  @override
  String get deployPreflightBalanceFailSub => '可用资金低于部署所需，请充值或调低投入金额';

  @override
  String get deployPreflightLatencyFailTitle => '网络或交易所时延异常';

  @override
  String get deployPreflightLatencyFailSub => '下单延时偏高 · 数据流不稳定，建议稍后重试';

  @override
  String get deployConfirmSummaryReturn => '累计净值';

  @override
  String get deployConfirmSummarySharpe => 'Sharpe';

  @override
  String get deployConfirmSummaryMaxDrawdown => '最大回撤';

  @override
  String get deployConfirmFieldExchange => '交易所';

  @override
  String get deployConfirmFieldMarketType => '市场类型';

  @override
  String get deployConfirmFieldAccount => '选择账户';

  @override
  String get deployConfirmFieldLeverage => '部署杠杆';

  @override
  String get deployConfirmMarketPerp => '永续合约';

  @override
  String get deployConfirmFootnote => '以上为只读确认信息，确认后将按此方案部署实盘';

  @override
  String deployingTitle(Object exchange) {
    return '正在部署到 $exchange';
  }

  @override
  String get deployingCaption => '请勿关闭页面，通常需要 3-5 秒';

  @override
  String get deployingStepAuthTitle => '校验 API 权限';

  @override
  String get deployingStepAuthSub => '确认未开启提币 · 已启用现货+合约下单';

  @override
  String get deployingStepPushTitle => '推送策略到云端';

  @override
  String get deployingStepPushSub => '加密上传策略参数与风控规则';

  @override
  String get deployingStepNodeTitle => '启动执行节点';

  @override
  String get deployingStepNodeSub => '分配独立节点 · 同步交易所时间';

  @override
  String get deployingStepFeedTitle => '订阅实时行情';

  @override
  String get deployingStepFeedSub => 'BTC/USDT 15m · WebSocket 已连接';

  @override
  String get deployingStepReadyTitle => '就绪';

  @override
  String get deployingStepReadySub => '等待首个信号触发';

  @override
  String get deployDoneTitle => '部署成功';

  @override
  String deployDoneSubtitle(Object exchange) {
    return '策略已在 $exchange 实盘运行，首个信号触发后会推送提醒你';
  }

  @override
  String get deployDoneDetailStrategyId => '策略 ID';

  @override
  String get deployDoneDetailExchange => '交易所';

  @override
  String get deployDoneDetailSymbol => '交易对';

  @override
  String get deployDoneDetailAmount => '初始资金';

  @override
  String get deployDoneDetailLeverage => '杠杆';

  @override
  String get deployDoneDetailStartedAt => '启动时间';

  @override
  String get deployDoneDetailStatus => '状态';

  @override
  String get deployDoneStatusRunning => '运行中';

  @override
  String get deployDoneNextStepsLabel => '接下来你可以';

  @override
  String get deployDoneNextLiveTitle => '查看实盘策略';

  @override
  String get deployDoneNextLiveSub => '在「我的 → 实盘策略」追踪持仓和收益';

  @override
  String get deployDoneNextNotifyTitle => '开启价格通知';

  @override
  String get deployDoneNextNotifySub => 'BTC 突破关键位时第一时间收到推送';

  @override
  String get deployDoneNextTuneTitle => '继续在 AI 中调优';

  @override
  String get deployDoneNextTuneSub => '随时回到对话调整止损或参数';

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
  String get dataHubTitle => '数据';

  @override
  String get dataHubTabMarket => '行情数据';

  @override
  String get dataHubTabLongShort => '多空比';

  @override
  String get dataHubTabAggOrders => '聚合挂单';

  @override
  String get dataHubTabPredict => '预测市场';

  @override
  String get dataHubTabCoinStock => '币股';

  @override
  String get dataHubHintMarket => '自选 · 涨跌榜';

  @override
  String get dataHubHintLongShort => '永续合约 L/S';

  @override
  String get dataHubHintAggOrders => '跨所合并深度';

  @override
  String get dataHubHintPredict => '链上事件概率';

  @override
  String get dataHubHintCoinStock => '加密相关股票';

  @override
  String get dataHubNotificationTooltip => '通知';

  @override
  String get dataHubPlaceholderTitle => '即将上线';

  @override
  String get marketHomeColumnName => '名称 / 24H量';

  @override
  String get marketHomeColumnPrice => '最新价';

  @override
  String get marketHomeColumnChange => '24H 涨跌';

  @override
  String get marketLongShortTitle => '多空比';

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
  String get aggSubTabOrders => '聚合挂单';

  @override
  String get aggSubTabOpenInterest => '聚合持仓量';

  @override
  String get aggSubTabVolume => '聚合成交量';

  @override
  String get predMarketSubtitle => '基于链上数据的未来趋势预测';

  @override
  String get predMarketSearchHint => '搜索预测市场';

  @override
  String get predMarketSearchHotLabel => '热门话题';

  @override
  String get predMarketEmpty => '无匹配市场';

  @override
  String get predMarketDetailTitle => '市场详情';

  @override
  String get predMarketRules => '规则';

  @override
  String get predMarketResolutionSource => 'Resolution source';

  @override
  String get predMarketEventWindow => 'Event window';

  @override
  String get predMarketCreatedAt => '创建时间';

  @override
  String get predMarketVolumeLabel => '交易量';

  @override
  String get predMarketStatusOpen => 'OPEN';

  @override
  String get predMarketStatusClosed => 'CLOSED';

  @override
  String get coinStockTabAll => '全部';

  @override
  String get coinStockTabOther => '其他';

  @override
  String get coinStockSearchHint => '搜索公司 / 股票代码';

  @override
  String get coinStockSearchHotLabel => '热门标的';

  @override
  String get coinStockSearchEmpty => '无匹配公司';

  @override
  String get coinStockEmpty => '暂无匹配公司';

  @override
  String get coinStockStatMnav => 'MNAV';

  @override
  String get coinStockStatMcap => '市值';

  @override
  String get coinStockStatHoldValue => '持币价值';

  @override
  String get coinStockStatHoldQty => '持币量';

  @override
  String get coinStockSortPrice => '股价';

  @override
  String get coinStockSortChange => '24h 涨跌';

  @override
  String get coinStockSortBy => '按';

  @override
  String get coinStockSortTitle => '筛选 & 排序';

  @override
  String get coinStockSortMetricLabel => '指标';

  @override
  String get coinStockSortDirectionLabel => '排序方式';

  @override
  String get coinStockSortAsc => '升序';

  @override
  String get coinStockSortDesc => '降序';

  @override
  String get coinStockSortNone => '不排序';

  @override
  String coinStockSortApply(int count) {
    return '查看 $count 个结果';
  }

  @override
  String get coinStockDetailPrice => '当前股价 · USD';

  @override
  String get coinStockDetailOverview => '公司概况';

  @override
  String get coinStockDetailMetrics => '核心指标';

  @override
  String get coinStockChipListed => '上市';

  @override
  String get coinStockChipRelated => '关联';

  @override
  String get aggModeFutures => '合约';

  @override
  String get aggModeSpot => '现货';

  @override
  String get aggStat24hVolume => '24h 成交量';

  @override
  String get aggStat24hTurnover => '24h 成交额';

  @override
  String aggOrderbookTitle(String coin, String mode) {
    return '$coin/USD 实时订单($mode)';
  }

  @override
  String get aggColPrice => '价格(USDT)';

  @override
  String aggColQty(String coin) {
    return '数量($coin)';
  }

  @override
  String aggColTotal(String coin) {
    return '总计($coin)';
  }

  @override
  String get aggViewBoth => '双向';

  @override
  String get aggViewAsks => '卖单';

  @override
  String get aggViewBids => '买单';

  @override
  String get aggBestBidAsk => '买一 / 卖一';

  @override
  String get aggPrecisionTitle => '价格精度';

  @override
  String get aggExchangeSourceTitle => '交易所来源';

  @override
  String get aggExchangeSourceTooltip => '交易所来源设置';

  @override
  String get aggSelectAll => '全选';

  @override
  String get aggClearAll => '清空';

  @override
  String get aggCancel => '取消';

  @override
  String get aggDepthTitle => '订单深度';

  @override
  String get aggLiquidityHeatmap => '流动性热力图';

  @override
  String get aggDepthLegendBids => '买单累计';

  @override
  String get aggDepthLegendAsks => '卖单累计';

  @override
  String aggUnit(String coin) {
    return '单位: $coin';
  }

  @override
  String get aggOiColExchange => '交易所';

  @override
  String get aggOiColShare => '占比';

  @override
  String get aggOiColPosition => '持仓';

  @override
  String get aggOiCol24hChange => '24H变化';

  @override
  String get aggOiRowAll => '全部';

  @override
  String get aggCoinSearchHint => '搜索币种';

  @override
  String get aggCoinSearchHot => '热门币种';

  @override
  String get aggCoinSearchEmpty => '无匹配币种';

  @override
  String get aggNoData => '暂无数据';

  @override
  String get aggNoMatchExchange => '无匹配交易所';

  @override
  String get aggVolumeTotal => '总计';

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
  String get meSettingsLanguageSheetTitle => '语言';

  @override
  String get meSettingsLanguageOptionZh => '简体中文';

  @override
  String get meSettingsLanguageOptionEn => 'English';

  @override
  String get meSettingsTheme => '主题';

  @override
  String get meSettingsThemeValue => '跟随系统';

  @override
  String get meSettingsNotifications => '推送通知';

  @override
  String get meSettingsNotificationsValue => 'Telegram · 开启';

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
  String get meApiFormSecretKeyLabel => 'Secret Key';

  @override
  String get meApiFormPassphraseLabel => 'Passphrase';

  @override
  String get meApiFormPassphraseHint =>
      '创建 API Key 时由你自行设置的口令，交易所不会再次展示。三项缺一不可，否则无法签名下单。';

  @override
  String get meApiFormWalletAddressLabel => '主钱包地址';

  @override
  String get meApiFormAgentKeyLabel => 'Agent 私钥';

  @override
  String get meApiFormWalletHint =>
      '在 Hyperliquid → More → API 中生成 Agent Wallet，把它的私钥粘到这里。Agent 私钥只能下单、不能动资产；主钱包地址用于读取持仓。';

  @override
  String get meApiFormWalletWarningMust => 'Agent 钱包';

  @override
  String get meApiFormWalletWarningBody =>
      '仅有下单权限，永远无法转账或提币——主钱包资产始终由你掌控。请勿粘贴主钱包私钥。';

  @override
  String get meApiFormPermPerpSpotOrder => '永续 / 现货下单';

  @override
  String get meApiFormPermTransferWithdraw => '转账 / 提币';

  @override
  String get meApiFormPermAgentNoAccess => 'Agent 无权限';

  @override
  String get meApiFormEnvLabel => '环境';

  @override
  String get meApiFormEnvMainnetLabel => '主网';

  @override
  String get meApiFormEnvMainnetSub => '真实资金';

  @override
  String get meApiFormEnvTestnetLabel => '测试网';

  @override
  String get meApiFormEnvTestnetSub => '模拟资金';

  @override
  String get meApiFormTestnetSubtitle => '测试网 · 模拟资金 · 不影响真实账户';

  @override
  String get meApiFormTestnetWarningBold => '请前往 testnet.binance.vision ';

  @override
  String get meApiFormTestnetWarningBody =>
      '申请独立的测试网密钥（主网密钥不可用）。测试网币每 24h 自动重置，可放心调试策略。';

  @override
  String get meApiFormEndpointLabel => '接口域名';

  @override
  String get meApiFormPermWithdrawTestnetValue => '测试网无提币';

  @override
  String get meApiFormSaveTestnetButton => '保存测试网密钥';

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
  String get aiConfirmStrategy => '确认策略';

  @override
  String get aiConfirmSubtitle => '检查参数无误后开始回测';

  @override
  String get aiConfirmCancel => '取消';

  @override
  String get aiConfirmHeroSubtitle => '由当前对话生成 · 可在对话中继续微调';

  @override
  String get aiConfirmLogicTitle => '策略逻辑';

  @override
  String get aiConfirmEditInChat => '在对话中修改';

  @override
  String get aiConfirmRuleIf => 'IF';

  @override
  String get aiConfirmRuleThen => 'THEN';

  @override
  String get aiConfirmRuleSep => 'AND AT THEN';

  @override
  String get aiConfirmExecuteTitle => 'EXECUTE';

  @override
  String get aiConfirmExecExchange => '交易所';

  @override
  String get aiConfirmExecSymbol => '标的';

  @override
  String get aiConfirmExecPeriod => '周期';

  @override
  String get aiConfirmExecPosition => '仓位';

  @override
  String get aiConfirmExecMarket => '市场';

  @override
  String get aiConfirmRiskBadge => '风控';

  @override
  String get aiConfirmAdviceTitle => 'AI 提示';

  @override
  String get aiConfirmDisclaimer => '回测基于历史数据，无法保证实盘表现。部署前请使用模拟账户验证。';

  @override
  String get aiConfirmBackToChat => '返回对话';

  @override
  String get aiConfirmNextScript => '下一步：策略脚本';

  @override
  String get aiStartBacktestPrompt => '需要我开始回测吗?';

  @override
  String get aiParamsBadgePrefix => '已为你识别为';

  @override
  String get aiParamsBadgeSuffix => '类策略，建议参数：';

  @override
  String get aiParamsLockedBanner => '已归档 · 仅供查看';

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
  String get strategyHomeFavorites => '收藏';

  @override
  String get strategyHomeFavEmptyTitle => '还没有收藏的策略';

  @override
  String get strategyHomeFavEmptyHint => '点击策略卡右上角的 ☆ 星标，把感兴趣的策略收藏到这里。';

  @override
  String get strategyHomeFavEmptyCta => '去策略广场看看';

  @override
  String get strategySearchButton => '搜索';

  @override
  String get strategySearchTrendingLabel => '热门搜索';

  @override
  String get strategySearchHistoryLabel => '搜索历史';

  @override
  String get strategySearchClearHistory => '清空搜索历史';

  @override
  String get strategySearchGuessLabel => '猜你想跟';

  @override
  String get strategySearchTagSection => '标签';

  @override
  String get strategySearchAuthorSection => '作者';

  @override
  String get strategySearchStrategySection => '策略';

  @override
  String strategySearchTagChip(Object tag) {
    return '$tag 策略';
  }

  @override
  String strategySearchAuthorCount(int count) {
    return '$count 个策略';
  }

  @override
  String strategySearchNoResults(Object query) {
    return '未找到「$query」相关结果';
  }

  @override
  String strategySearchStratWinRate(int win) {
    return '胜率 $win%';
  }

  @override
  String strategySearchStratFollow(int users) {
    return '$users 跟单';
  }

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
  String get strategyDetailFavoriteTooltip => '收藏';

  @override
  String get strategyDetailCloseTooltip => '关闭';

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
  String get strategyDetailProfitLossRatio => '盈亏比';

  @override
  String get strategyDetailTradeCount => '交易次数';

  @override
  String get strategyDetailUsers => '使用人数';

  @override
  String get strategyDetailDescriptionTitle => '策略说明';

  @override
  String strategyDetailDescriptionBody(String desc, String tag) {
    return '$desc策略基于$tag框架，使用历史数据回测验证。建议在熟悉风险参数后再投入资金。';
  }

  @override
  String strategyDetailCumulativeReturn(String period) {
    return '$period 累计收益';
  }

  @override
  String get strategyDetailRunButton => '运行';

  @override
  String get strategyCardLoadConversation => '载入对话';

  @override
  String get strategyCardRun => '运行';

  @override
  String get strategyDetailLoadConversation => '载入到对话';

  @override
  String strategyHomeLoadedToast(String name) {
    return '「$name」已载入对话';
  }

  @override
  String strategyHomeStartedToast(String name) {
    return '「$name」已启动 · 进入实盘监控';
  }

  @override
  String get strategyHomeFeaturedBadge => '本周推荐';

  @override
  String get strategyHomeFeaturedSubtitle => '市场中性 · 低回撤';

  @override
  String get strategyHomeFeaturedView => '查看详情';

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
  String strategyHomeSortByOption(String label) {
    return '按 $label 排序';
  }

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
  String get whaleDiscoverSubtitle => '发现最有价值的交易者';

  @override
  String get whaleSortLabel => '排序';

  @override
  String get whaleSortByLabel => '排序方式:';

  @override
  String get whaleSortWinRate => '胜率';

  @override
  String get whaleSortAum => '账户总价值';

  @override
  String get whaleSortPnl => '已实现盈亏';

  @override
  String get whaleLeaderPnlLabel => '已实现盈亏(1月)';

  @override
  String get whaleLeaderPositionsLabel => '当前持仓';

  @override
  String get whaleLeaderWinRateLabel => '胜率(1月)';

  @override
  String get whaleLeaderAiTagsLabel => 'AI 标签';

  @override
  String get whaleLeaderTagsEmpty => '暂无';

  @override
  String get whaleLeaderCopyTooltip => '复制地址';

  @override
  String get whaleLeaderCopied => '地址已复制';

  @override
  String get whaleLeaderTrendTooltip => '交易统计';

  @override
  String get whaleHoldingsBadge => '巨鲸';

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
  String get whaleHoldingsSectionTitle => '巨鲸持仓';

  @override
  String get whaleHoldingsEmpty => '无匹配持仓';

  @override
  String get whaleHoldingsCoinAll => '全部';

  @override
  String get whaleHoldingsFilterDir => '方向';

  @override
  String get whaleHoldingsFilterPnl => '盈亏';

  @override
  String get whaleHoldingsDirLong => '做多';

  @override
  String get whaleHoldingsDirShort => '做空';

  @override
  String get whaleHoldingsPnlProfit => '盈利';

  @override
  String get whaleHoldingsPnlLoss => '亏损';

  @override
  String get whaleHoldingsSortValue => '持仓价值';

  @override
  String get whaleHoldingsSortMargin => '保证金';

  @override
  String get whaleHoldingsSortTime => '创建时间';

  @override
  String get whaleHoldingsColValue => '持仓价值';

  @override
  String get whaleHoldingsColPnl => '未实现盈亏';

  @override
  String get whaleHoldingsColMargin => '保证金';

  @override
  String get whaleHoldingsColOpen => '开盘价';

  @override
  String get whaleHoldingsColLiq => '清算价';

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
  String get whaleProfileShareTooltip => '分享';

  @override
  String get whaleProfileCopied => '地址已复制';

  @override
  String get whaleProfileWatch => '一键监控';

  @override
  String get whaleProfileRefreshTooltip => '刷新';

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
  String get whaleProfileTabBasic => '基本信息';

  @override
  String get whaleProfileTabSpot => '现货持仓';

  @override
  String get whaleProfileTabPerp => '永续合约持仓';

  @override
  String get whaleProfileTabOrders => '挂单';

  @override
  String get whaleProfileTabTrades => '最近成交';

  @override
  String get whaleProfileTabHistory => '历史委托';

  @override
  String get whaleProfileColShare => '占比';

  @override
  String get whaleProfileColQty => '数量';

  @override
  String get whaleProfileColPrice => '价格';

  @override
  String get whaleProfileColValue => '价值';

  @override
  String get whaleProfileColChain => '链';

  @override
  String get whaleProfileColPosValue => '持仓价值';

  @override
  String get whaleProfileColUnrealized => '未实现盈亏';

  @override
  String get whaleProfileColEntry => '入场均价';

  @override
  String get whaleProfileColMark => '标记价格';

  @override
  String get whaleProfileColLiq => '清算价格';

  @override
  String get whaleProfileColMargin => '保证金';

  @override
  String get whaleProfileColFunding => '资金费';

  @override
  String get whaleProfileColTpSl => '止盈/止损';

  @override
  String get whaleProfileCross => '全仓';

  @override
  String get whaleProfileColTime => '时间';

  @override
  String get whaleProfileColTrigger => '触发条件';

  @override
  String get whaleProfileColStatus => '状态';

  @override
  String get whaleProfileColOrderId => '订单 ID';

  @override
  String get whaleProfileColType => '类型';

  @override
  String get whaleProfileColStart => '起始仓位';

  @override
  String get whaleProfileColClosedPnl => '已平盈亏';

  @override
  String get whaleProfileColFee => '费用';

  @override
  String get whaleProfileColExecStatus => '执行状态';

  @override
  String get whaleProfileStatAccountValue => '账户总价值';

  @override
  String get whaleProfileStatAvailMargin => '可用保证金';

  @override
  String get whaleProfileStatWithdrawable => '可提取';

  @override
  String get whaleProfileStatPositionValue => '总持仓价值';

  @override
  String get whaleProfileStatLeverage => '杠杆比';

  @override
  String get whaleProfileLegendPerp => '永续合约';

  @override
  String get whaleProfileLegendSpot => '现货';

  @override
  String get whaleProfilePerpTotalValue => '永续合约总价值';

  @override
  String get whaleProfileMarginUsage => '平均保证金使用率';

  @override
  String get whaleProfileDirectionBias2 => '方向偏差';

  @override
  String get whaleProfileBiasNeutral => '中性';

  @override
  String get whaleProfileLongPosition => '多头持仓';

  @override
  String get whaleProfileShortPosition => '空头持仓';

  @override
  String get whaleProfilePositionDist => '仓位分布';

  @override
  String get whaleProfileLongValue => '多头价值';

  @override
  String get whaleProfileShortValue => '空头价值';

  @override
  String get whaleProfileCurrentPosition => '当前持仓';

  @override
  String get whaleProfileRoi => '投资回报率';

  @override
  String get whaleProfilePerfTitle => '交易表现';

  @override
  String get whaleProfileTradeCount => '交易次数';

  @override
  String get whaleProfileMaxDrawdown => '最大回撤';

  @override
  String get whaleProfileFilledOrders => '已成交订单';

  @override
  String get whaleProfileClosedCount => '平仓次数';

  @override
  String get whaleProfilePeriodDay => '1天';

  @override
  String get whaleProfilePeriodWeek => '1周';

  @override
  String get whaleProfilePeriodMonth => '1月';

  @override
  String get whaleProfilePeriodAll => '全部';

  @override
  String get whaleProfileScopePerpOnly => '仅永续合约';

  @override
  String get whaleProfileScopePerpSpot => '永续合约和现货';

  @override
  String get whaleProfileMetricTotalPnl => '总盈亏';

  @override
  String get whaleProfileMetricAccountValue => '账户价值';

  @override
  String get whaleProfilePillPeriodTitle => '时间范围';

  @override
  String get whaleProfilePillScopeTitle => '统计范围';

  @override
  String get whaleProfilePillMetricTitle => '指标';

  @override
  String get whaleProfilePillCancel => '取消';

  @override
  String get whaleProfileEmptySpot => '暂无现货持仓';

  @override
  String get whaleProfileEmptyPerp => '暂无永续合约持仓';

  @override
  String get whaleProfileEmptyOrders => '暂无挂单';

  @override
  String get whaleProfileEmptyTrades => '暂无最近成交';

  @override
  String get whaleProfileEmptyHistory => '暂无历史委托';

  @override
  String get whaleProfileFilterCoin => '币种筛选';

  @override
  String get whaleProfileFilterLabel => '筛选';

  @override
  String get whaleProfileFilterAll => '全部';

  @override
  String get whaleProfileFilterTitle => '币种筛选';

  @override
  String get whaleProfileMoreSort => '更多排序';

  @override
  String get whaleProfileSortMetric => '指标';

  @override
  String get whaleProfileSortDirection => '排序方式';

  @override
  String get whaleProfileSortAsc => '升序';

  @override
  String get whaleProfileSortDesc => '降序';

  @override
  String get whaleProfileSortNone => '不排序';

  @override
  String get whaleProfileSortDone => '完成';

  @override
  String get whaleProfileSortValue => '价值';

  @override
  String get whaleProfileSortAmount => '金额';

  @override
  String whaleProfilePnlChartTitle(String period, String scope) {
    return '$period 总盈亏（$scope）';
  }

  @override
  String get whaleTradeStatsTitle => '交易统计';

  @override
  String get whaleTradeStatsClosedPnl => '已平仓盈亏';

  @override
  String get whaleTradeStatsFeeAdjusted => '扣除费用后';

  @override
  String get whaleTradeStatsTradeCount => '交易次数';

  @override
  String get whaleTradeStatsWins => '盈利';

  @override
  String get whaleTradeStatsLosses => '亏损';

  @override
  String get whaleTradeStatsPerfTitle => '盈亏表现';

  @override
  String get whaleTradeStatsByAsset => '按资产的表现';

  @override
  String get whaleTradeStatsByPosition => '按仓位的表现';

  @override
  String get whaleTradeStatsNetPnl => '净盈亏';

  @override
  String get whaleTradeStatsSize => '规模';

  @override
  String get whaleTradeStatsFee => '费用';

  @override
  String get whaleTradeStatsEmpty => '暂无成交记录';

  @override
  String whaleTradeStatsTradeUnit(int count) {
    return '$count 笔交易';
  }

  @override
  String get whaleTradeStatsPeriodDay => '1天';

  @override
  String get whaleTradeStatsPeriodWeek => '1周';

  @override
  String get whaleTradeStatsPeriodMonth => '1月';

  @override
  String get whaleTradeStatsPeriodAll => '全部';

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
  String get whaleWatchSubTabLive => '实时巨鲸';

  @override
  String get whaleWatchSubTabAddresses => '监控地址';

  @override
  String get whaleWatchSubTabNotifications => '通知中心';

  @override
  String get whaleWatchCreateMonitor => '创建监控';

  @override
  String get whaleWatchAddressesEmpty => '暂无监控地址';

  @override
  String whaleWatchMarkAllReadCount(int count) {
    return '全部已读 ($count)';
  }

  @override
  String get whaleWatchPerpValue => '永续合约总价值';

  @override
  String get whaleWatchUnrealizedPnl => '未实现盈亏';

  @override
  String get whaleWatchAvailMargin => '可用保证金';

  @override
  String get whaleWatchMarginUsage => '保证金使用率';

  @override
  String get whaleWatchPositions => '持仓';

  @override
  String get whaleRuleAliasLabel => '地址备注';

  @override
  String get whaleRuleAliasHint => '可选';

  @override
  String get whaleRuleChannelTelegramUnbound =>
      '请先完成 Telegram 登录/绑定后再开启 Telegram 推送';

  @override
  String get whaleLiveCoinPush => '关注币种推送';

  @override
  String get whaleLiveCoinPushDone => '已开启关注币种推送';

  @override
  String get whaleLiveWinSort => '胜率';

  @override
  String get whaleLiveWinSortDisabledHint => '胜率排序需交易级数据，接入后启用';

  @override
  String get klineLoadError => 'K 线加载失败';

  @override
  String get tabMarket => '数据';

  @override
  String get tabWhale => '巨鲸';

  @override
  String get tabStrategy => '策略';

  @override
  String get tabMe => '我的';

  @override
  String get liveStrategyEntryTitle => '查看实盘策略';

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
  String get liveActionCancel => '取消';

  @override
  String get liveSortSheetTitle => '筛选 & 排序';

  @override
  String get liveSortStatusLabel => '状态';

  @override
  String get liveSortMetricLabel => '排序指标';

  @override
  String get liveSortDirectionLabel => '排序方式';

  @override
  String get liveSortMetricTodayPnl => '今日盈亏';

  @override
  String get liveSortMetricTotalPnl => '累计盈亏';

  @override
  String get liveSortMetricTotalPct => '收益率';

  @override
  String get liveSortMetricWinRate => '胜率';

  @override
  String get liveSortMetricCapital => '投入本金';

  @override
  String get liveSortMetricRunFor => '运行天数';

  @override
  String get liveSortDirAsc => '升序';

  @override
  String get liveSortDirDesc => '降序';

  @override
  String get liveSortDirNone => '不排序';

  @override
  String liveSortApply(int count) {
    return '查看 $count 个策略';
  }

  @override
  String get livePauseSheetTitle => '暂停策略';

  @override
  String livePauseSheetSubtitle(String name) {
    return '「$name」当前有 1 笔持仓，请选择如何处理后再暂停。';
  }

  @override
  String get livePauseModeMarketLabel => '市价平仓后暂停';

  @override
  String get livePauseModeMarketTag => '推荐';

  @override
  String get livePauseModeMarketDesc => '立即按市价单平掉持仓，实现当前盈亏后暂停策略。';

  @override
  String livePauseModeMarketEffect(String pnl) {
    return '预计实现盈亏 $pnl';
  }

  @override
  String get livePauseModeNaturalLabel => '等待止损/止盈触发';

  @override
  String get livePauseModeNaturalDesc => '保持运行直到触发止损或止盈，然后自动暂停。';

  @override
  String livePauseModeNaturalEffect(String stop, String tp) {
    return '距止损 $stop   距止盈 $tp';
  }

  @override
  String get livePauseModeKeepLabel => '保留持仓，仅暂停策略';

  @override
  String get livePauseModeKeepDesc => '策略不再监控，持仓需要你在交易所手动管理，恢复后可继续接管。';

  @override
  String get livePauseModeKeepEffect => '⚠ 暂停期间 止损 / 止盈 / 加减仓 等自动指令将不生效';

  @override
  String get livePauseResumeNote => '暂停后策略保留全部参数和历史，随时可在「已暂停」中一键恢复。';

  @override
  String get livePausePrimaryMarket => '市价平仓并暂停';

  @override
  String get livePausePrimaryNatural => '保持运行 · 等待平仓';

  @override
  String get livePausePrimaryKeep => '暂停策略 · 保留持仓';

  @override
  String get livePausePositionHolding => '1 笔持仓';

  @override
  String get livePausePositionEntry => '入场';

  @override
  String get livePausePositionCurrent => '现价';

  @override
  String get livePausePositionFloatingPnl => '浮动盈亏';

  @override
  String get liveDeleteSheetTitleSoft => '删除策略？';

  @override
  String get liveDeleteSheetTitlePermanent => '永久删除策略？';

  @override
  String liveDeleteBodySoft(String name) {
    return '「$name」会立即停止运行，历史记录保留 30 天，可在「已停止」中查看。';
  }

  @override
  String liveDeleteBodyPermanentRunning(String name) {
    return '「$name」会立即停止运行，历史记录将不予保留，此操作不可撤销。';
  }

  @override
  String liveDeleteBodyStopped(String name) {
    return '「$name」的历史记录会被立即永久删除，此操作不可撤销。';
  }

  @override
  String get liveDeleteToggleExpand => '不保留历史？';

  @override
  String get liveDeleteToggleCollapse => '收起';

  @override
  String get liveDeleteDangerNote => '立即永久删除 · 删除后将不保留 30 天历史。通常仅在合规或隐私要求时选择。';

  @override
  String get liveDeleteDangerCheckbox => '同时立即永久删除策略历史（不可撤销）';

  @override
  String get liveDeletePrimarySoft => '删除策略';

  @override
  String get liveDeletePrimaryPermanent => '永久删除';

  @override
  String get liveNeedPauseTitle => '需要先暂停策略';

  @override
  String liveNeedPauseBody(String name) {
    return '「$name」当前仍在运行，为避免误删持仓和正在进行的交易，请先暂停策略后再删除。';
  }

  @override
  String get liveNeedPausePrimary => '去暂停策略';

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
  String get whaleRuleChannelPush => '网页通知';

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

  @override
  String get aiScriptTitle => '策略脚本';

  @override
  String get aiScriptSubtitle => '生成可执行脚本，推送回测引擎';

  @override
  String get aiScriptStatusPending => '待生成';

  @override
  String get aiScriptStatusReady => '已生成';

  @override
  String get aiScriptGeneratingTitle => '正在生成策略脚本';

  @override
  String get aiScriptGeneratingSteps => '编译参数 · 校验语法 · 注入风控';

  @override
  String get aiScriptReadyBadge => '✓ READY';

  @override
  String get aiScriptCopy => '复制脚本';

  @override
  String get aiScriptCopied => '已复制';

  @override
  String get aiScriptCopiedToast => '已复制脚本';

  @override
  String aiScriptExpand(int count) {
    return '查看全部 $count 行';
  }

  @override
  String get aiScriptCollapse => '收起';

  @override
  String get aiScriptSuccessHint => '脚本已生成、风控已注入，可继续下一步配置回测。';

  @override
  String get aiScriptPrev => '上一步';

  @override
  String get aiScriptNext => '下一步：回测设置';
}
