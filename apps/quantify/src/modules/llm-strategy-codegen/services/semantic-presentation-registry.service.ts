import { Injectable } from '@nestjs/common'

import type {
  SemanticPresentationMetadata,
} from '../types/semantic-presentation'
import { InternalKeyLeakDetectedException } from '../exceptions/internal-key-leak.exception'
import { SemanticPresentationTokenNotFoundException } from '../exceptions/semantic-presentation-token-not-found.exception'
import { SemanticAtomRegistryService } from './semantic-atom-registry.service'

const EXTRA_INTERNAL_IDENTIFIERS = ['generic_boundary']

const PRESENTATIONS: SemanticPresentationMetadata[] = [
  presentation({
    key: 'execution.on_start',
    publicName: '启动后执行',
    aliases: ['策略启动', '开始运行'],
    positiveExamples: ['策略启动后立即检查一次条件'],
    negativeExamples: ['只在固定时间段交易'],
    goldenUtterances: ['启动策略后先判断是否满足入场条件'],
  }),
  presentation({
    key: 'condition.expression',
    publicName: '表达式条件',
    aliases: ['自定义条件', '条件表达式'],
    positiveExamples: ['价格同时位于 EMA20、EMA60、EMA144 上方'],
    negativeExamples: ['只说开多但没有条件'],
    goldenUtterances: ['价格在 EMA20 和 EMA60 上方时允许开多'],
    displayRenderer: ({ params }) => stringParam(params, 'label', '自定义条件'),
  }),
  presentation({
    key: 'semantic.missing_entry_atom',
    publicName: '缺少入场条件',
    aliases: ['待确认入场', '入场语义缺口'],
    positiveExamples: ['还需要说明什么时候开仓'],
    negativeExamples: ['已经明确 MA20 上穿 MA60 开多'],
    goldenUtterances: ['入场条件还没说清楚，需要继续确认'],
  }),
  presentation({
    key: 'semantic.missing_exit_atom',
    publicName: '缺少出场条件',
    aliases: ['待确认出场', '出场语义缺口'],
    positiveExamples: ['还需要说明什么时候平仓'],
    negativeExamples: ['已经明确跌破 EMA20 平仓'],
    goldenUtterances: ['出场条件还没说清楚，需要继续确认'],
  }),
  presentation({
    key: 'price.percent_change',
    publicName: '价格百分比变化',
    aliases: ['涨跌幅条件', '价格变化比例'],
    positiveExamples: ['价格上涨 3% 后开多'],
    negativeExamples: ['价格接近均线'],
    goldenUtterances: ['15 分钟内价格下跌 2% 时触发风控'],
  }),
  presentation({
    key: 'price.breakout_up',
    publicName: '向上突破',
    aliases: ['突破上方', '上破关键位'],
    positiveExamples: ['突破前高后开多'],
    negativeExamples: ['回踩前低但未突破'],
    goldenUtterances: ['收盘价突破前高时开多'],
  }),
  presentation({
    key: 'price.breakout_down',
    publicName: '向下跌破',
    aliases: ['跌破下方', '下破关键位'],
    positiveExamples: ['跌破前低后开空'],
    negativeExamples: ['价格仍在区间中间'],
    goldenUtterances: ['收盘价跌破前低时开空'],
  }),
  presentation({
    key: 'price.rolling_extrema_breakout',
    publicName: '滚动高低点突破',
    aliases: ['近期高低点突破', '滚动极值突破'],
    positiveExamples: ['突破最近 20 根 K 线高点'],
    negativeExamples: ['只是靠近近期高点'],
    goldenUtterances: ['突破最近 20 根 K 线最高价时入场'],
  }),
  presentation({
    key: 'price.range_position_lte',
    publicName: '区间低位',
    aliases: ['接近区间底部', '区间下沿'],
    positiveExamples: ['价格位于近 100 根区间下 20%'],
    negativeExamples: ['价格处在区间顶部'],
    goldenUtterances: ['价格落在近期区间下 20% 时寻找做多'],
  }),
  presentation({
    key: 'price.range_position_gte',
    publicName: '区间高位',
    aliases: ['接近区间顶部', '区间上沿'],
    positiveExamples: ['价格位于近 100 根区间上 20%'],
    negativeExamples: ['价格处在区间底部'],
    goldenUtterances: ['价格落在近期区间上 20% 时寻找做空'],
  }),
  presentation({
    key: 'price.detect.indicator_boundary',
    publicName: '价格触及指标边界',
    aliases: ['价格碰线', '触及指标边界'],
    positiveExamples: ['触及 BOLL 下轨（20, 2）'],
    negativeExamples: ['只描述价格上涨，没有指标边界'],
    goldenUtterances: ['价格触及布林带下轨时准备开多'],
    displayRenderer: ({ params }) => renderIndicatorBoundaryTouch(params),
  }),
  presentation({
    key: 'condition.sequence',
    publicName: '顺序条件',
    aliases: ['先后触发', '条件顺序'],
    positiveExamples: ['先突破再回踩确认'],
    negativeExamples: ['两个条件没有先后关系'],
    goldenUtterances: ['先站上 EMA60，再回踩不破时开多'],
  }),
  presentation({
    key: 'confirmation.rebound',
    publicName: '反弹确认',
    aliases: ['反弹验证', '止跌确认'],
    positiveExamples: ['触及下轨后收阳确认'],
    negativeExamples: ['继续单边下跌'],
    goldenUtterances: ['回踩后出现反弹确认再入场'],
  }),
  presentation({
    key: 'logical.any_of',
    publicName: '任一条件满足',
    aliases: ['或者条件', '多选一触发'],
    positiveExamples: ['EMA20 上方或 RSI 低位反弹任一满足'],
    negativeExamples: ['所有条件必须同时满足'],
    goldenUtterances: ['只要突破前高或站上 EMA60 就开多'],
  }),
  presentation({
    key: 'volume.relative_average',
    publicName: '相对均量',
    aliases: ['放量倍数', '成交量相对均值'],
    positiveExamples: ['成交量超过 20 根均量的 2 倍'],
    negativeExamples: ['只比较价格位置'],
    goldenUtterances: ['成交量大于近期均量 1.5 倍时确认突破'],
  }),
  presentation({
    key: 'indicator.cross_over',
    publicName: '指标上穿',
    aliases: ['金叉', '向上交叉'],
    positiveExamples: ['MA20 上穿 MA60'],
    negativeExamples: ['MA20 一直在 MA60 上方'],
    goldenUtterances: ['EMA20 上穿 EMA60 时开多'],
  }),
  presentation({
    key: 'indicator.cross_under',
    publicName: '指标下穿',
    aliases: ['死叉', '向下交叉'],
    positiveExamples: ['MA20 下穿 MA60'],
    negativeExamples: ['MA20 一直在 MA60 下方'],
    goldenUtterances: ['EMA20 下穿 EMA60 时开空'],
  }),
  presentation({
    key: 'indicator.threshold_gte',
    publicName: '指标高于阈值',
    aliases: ['指标不低于', '达到阈值'],
    positiveExamples: ['RSI 大于 70'],
    negativeExamples: ['RSI 位于中性区间'],
    goldenUtterances: ['RSI 高于 70 时禁止追多'],
  }),
  presentation({
    key: 'indicator.threshold_lte',
    publicName: '指标低于阈值',
    aliases: ['指标不高于', '跌到阈值'],
    positiveExamples: ['RSI 小于 30'],
    negativeExamples: ['RSI 位于中性区间'],
    goldenUtterances: ['RSI 低于 30 后等待反弹'],
  }),
  presentation({
    key: 'indicator.boundary_touch',
    publicName: '指标边界触及',
    aliases: ['触及指标边界', '指标碰线'],
    positiveExamples: ['触及 BOLL 下轨'],
    negativeExamples: ['只是均线方向向上'],
    goldenUtterances: ['K 线触及布林带下轨时开多'],
    displayRenderer: ({ params }) => renderIndicatorBoundaryTouch(params),
  }),
  presentation({
    key: 'indicator.boundary_cross',
    publicName: '指标边界穿越',
    aliases: ['穿过指标边界', '越过边界'],
    positiveExamples: ['价格向上穿过布林带中轨'],
    negativeExamples: ['只触碰边界但未穿越'],
    goldenUtterances: ['收盘价上穿布林带中轨时确认趋势'],
  }),
  presentation({
    key: 'bollinger.touch_upper',
    publicName: '触及布林上轨',
    aliases: ['碰到上轨', '布林上轨触发'],
    positiveExamples: ['触及 BOLL 上轨'],
    negativeExamples: ['触及布林下轨'],
    goldenUtterances: ['价格触及布林带上轨时止盈'],
  }),
  presentation({
    key: 'bollinger.touch_lower',
    publicName: '触及布林下轨',
    aliases: ['碰到下轨', '布林下轨触发'],
    positiveExamples: ['触及 BOLL 下轨'],
    negativeExamples: ['触及布林上轨'],
    goldenUtterances: ['价格触及布林带下轨时开多'],
  }),
  presentation({
    key: 'bollinger.touch_middle',
    publicName: '触及布林中轨',
    aliases: ['碰到中轨', '布林中轨触发'],
    positiveExamples: ['触及 BOLL 中轨'],
    negativeExamples: ['突破布林上轨'],
    goldenUtterances: ['回踩布林带中轨不破时加仓'],
  }),
  presentation({
    key: 'oscillator.rsi_gte',
    publicName: 'RSI 高于阈值',
    aliases: ['RSI 超买', 'RSI 不低于'],
    positiveExamples: ['RSI 大于 70'],
    negativeExamples: ['RSI 小于 30'],
    goldenUtterances: ['RSI 高于 70 时分批止盈'],
  }),
  presentation({
    key: 'oscillator.rsi_lte',
    publicName: 'RSI 低于阈值',
    aliases: ['RSI 超卖', 'RSI 不高于'],
    positiveExamples: ['RSI 小于 30'],
    negativeExamples: ['RSI 大于 70'],
    goldenUtterances: ['RSI 低于 30 且反弹时开多'],
  }),
  presentation({
    key: 'trend.direction',
    publicName: '趋势方向',
    aliases: ['趋势判断', '行情方向'],
    positiveExamples: ['只在上升趋势做多'],
    negativeExamples: ['无视趋势方向'],
    goldenUtterances: ['趋势向上时只开多不做空'],
  }),
  presentation({
    key: 'market.regime',
    publicName: '市场状态',
    aliases: ['行情结构', '市场环境'],
    positiveExamples: ['震荡行情使用网格'],
    negativeExamples: ['只描述单个价格条件'],
    goldenUtterances: ['震荡行情中启用区间交易'],
  }),
  presentation({
    key: 'volatility.state',
    publicName: '波动率状态',
    aliases: ['波动环境', '波动强弱'],
    positiveExamples: ['高波动时降低仓位'],
    negativeExamples: ['成交量放大但波动不变'],
    goldenUtterances: ['波动率过高时暂停加仓'],
  }),
  presentation({
    key: 'market.volatility_state',
    publicName: '市场波动状态',
    aliases: ['市场波动环境', '行情波动强弱'],
    positiveExamples: ['市场低波动时启用网格'],
    negativeExamples: ['只看单根 K 线涨跌'],
    goldenUtterances: ['市场进入高波动状态时收紧止损'],
  }),
  presentation({
    key: 'grid.price_levels',
    publicName: '网格价位',
    aliases: ['网格档位', '价格网格'],
    positiveExamples: ['在 60000 到 66000 之间分 6 档挂单'],
    negativeExamples: ['市价直接开仓'],
    goldenUtterances: ['按固定价位生成上下网格订单'],
  }),
  presentation({
    key: 'grid.fixed_range',
    publicName: '固定区间网格',
    aliases: ['固定范围网格', '区间网格'],
    positiveExamples: ['在 60000 到 66000 固定区间做网格'],
    negativeExamples: ['突破后追单'],
    goldenUtterances: ['BTC 在指定区间内用固定网格交易'],
  }),
  presentation({
    key: 'grid.range_rebalance',
    publicName: '网格区间再平衡',
    aliases: ['调整网格区间', '网格重置'],
    positiveExamples: ['价格离开区间后重新计算网格'],
    negativeExamples: ['区间不变一直挂单'],
    goldenUtterances: ['突破网格边界后重置交易区间'],
  }),
  presentation({
    key: 'open_long',
    publicName: '开多',
    aliases: ['做多', '买入开多'],
    positiveExamples: ['开多'],
    negativeExamples: ['平掉多单'],
    goldenUtterances: ['条件满足时开多'],
    displayRenderer: () => '开多',
  }),
  presentation({
    key: 'open_short',
    publicName: '开空',
    aliases: ['做空', '卖出开空'],
    positiveExamples: ['开空'],
    negativeExamples: ['平掉空单'],
    goldenUtterances: ['条件满足时开空'],
    displayRenderer: () => '开空',
  }),
  presentation({
    key: 'close_long',
    publicName: '平多',
    aliases: ['卖出平多', '关闭多单'],
    positiveExamples: ['跌破 EMA20 后平多'],
    negativeExamples: ['继续加多仓'],
    goldenUtterances: ['多单触发止损时平仓'],
  }),
  presentation({
    key: 'close_short',
    publicName: '平空',
    aliases: ['买入平空', '关闭空单'],
    positiveExamples: ['站上 EMA20 后平空'],
    negativeExamples: ['继续加空仓'],
    goldenUtterances: ['空单触发止损时平仓'],
  }),
  presentation({
    key: 'close_position',
    publicName: '平仓',
    aliases: ['关闭仓位', '全部退出'],
    positiveExamples: ['触发风控后平仓'],
    negativeExamples: ['继续持仓不处理'],
    goldenUtterances: ['达到最大回撤时立即平仓'],
  }),
  presentation({
    key: 'action.reduce_position',
    publicName: '减仓',
    aliases: ['降低仓位', '部分平仓'],
    positiveExamples: ['盈利 5% 后减仓一半'],
    negativeExamples: ['满仓继续加仓'],
    goldenUtterances: ['触及上轨后减仓 30%'],
  }),
  presentation({
    key: 'reduce_long',
    publicName: '减少多仓',
    aliases: ['多单减仓', '部分平多'],
    positiveExamples: ['多单盈利后减半'],
    negativeExamples: ['开新的多单'],
    goldenUtterances: ['多单触及目标价后减仓'],
  }),
  presentation({
    key: 'reduce_short',
    publicName: '减少空仓',
    aliases: ['空单减仓', '部分平空'],
    positiveExamples: ['空单盈利后减半'],
    negativeExamples: ['开新的空单'],
    goldenUtterances: ['空单触及目标价后减仓'],
  }),
  presentation({
    key: 'action.add_position',
    publicName: '加仓',
    aliases: ['追加仓位', '顺势加码'],
    positiveExamples: ['突破后再加一笔仓位'],
    negativeExamples: ['只开第一笔仓位'],
    goldenUtterances: ['盈利后按规则加仓一次'],
  }),
  presentation({
    key: 'action.reverse_position',
    publicName: '反手',
    aliases: ['反向开仓', '平仓后反向'],
    positiveExamples: ['多单止损后反手开空'],
    negativeExamples: ['只平仓不反向'],
    goldenUtterances: ['跌破关键位后平多并反手做空'],
  }),
  presentation({
    key: 'action.grid_ladder',
    publicName: '网格阶梯下单',
    aliases: ['阶梯挂单', '分层网格'],
    positiveExamples: ['按网格档位逐层挂单'],
    negativeExamples: ['一次性市价买入'],
    goldenUtterances: ['在每个网格价位放置阶梯订单'],
  }),
  presentation({
    key: 'place_limit_grid',
    publicName: '挂限价网格',
    aliases: ['限价网格挂单', '网格限价单'],
    positiveExamples: ['在区间内挂限价买卖单'],
    negativeExamples: ['直接市价成交'],
    goldenUtterances: ['按网格价格挂出限价订单'],
  }),
  presentation({
    key: 'risk.condition_expression',
    publicName: '风控表达式',
    aliases: ['风控条件', '风险条件表达式'],
    positiveExamples: ['价格跌破 EMA60 后触发风控'],
    negativeExamples: ['普通入场条件'],
    goldenUtterances: ['出现反向条件时触发保护退出'],
  }),
  presentation({
    key: 'risk.boundary_guard',
    publicName: '边界风控',
    aliases: ['边界保护', '价格边界守护'],
    positiveExamples: ['跌破区间下沿后停止开多'],
    negativeExamples: ['突破后继续加仓'],
    goldenUtterances: ['价格跌出安全区间时停止交易'],
  }),
  presentation({
    key: 'risk.protective_exit',
    publicName: '保护性退出',
    aliases: ['保护平仓', '保护出场'],
    positiveExamples: ['出现反向信号后保护性平仓'],
    negativeExamples: ['无条件继续持仓'],
    goldenUtterances: ['趋势失效后保护性退出仓位'],
  }),
  presentation({
    key: 'risk.stop_loss',
    publicName: '止损',
    aliases: ['亏损保护', '风险止损'],
    positiveExamples: ['触及止损价后平仓'],
    negativeExamples: ['盈利止盈'],
    goldenUtterances: ['价格跌到止损位时退出'],
  }),
  presentation({
    key: 'risk.take_profit',
    publicName: '止盈',
    aliases: ['获利了结', '盈利退出'],
    positiveExamples: ['达到目标价后止盈'],
    negativeExamples: ['亏损止损'],
    goldenUtterances: ['盈利达到目标后平仓'],
  }),
  presentation({
    key: 'risk.stop_loss_pct',
    publicName: '百分比止损',
    aliases: ['止损比例', '亏损止损'],
    positiveExamples: ['亏损 5% 止损'],
    negativeExamples: ['盈利 10% 止盈'],
    goldenUtterances: ['入场后亏损 5% 强制平仓'],
    displayRenderer: ({ params }) => `亏损 ${numberParam(params, 'valuePct', 0)}% 止损`,
  }),
  presentation({
    key: 'risk.take_profit_pct',
    publicName: '百分比止盈',
    aliases: ['止盈比例', '盈利止盈'],
    positiveExamples: ['盈利 10% 止盈'],
    negativeExamples: ['亏损 5% 止损'],
    goldenUtterances: ['入场后盈利 10% 分批止盈'],
  }),
  presentation({
    key: 'risk.atr_multiple_stop',
    publicName: 'ATR 倍数止损',
    aliases: ['ATR 止损', '波动止损'],
    positiveExamples: ['跌破 2 倍 ATR 止损'],
    negativeExamples: ['固定百分比止损'],
    goldenUtterances: ['用 2 倍 ATR 作为动态止损'],
  }),
  presentation({
    key: 'risk.atr_multiple_take_profit',
    publicName: 'ATR 倍数止盈',
    aliases: ['ATR 止盈', '波动止盈'],
    positiveExamples: ['达到 3 倍 ATR 止盈'],
    negativeExamples: ['固定价格止盈'],
    goldenUtterances: ['盈利达到 3 倍 ATR 后退出'],
  }),
  presentation({
    key: 'risk.remembered_level_stop',
    publicName: '记忆价位止损',
    aliases: ['关键位止损', '参考位止损'],
    positiveExamples: ['跌破入场前低止损'],
    negativeExamples: ['没有参考价位'],
    goldenUtterances: ['跌破记住的前低后止损'],
  }),
  presentation({
    key: 'risk.falling_knife_guard',
    publicName: '不接急跌保护',
    aliases: ['急跌过滤', '下跌保护'],
    positiveExamples: ['连续急跌时不开多'],
    negativeExamples: ['温和回调后反弹'],
    goldenUtterances: ['急跌没有止跌确认前禁止开多'],
  }),
  presentation({
    key: 'risk.trailing_stop_pct',
    publicName: '百分比移动止损',
    aliases: ['跟踪止损', '移动保护'],
    positiveExamples: ['盈利后回撤 3% 平仓'],
    negativeExamples: ['固定入场价止损'],
    goldenUtterances: ['盈利后用 3% 回撤做移动止损'],
  }),
  presentation({
    key: 'risk.max_drawdown_pct',
    publicName: '最大回撤限制',
    aliases: ['回撤风控', '权益回撤上限'],
    positiveExamples: ['回撤超过 20% 停止交易'],
    negativeExamples: ['单笔止盈'],
    goldenUtterances: ['账户回撤超过 15% 后暂停策略'],
  }),
  presentation({
    key: 'risk.max_single_loss_pct',
    publicName: '单笔最大亏损',
    aliases: ['单笔亏损上限', '单次风险限制'],
    positiveExamples: ['单笔最多亏 2%'],
    negativeExamples: ['总账户回撤限制'],
    goldenUtterances: ['单笔亏损超过 2% 立即退出'],
  }),
  presentation({
    key: 'risk.cooldown_bars',
    publicName: '冷却 K 线数',
    aliases: ['交易冷却', '暂停若干根 K 线'],
    positiveExamples: ['止损后等待 5 根 K 线'],
    negativeExamples: ['止损后立即重新开仓'],
    goldenUtterances: ['平仓后冷却 3 根 K 线再允许入场'],
  }),
  presentation({
    key: 'position.fixed_pct',
    publicName: '固定比例仓位',
    aliases: ['固定百分比仓位', '按比例下单'],
    positiveExamples: ['单笔 10% 仓位'],
    negativeExamples: ['按固定币数下单'],
    goldenUtterances: ['每次使用账户 10% 仓位'],
    displayRenderer: ({ params }) => `单笔 ${formatPercentLikeValue(numberParam(params, 'value', 0))}% 仓位`,
  }),
  presentation({
    key: 'position.fixed_notional',
    publicName: '固定名义金额',
    aliases: ['固定金额仓位', '按金额下单'],
    positiveExamples: ['单笔 100 USDT'],
    negativeExamples: ['按账户比例下单'],
    goldenUtterances: ['每次固定投入 100 USDT'],
    displayRenderer: ({ params }) => `单笔 ${numberParam(params, 'value', 0)} ${stringParam(params, 'asset', 'USDT')}`,
  }),
  presentation({
    key: 'position.fixed_quantity',
    publicName: '固定数量仓位',
    aliases: ['固定数量下单', '按数量下单'],
    positiveExamples: ['单笔 0.01 BTC'],
    negativeExamples: ['按账户余额百分比下单'],
    goldenUtterances: ['每次固定买入 0.01 BTC'],
    displayRenderer: ({ params }) => `单笔 ${numberParam(params, 'value', 0)} ${stringParam(params, 'asset', '币')}`,
  }),
  presentation({
    key: 'position.pyramiding_limit',
    publicName: '金字塔加仓限制',
    aliases: ['最大加仓层数', '分层加仓上限'],
    positiveExamples: ['最多加仓 3 层'],
    negativeExamples: ['无限制连续加仓'],
    goldenUtterances: ['同方向最多保留 3 层仓位'],
  }),
  presentation({
    key: 'position.max_exposure_pct',
    publicName: '最大敞口比例',
    aliases: ['仓位敞口上限', '最大仓位比例'],
    positiveExamples: ['总仓位不超过 30%'],
    negativeExamples: ['单笔固定金额'],
    goldenUtterances: ['策略总敞口不超过账户 30%'],
  }),
  presentation({
    key: 'position.dca_schedule',
    publicName: 'DCA 补仓计划',
    aliases: ['定投补仓', '分批补仓计划'],
    positiveExamples: ['每跌 2% 补仓一次，最多 3 次'],
    negativeExamples: ['只开一次固定仓位'],
    goldenUtterances: ['价格每回撤 2% 补仓一次并限制总次数'],
  }),
]

const SLOT_LABELS: Record<string, string> = {
  'action.add_position.constraint': '加仓约束',
  'action.reverse_position.same_bar_policy': '同一根 K 线反手规则',
  'action.reverse_position.sizing_source': '反手仓位来源',
  'position.dca_schedule.max_count': '最多补仓次数',
  'position.dca_schedule.capital_cap': '补仓资金上限',
  'position.dca_schedule.per_order_sizing': '每次补仓大小',
  'position.dca_schedule.trigger_mode': '补仓触发方式',
  'position.dca_schedule.exit_rule': '补仓退出规则',
  'risk.falling_knife_guard.definition': '急跌保护判定方式',
  'risk.stop_loss_pct.valuePct': '止损比例',
}

@Injectable()
export class SemanticPresentationRegistryService {
  private readonly presentations = new Map(PRESENTATIONS.map(metadata => [metadata.key, metadata]))
  private internalIdentifierLeakPattern?: RegExp

  constructor(private readonly atomRegistry: SemanticAtomRegistryService) {}

  get(key: string): SemanticPresentationMetadata {
    const metadata = this.presentations.get(key)
    if (!metadata) {
      throw new SemanticPresentationTokenNotFoundException({ token: key })
    }
    this.guardMetadata(metadata)
    return metadata
  }

  renderDisplay(key: string, params: Record<string, unknown>): string {
    const output = this.get(key).displayRenderer({ params })
    return this.guardPublicText(key, output)
  }

  renderClarification(key: string, slotKey: string, params: Record<string, unknown>): string {
    const output = this.get(key).clarificationRenderer(slotKey, params)
    return this.guardPublicText(key, output)
  }

  private guardMetadata(metadata: SemanticPresentationMetadata): void {
    const fields = [
      metadata.publicName,
      ...metadata.aliases,
      ...metadata.positiveExamples,
      ...metadata.negativeExamples,
      ...metadata.goldenUtterances,
    ]
    for (const field of fields) {
      this.guardPublicText(metadata.key, field)
    }
  }

  private guardPublicText(key: string, output: string): string {
    if (this.getInternalIdentifierLeakPattern().test(output)) {
      throw new InternalKeyLeakDetectedException({
        key,
        details: `semantic_presentation_internal_key_leak:${key}`,
      })
    }
    return output
  }

  private getInternalIdentifierLeakPattern(): RegExp {
    this.internalIdentifierLeakPattern ??= buildInternalIdentifierPattern(this.atomRegistry)
    return this.internalIdentifierLeakPattern
  }
}

function presentation(
  metadata: Omit<SemanticPresentationMetadata, 'clarificationRenderer' | 'displayRenderer'> & {
    clarificationRenderer?: SemanticPresentationMetadata['clarificationRenderer']
    displayRenderer?: SemanticPresentationMetadata['displayRenderer']
  },
): SemanticPresentationMetadata {
  return {
    ...metadata,
    displayRenderer: metadata.displayRenderer ?? (() => metadata.publicName),
    clarificationRenderer: metadata.clarificationRenderer
      ?? ((slotKey, params) => defaultClarificationRenderer(metadata.publicName, slotKey, params)),
  }
}

function defaultClarificationRenderer(
  publicName: string,
  slotKey: string,
  _params: Record<string, unknown>,
): string {
  return `请补充${publicName}的${SLOT_LABELS[slotKey] ?? '缺失信息'}。`
}

function renderIndicatorBoundaryTouch(params: Record<string, unknown>): string {
  const indicator = objectParam(params, 'indicator')
  const indicatorName = stringParam(indicator, 'name', '指标')
  const boundaryRole = stringParam(params, 'boundaryRole', 'boundary')

  if (indicatorName === 'bollinger') {
    const period = numberParam(indicator, 'period', 20)
    const stdDev = numberParam(indicator, 'stdDev', 2)
    return `触及 BOLL ${renderBoundaryRole(boundaryRole)}（${period}, ${stdDev}）`
  }

  return `触及 ${indicatorName.toUpperCase()} ${renderBoundaryRole(boundaryRole)}`
}

function renderBoundaryRole(boundaryRole: string): string {
  const roleNames: Record<string, string> = {
    lower: '下轨',
    middle: '中轨',
    upper: '上轨',
  }
  return roleNames[boundaryRole] ?? '边界'
}

function objectParam(params: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = params[key]
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringParam(params: Record<string, unknown>, key: string, fallback: string): string {
  const value = params[key]
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function numberParam(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function formatPercentLikeValue(value: number): number {
  return value > 1 ? value : value * 100
}

function buildInternalIdentifierPattern(atomRegistry: SemanticAtomRegistryService): RegExp {
  const registeredAtomKeys = atomRegistry.list().map(atom => atom.key)
  const identifiers = [...new Set([...registeredAtomKeys, ...EXTRA_INTERNAL_IDENTIFIERS])]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)

  return new RegExp(`(^|[^A-Za-z0-9_.])(?:${identifiers.join('|')})(?=$|[^A-Za-z0-9_])`, 'u')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}
