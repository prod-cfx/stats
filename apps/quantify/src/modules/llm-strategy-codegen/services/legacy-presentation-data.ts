/**
 * Issue #1279 PR3c.7b — legacy presentation data + pure helpers（transition shim）。
 *
 * 历史背景：原 `semantic-presentation-registry.service.ts`（94 个 `presentation({...})` 条目）
 *   是 atom 渲染层并行真相源。PR3c.5 完成后，36 个已迁入 `ATOM_CONTRACT_REGISTRY[*].display`
 *   的 atom 数据在 REGISTRY 中已有单一真相；本文件保留全部 94 个 PRESENTATIONS entry 作为
 *   transition data，通过 4 个顶层 pure helper 对外暴露（REGISTRY-first，fallback PRESENTATIONS）。
 *   @Injectable class 壳已于 PR3c.7d 删除。
 *
 * 60 个尚未迁入 REGISTRY 的 transition entry（follow-up #1329 负责迁入）：
 *   - orchestration 域：gate.regime / gate.subStrategy /
 *     portfolioRisk.{symbol,substrategy}_exposure_cap /
 *     program.{fixed_grid_gated,dynamic_grid,adaptive_volatility_grid,event_listener} /
 *     scope.{leg,symbol,timeframe,dataSource,subStrategy}
 *   - 30+ slot label / clarification 描述 / risk.* / position.* / indicator.* stub
 *
 * follow-up #1329：迁入完成后删除 PRESENTATIONS 数组及本文件。
 */
import type {
  SemanticPresentationMetadata,
} from '../types/semantic-presentation'
import { ATOM_CONTRACT_REGISTRY } from '../atom-contracts/atom-contract-registry'
import type { AtomContractKey } from '../atom-contracts/atom-contract-types'
import { SemanticPresentationTokenNotFoundException } from '../exceptions/semantic-presentation-token-not-found.exception'
import {
  getDisplayToken,
  renderDisplayToken,
  renderEnumDisplayToken,
} from '../nl-gateway/display-registry'
import { guardPublicText } from '../nl-gateway/internal-key-leak-guard/internal-key-leak-guard.pure'
import { getGoldenUtterancesForAtom } from '../nl-gateway/utterance-corpus'
import { SemanticAtomRegistryService } from './semantic-atom-registry.service'

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
    displayRenderer: ({ params }) => renderDisplayToken('atom.condition.expression.display', {
      label: stringParam(params, 'label', '自定义条件'),
    }),
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
    displayRenderer: ({ params }) => renderRollingExtremaBreakoutCondition(params),
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
    displayRenderer: ({ params }) => renderSequenceCondition(params),
  }),
  presentation({
    key: 'confirmation.rebound',
    publicName: '反弹确认',
    aliases: ['反弹验证', '止跌确认'],
    positiveExamples: ['触及下轨后收阳确认'],
    negativeExamples: ['继续单边下跌'],
    goldenUtterances: ['回踩后出现反弹确认再入场'],
    displayRenderer: ({ params }) => renderReboundConfirmationCondition(params),
  }),
  presentation({
    key: 'logical.any_of',
    publicName: '任一条件满足',
    aliases: ['或者条件', '多选一触发'],
    positiveExamples: ['EMA20 上方或 RSI 低位反弹任一满足'],
    negativeExamples: ['所有条件必须同时满足'],
    goldenUtterances: ['只要突破前高或站上 EMA60 就开多'],
    displayRenderer: ({ params }) => renderLogicalAnyOfCondition(params),
  }),
  presentation({
    key: 'volume.relative_average',
    publicName: '相对均量',
    aliases: ['放量倍数', '成交量相对均值'],
    positiveExamples: ['成交量超过 20 根均量的 2 倍'],
    negativeExamples: ['只比较价格位置'],
    goldenUtterances: ['成交量大于近期均量 1.5 倍时确认突破'],
    displayRenderer: ({ params }) => renderRelativeVolumeCondition(params),
  }),
  presentation({
    key: 'volume.threshold',
    publicName: '成交量阈值',
    aliases: ['成交量过滤', '成交量条件', '量能阈值'],
    positiveExamples: ['成交量大于 1000 时允许入场', '成交额超过 500 万时开多'],
    negativeExamples: ['只用均量倍数过滤'],
    goldenUtterances: getGoldenUtterancesForAtom('volume.threshold'),
    displayRenderer: ({ params }) => {
      const metric = stringParam(params, 'metric', 'base_volume')
      const op = stringParam(params, 'operator', 'GT')
      const value = numberParam(params, 'value', 0)
      return renderDisplayToken('atom.volume.threshold.display', {
        metric: renderEnumDisplayToken('enum.volume.metric', metric),
        operator: renderEnumDisplayToken('enum.operator', op),
        value,
      })
    },
    clarificationRenderer: (slotKey, _params) => {
      if (slotKey === 'volume.threshold.value') return '请给出成交量阈值，例如 1000（成交量单位：张/枚）或 500000（成交额单位：USDT）。'
      if (slotKey === 'volume.threshold.operator') return '请指明比较方向：GT（大于）/ GTE（不低于）/ LT（小于）/ LTE（不高于）。'
      if (slotKey === 'volume.threshold.metric') return '请指明量的类型：base_volume（成交量）或 quote_volume（成交额）。'
      return '请补充成交量阈值条件的缺失信息。'
    },
  }),
  presentation({
    key: 'volatility.atr_threshold',
    publicName: 'ATR 波动率阈值',
    aliases: ['ATR 过滤', 'ATR 条件', 'ATR 大于阈值', '平均真实波幅阈值'],
    positiveExamples: ['ATR14 大于 50 才允许入场', 'ATR 小于 100 时禁止开仓'],
    negativeExamples: ['只用固定止损'],
    goldenUtterances: getGoldenUtterancesForAtom('volatility.atr_threshold'),
    displayRenderer: ({ params }) => {
      const op = stringParam(params, 'operator', 'GT')
      const period = numberParam(params, 'period', 0)
      const threshold = numberParam(params, 'threshold', 0)
      const periodStr = period > 0 ? `ATR${period}` : 'ATR'
      return renderDisplayToken('atom.volatility.atr_threshold.display', {
        indicator: periodStr,
        operator: renderEnumDisplayToken('enum.operator', op),
        threshold,
      })
    },
    clarificationRenderer: (slotKey, _params) => {
      if (slotKey === 'volatility.atr_threshold.period') return '请指定 ATR 计算周期，例如 14（常用默认值）。'
      if (slotKey === 'volatility.atr_threshold.threshold') return '请给出 ATR 阈值数值，例如 50。'
      if (slotKey === 'volatility.atr_threshold.thresholdUnit') return '请指定阈值单位：quote_currency（价格单位，如 USDT）或 pct（百分比）。'
      if (slotKey === 'volatility.atr_threshold.operator') return '请指明比较方向：GT（大于）/ GTE（不低于）/ LT（小于）/ LTE（不高于）。'
      return '请补充 ATR 波动率阈值条件的缺失信息。'
    },
  }),
  presentation({
    key: 'strategy.time_window',
    publicName: '交易时间窗口',
    aliases: ['时间段过滤', '交易时段', '开仓时间', '允许开仓时间'],
    positiveExamples: ['北京时间 9:30-11:30 内允许开仓', 'allow entries between 09:30-11:30 UTC'],
    negativeExamples: ['不限制开仓时间'],
    goldenUtterances: getGoldenUtterancesForAtom('strategy.time_window'),
    displayRenderer: ({ params }) => {
      const timezone = stringParam(params, 'timezone', 'UTC')
      const windowsRaw = typeof params?.windows === 'string' ? params.windows : null
      let windowsStr = ''
      if (windowsRaw) {
        try {
          const arr: Array<{ start: string; end: string }> = JSON.parse(windowsRaw)
          windowsStr = arr.map(w => `${w.start}-${w.end}`).join(', ')
        }
        catch {
          windowsStr = windowsRaw
        }
      }
      return windowsStr
        ? renderDisplayToken('atom.strategy.time_window.display', { windows: windowsStr, timezone })
        : renderDisplayToken('atom.strategy.time_window.display.empty', { timezone })
    },
    clarificationRenderer: (slotKey, _params) => {
      if (slotKey === 'strategy.time_window.timezone') return '请指定时区，例如 Asia/Shanghai（北京时间）或 UTC。'
      if (slotKey === 'strategy.time_window.windows') return '请指定允许开仓的时间段，例如 09:30-11:30（24小时制，可有多段）。'
      return '请补充交易时间窗口条件的缺失信息。'
    },
  }),
  presentation({
    key: 'position.has_position',
    publicName: '已有仓位卫语句',
    aliases: ['已有仓位不再开仓', '持仓中禁止开仓', '仓位存在时阻止入场', '有仓位'],
    positiveExamples: ['已有多头仓位时不再开多', '当持仓中禁止同向重复开仓'],
    negativeExamples: ['无仓位时开仓', '加仓'],
    goldenUtterances: getGoldenUtterancesForAtom('position.has_position'),
    displayRenderer: ({ params }) => {
      const side = typeof params?.sideScope === 'string' ? params.sideScope : 'both'
      return renderDisplayToken('atom.position.has_position.display', {
        side: renderEnumDisplayToken('enum.side', side),
      })
    },
    clarificationRenderer: (slotKey, _params) => {
      if (slotKey === 'position.has_position.sideScope') return '请明确仓位方向：多头（long）、空头（short）或双向（both）。'
      return '请补充仓位检查条件的缺失信息。'
    },
  }),
  presentation({
    key: 'position.no_position',
    publicName: '无仓位卫语句',
    aliases: ['无仓位才开仓', '空仓时才开仓', '没有持仓时允许入场', '未开仓'],
    positiveExamples: ['无多头仓位才开多', '当前无仓时才允许入场'],
    negativeExamples: ['已有仓位时开仓', '加仓'],
    goldenUtterances: getGoldenUtterancesForAtom('position.no_position'),
    displayRenderer: ({ params }) => {
      const side = typeof params?.sideScope === 'string' ? params.sideScope : 'both'
      return renderDisplayToken('atom.position.no_position.display', {
        side: renderEnumDisplayToken('enum.side', side),
      })
    },
    clarificationRenderer: (slotKey, _params) => {
      if (slotKey === 'position.no_position.sideScope') return '请明确仓位方向：多头（long）、空头（short）或双向（both）。'
      return '请补充无仓位检查条件的缺失信息。'
    },
  }),
  presentation({
    key: 'indicator.cross_over',
    publicName: '指标上穿',
    aliases: ['金叉', '向上交叉'],
    positiveExamples: ['MA20 上穿 MA60'],
    negativeExamples: ['MA20 一直在 MA60 上方'],
    goldenUtterances: ['EMA20 上穿 EMA60 时开多'],
    displayRenderer: ({ params }) => renderCrossCondition(params, '上穿'),
  }),
  presentation({
    key: 'indicator.cross_under',
    publicName: '指标下穿',
    aliases: ['死叉', '向下交叉'],
    positiveExamples: ['MA20 下穿 MA60'],
    negativeExamples: ['MA20 一直在 MA60 下方'],
    goldenUtterances: ['EMA20 下穿 EMA60 时开空'],
    displayRenderer: ({ params }) => renderCrossCondition(params, '下穿'),
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
    displayRenderer: ({ params }) => renderBollingerTouchCondition(params, '上轨'),
  }),
  presentation({
    key: 'bollinger.touch_lower',
    publicName: '触及布林下轨',
    aliases: ['碰到下轨', '布林下轨触发'],
    positiveExamples: ['触及 BOLL 下轨'],
    negativeExamples: ['触及布林上轨'],
    goldenUtterances: ['价格触及布林带下轨时开多'],
    displayRenderer: ({ params }) => renderBollingerTouchCondition(params, '下轨'),
  }),
  presentation({
    key: 'bollinger.touch_middle',
    publicName: '触及布林中轨',
    aliases: ['碰到中轨', '布林中轨触发'],
    positiveExamples: ['触及 BOLL 中轨'],
    negativeExamples: ['突破布林上轨'],
    goldenUtterances: ['回踩布林带中轨不破时加仓'],
    displayRenderer: ({ params }) => renderBollingerTouchCondition(params, '中轨'),
  }),
  presentation({
    key: 'oscillator.rsi_gte',
    publicName: 'RSI 高于阈值',
    aliases: ['RSI 超买', 'RSI 不低于'],
    positiveExamples: ['RSI 大于 70'],
    negativeExamples: ['RSI 小于 30'],
    goldenUtterances: ['RSI 高于 70 时分批止盈'],
    displayRenderer: ({ params }) => {
      const period = typeof params?.period === 'number' ? params.period : 14
      const value = typeof params?.value === 'number' ? params.value : null
      return value !== null ? `RSI${period} 高于或等于 ${value}` : `RSI${period} 高于或等于阈值`
    },
    clarificationRenderer: (_slotKey, _params) =>
      '请补充 RSI 阈值（0-100，常用：超卖 30 / 超买 70）。',
  }),
  presentation({
    key: 'oscillator.rsi_lte',
    publicName: 'RSI 低于阈值',
    aliases: ['RSI 超卖', 'RSI 不高于'],
    positiveExamples: ['RSI 小于 30'],
    negativeExamples: ['RSI 大于 70'],
    goldenUtterances: ['RSI 低于 30 且反弹时开多'],
    displayRenderer: ({ params }) => {
      const period = typeof params?.period === 'number' ? params.period : 14
      const value = typeof params?.value === 'number' ? params.value : null
      return value !== null ? `RSI${period} 低于或等于 ${value}` : `RSI${period} 低于或等于阈值`
    },
    clarificationRenderer: (_slotKey, _params) =>
      '请补充 RSI 阈值（0-100，常用：超卖 30 / 超买 70）。',
  }),
  presentation({
    key: 'trend.direction',
    publicName: '趋势方向',
    aliases: ['趋势判断', '行情方向'],
    positiveExamples: ['只在上升趋势做多'],
    negativeExamples: ['无视趋势方向'],
    goldenUtterances: ['趋势向上时只开多不做空'],
    displayRenderer: ({ params }) => {
      const direction = typeof params?.direction === 'string' ? params.direction : ''
      if (direction === 'up' || direction === 'bullish') return '趋势向上'
      if (direction === 'down' || direction === 'bearish') return '趋势向下'
      return '趋势方向过滤'
    },
  }),
  presentation({
    key: 'gate.regime',
    publicName: '趋势/状态过滤',
    aliases: ['趋势过滤', '状态过滤', 'regime gate', 'trend gate'],
    positiveExamples: [
      '上涨趋势才允许做多',
      '价格高于 EMA50 才做多',
      '价格低于 EMA60 才做空',
    ],
    negativeExamples: ['形态像头肩顶', '感觉走势不太对'],
    goldenUtterances: [
      '上涨趋势才允许做多',
      '价格高于 EMA50 才做多',
      '价格低于 EMA60 才做空',
    ],
    displayRenderer: ({ params }) => renderRegimeGate(params),
    clarificationRenderer: (slotKey) => renderRegimeGateClarification(slotKey),
  }),
  presentation({
    key: 'portfolioRisk.drawdown_block',
    publicName: '组合回撤护栏',
    aliases: ['组合回撤', '账户回撤护栏', 'portfolio drawdown', 'drawdown block'],
    positiveExamples: [
      '账户回撤超过 10% 停止开新仓',
      '回撤 5% 仅记录不停',
      '账户回撤超过 15% 阻止开仓',
    ],
    negativeExamples: ['感觉亏了', '风控大概在 10%', '形态像头肩顶'],
    goldenUtterances: [
      '账户回撤超过 10% 停止开新仓',
      '回撤 5% 仅记录不停',
      '账户回撤超过 15% 阻止开仓',
    ],
    displayRenderer: ({ params }) => renderPortfolioDrawdown(params),
    clarificationRenderer: (slotKey) => renderPortfolioDrawdownClarification(slotKey),
  }),
  // Phase 5 S8 (#1119): symbol exposure cap
  presentation({
    key: 'portfolioRisk.symbol_exposure_cap',
    publicName: '标的敞口护栏',
    aliases: ['标的敞口', 'symbol exposure cap', 'per-symbol cap', '单标的仓位限制'],
    positiveExamples: [
      'BTCUSDT 单标的敞口不超过 30%',
      'BTCUSDT 仓位超 30% 时缩减敞口',
      '标的敞口超 20% 仅记录',
    ],
    negativeExamples: ['感觉仓位重', '全仓', '随便买'],
    goldenUtterances: [
      'BTCUSDT 单标的敞口不超过 30%',
      '标的敞口超 20% 时阻止开仓',
      '标的敞口超 25% 时缩到上限',
    ],
    displayRenderer: ({ params }) => renderPortfolioSymbolExposureCap(params),
    clarificationRenderer: (slotKey) => renderPortfolioSymbolExposureCapClarification(slotKey),
  }),
  // Phase 5 S8 (#1119): substrategy exposure cap（实盘 enforce 灰度中，follow-up #1120 接入 live exposure feed）
  presentation({
    key: 'portfolioRisk.substrategy_exposure_cap',
    publicName: '子策略敞口护栏',
    aliases: ['子策略敞口', 'substrategy exposure cap', 'per-substrategy cap', '子策略仓位限制'],
    positiveExamples: [
      '趋势子策略仓位上限 50%',
      '震荡子策略敞口超 40% 暂停',
      '子策略敞口超 30% 仅记录',
    ],
    negativeExamples: ['感觉子策略仓位重', '暂停所有', '随便'],
    goldenUtterances: [
      '趋势子策略仓位上限 50%',
      '子策略敞口超 40% 时暂停',
      '子策略敞口超 30% 时阻止开仓',
    ],
    displayRenderer: ({ params }) => renderPortfolioSubStrategyExposureCap(params),
    clarificationRenderer: (slotKey) => renderPortfolioSubStrategyExposureCapClarification(slotKey),
  }),
  presentation({
    key: 'program.dynamic_grid',
    publicName: '动态网格',
    aliases: ['跟随网格', '漂移网格', 'dynamic grid'],
    positiveExamples: [
      '在 BTCUSDT 用最近 50 根 K 线高点为锚的动态网格，5 档每档 0.5%，趋势上涨时启用，停用时撤单',
      '围绕近 30 根 K 线中点挂 8 档动态网格，每档 100 USDT，停用时保留挂单',
      'ETHUSDT 最近 100 根 K 线低点动态网格，3 档 1% 步长，趋势下跌启用，停用平仓',
    ],
    negativeExamples: ['感觉网格策略', '随便挂', '区间网格不变'],
    goldenUtterances: [
      '在 BTCUSDT 用最近 50 根 K 线高点为锚的动态网格，5 档每档 0.5%，趋势上涨时启用，停用时撤单',
      '动态网格围绕近 60 根 K 线高点，5 档 0.8%，drift 1% 时重建，每次至少间隔 120 秒',
      'ETHUSDT 最近 100 根 K 线低点动态网格，3 档 1% 步长，趋势下跌启用，停用平仓',
    ],
    displayRenderer: ({ params }) => renderDynamicGrid(params),
    clarificationRenderer: (slotKey) => renderDynamicGridClarification(slotKey),
  }),
  presentation({
    key: 'program.fixed_grid_gated',
    publicName: '门控固定网格',
    aliases: ['门控网格', '区间网格', 'gated grid', 'fixed grid program'],
    positiveExamples: [
      'BTCUSDT 50000-60000 区间挂 10 档网格，5% 步长，趋势上涨时启用',
      '锚定 50000 挂 10 档 5% 步长，失活时撤单',
      '区间网格趋势上涨启用，失活时平仓',
    ],
    negativeExamples: ['感觉网格策略', '挂网格', '随便挂'],
    goldenUtterances: [
      'BTCUSDT 50000-60000 区间挂 10 档网格，5% 步长，趋势上涨时启用',
      '锚定 50000 挂 10 档 5% 步长，失活时撤单',
      '区间网格趋势上涨启用，失活时平仓',
    ],
    displayRenderer: ({ params }) => renderFixedGridGated(params),
    clarificationRenderer: (slotKey) => renderFixedGridGatedClarification(slotKey),
  }),
  // Phase 5 S6 (#984): adaptive_volatility_grid
  presentation({
    key: 'program.adaptive_volatility_grid',
    publicName: 'ATR 自适应网格',
    aliases: ['波动自适应网格', 'atr grid', 'adaptive grid', '波动率网格'],
    positiveExamples: [
      '用 ATR(14) 的 1.5 倍为步长、3 倍为区间的自适应网格',
      'ATR 自适应网格，6 档，每档不少于 0.2% 不超过 2%',
      '波动率 14 自适应网格，1 倍步长 5 倍区间',
    ],
    negativeExamples: ['挂个自适应网格', '随便用 ATR'],
    goldenUtterances: [
      'ATR(14) 1.5 倍步长 3 倍区间自适应网格 6 档，趋势上涨时启用',
      'ATR(20) 自适应网格 5 档每档钳制 0.1%-1.5%，停用平仓',
    ],
    displayRenderer: ({ params }) => renderAdaptiveVolatilityGrid(params),
    clarificationRenderer: (slotKey) => renderAdaptiveVolatilityGridClarification(slotKey),
  }),
  // Phase 5 S12 (#1118): event_listener
  presentation({
    key: 'program.event_listener',
    publicName: '事件监听',
    aliases: ['事件监听', 'webhook 监听', '外部事件订阅', 'event listener'],
    positiveExamples: [
      'OKX 合约 BTCUSDT 15m，订阅 binance webhook 事件源，趋势上涨时启用 tradingview 喊单监听',
      'discord 事件监听，按 signalId 去重 5 秒，过期 60 秒丢弃',
      'telegram 信号监听，每 10 秒去重，过期 60 秒上报告警',
    ],
    negativeExamples: ['挂个网格策略', '随便接 webhook'],
    goldenUtterances: [
      'OKX BTCUSDT 15m 订阅 tradingview 事件源，趋势上涨时启用事件监听，按 signalId 去重 5 秒',
      'discord 事件监听 webhook 信号触发，过期 60 秒丢弃',
      'telegram 信号监听，按字段 data.signalId 去重 10 秒，过期 60 秒上报',
    ],
    displayRenderer: ({ params }) => renderEventListener(params),
    clarificationRenderer: (slotKey) => renderEventListenerClarification(slotKey),
  }),
  // Phase 5 S2 (#1104): scope.symbol substrate
  presentation({
    key: 'scope.symbol',
    publicName: '标的范围',
    aliases: ['多标的范围', '多币种作用域', '标的作用域', 'symbol scope'],
    positiveExamples: [
      'BTCUSDT 和 ETHUSDT 同时跑相同策略',
      '在 BTC 和 ETH 上挂网格',
      'BTCUSDT、ETHUSDT、SOLUSDT 多个标的同时跑',
    ],
    negativeExamples: ['只交易 BTCUSDT', '感觉多个币都行', '随便几个币'],
    goldenUtterances: [
      'BTCUSDT 和 ETHUSDT 同时跑相同策略，均线金叉开多',
      '在 BTC 和 ETH 上挂网格',
      'BTCUSDT 主标的，ETHUSDT 跟随，均线金叉',
    ],
    displayRenderer: ({ params }) => renderSymbolScope(params),
    clarificationRenderer: (slotKey) => renderSymbolScopeClarification(slotKey),
  }),
  // Phase 5 S11 (#1112): scope.leg substrate
  presentation({
    key: 'scope.leg',
    publicName: '策略腿',
    aliases: ['对冲腿', '多空腿', 'hedge legs', 'strategy legs', '腿'],
    positiveExamples: [
      '做多 BTC 同时做空 ETH，等比对冲',
      '三条腿：多 BTC、多 ETH、空 SOL',
      'BTCUSDT 多头腿、ETHUSDT 空头腿，1:2 对冲',
    ],
    negativeExamples: ['做多 BTCUSDT 和 ETHUSDT', '随便对冲一下'],
    goldenUtterances: [
      '做多 BTC 同时做空 ETH，等比对冲',
      '对冲组合：BTC 做多 1000U、ETH 做空 500U',
      'delta neutral：BTC 多 ETH 空 等比',
    ],
    displayRenderer: ({ params }) => renderLegScope(params),
    clarificationRenderer: (slotKey) => renderLegScopeClarification(slotKey),
  }),
  // Phase 5 S3 (#1109): scope.timeframe substrate
  presentation({
    key: 'scope.timeframe',
    publicName: '周期范围',
    aliases: ['多周期范围', '多时间框架', 'timeframe scope', '周期作用域'],
    positiveExamples: [
      '15 分钟主周期，1 小时和 4 小时做 scope 依赖周期',
      '执行周期 5m，参考 15m 1h 多时间框架 scope',
      '主周期 1h，依赖 4h 1d 严格对齐',
    ],
    negativeExamples: ['只用 15 分钟一个周期', '随便几个周期都行'],
    goldenUtterances: [
      '15m 主周期 + 1h 4h 依赖周期严格对齐',
      'Primary timeframe 15m, required timeframes 1h and 4h',
    ],
    displayRenderer: ({ params }) => renderTimeframeScope(params),
    clarificationRenderer: (slotKey) => renderTimeframeScopeClarification(slotKey),
  }),
  // Phase 5 S9 (#1110): scope.dataSource substrate
  presentation({
    key: 'scope.dataSource',
    publicName: '数据源',
    aliases: ['数据源作用域', '行情源作用域', 'data source scope', 'feed scope'],
    positiveExamples: [
      '主行情源 binance.spot.btcusdt 用 OHLCV',
      '事件源 webhook tradingview.alpha 接收信号',
      'primary feed binance.spot.ethusdt OHLCV, confirmation feed okx.spot.ethusdt orderbook',
    ],
    negativeExamples: ['随便选个数据源', '看市场情况', '只交易 BTC'],
    goldenUtterances: [
      '主行情源 binance.spot.btcusdt 同时订阅 binance.perp.btcusdt 作为确认源',
      '事件源使用 webhook tradingview.alert',
    ],
    displayRenderer: ({ params }) => renderDataSourceScope(params),
    clarificationRenderer: (slotKey) => renderDataSourceScopeClarification(slotKey),
  }),
  // Phase 5 S10 (#1111): scope.subStrategy substrate
  presentation({
    key: 'scope.subStrategy',
    publicName: '子策略范围',
    aliases: ['多子策略', '策略切换范围', 'sub-strategy scope', 'sub strategy scope'],
    positiveExamples: [
      '趋势行情用趋势子策略，震荡行情用震荡子策略',
      '上涨时跑策略 A，下跌时跑策略 B',
      '在 BTCUSDT 上跑两套子策略，根据 ATR 切换',
    ],
    negativeExamples: ['只跑一个策略', '不需要切换', '策略不行'],
    goldenUtterances: [
      '趋势行情用趋势子策略，震荡行情用震荡子策略，切换时平掉旧仓位',
      'Use sub-strategy A in trend regime, sub-strategy B in range',
    ],
    displayRenderer: ({ params }) => renderSubStrategyScope(params),
    clarificationRenderer: (slotKey) => renderSubStrategyScopeClarification(slotKey),
  }),
  presentation({
    key: 'gate.subStrategy',
    publicName: '子策略 gate',
    aliases: ['子策略切换', '子策略暂停', 'sub-strategy gate'],
    positiveExamples: ['RSI > 70 切到震荡子策略，<30 切回趋势子策略', '盘整时暂停趋势子策略'],
    negativeExamples: ['不需要切换'],
    goldenUtterances: ['趋势成立时切到趋势子策略；震荡时切到震荡子策略'],
    displayRenderer: ({ params }) => renderSubStrategyGate(params),
    clarificationRenderer: (slotKey) => renderSubStrategyGateClarification(slotKey),
  }),
  presentation({
    key: 'market.regime',
    publicName: '市场状态',
    aliases: ['行情结构', '市场环境'],
    positiveExamples: ['震荡行情使用网格'],
    negativeExamples: ['只描述单个价格条件'],
    goldenUtterances: ['震荡行情中启用区间交易'],
    displayRenderer: ({ params }) => {
      const regime = typeof params?.regime === 'string' ? params.regime : ''
      if (regime === 'trending' || regime === 'trend') return '趋势市场'
      if (regime === 'ranging' || regime === 'range') return '震荡市场'
      if (regime === 'volatile') return '高波动市场'
      return '市场状态过滤'
    },
  }),
  presentation({
    key: 'volatility.state',
    publicName: '波动率状态',
    aliases: ['波动环境', '波动强弱'],
    positiveExamples: ['高波动时降低仓位'],
    negativeExamples: ['成交量放大但波动不变'],
    goldenUtterances: ['波动率过高时暂停加仓'],
    displayRenderer: ({ params }) => {
      const state = typeof params?.state === 'string' ? params.state : ''
      if (state === 'high') return '高波动率状态'
      if (state === 'low') return '低波动率状态'
      return '波动率状态过滤'
    },
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
    displayRenderer: () => renderDisplayToken('atom.open_long.name'),
  }),
  presentation({
    key: 'open_short',
    publicName: '开空',
    aliases: ['做空', '卖出开空'],
    positiveExamples: ['开空'],
    negativeExamples: ['平掉空单'],
    goldenUtterances: ['条件满足时开空'],
    displayRenderer: () => renderDisplayToken('atom.open_short.name'),
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
    aliases: ['追加仓位', '顺势加码', '金字塔加仓', 'scale in', 'pyramid'],
    positiveExamples: ['突破后再加一笔仓位', '信号再次出现时加仓 50%', '盈利 5% 后加仓 30%'],
    negativeExamples: ['只开第一笔仓位'],
    goldenUtterances: getGoldenUtterancesForAtom('action.add_position'),
    displayRenderer: ({ params }) => {
      const addRatio = typeof params?.addRatio === 'number' ? params.addRatio : null
      const addMode = typeof params?.addMode === 'string' ? params.addMode : null
      const profitThreshold = typeof params?.profitThreshold === 'number' ? params.profitThreshold : null
      const drawdownThreshold = typeof params?.drawdownThreshold === 'number' ? params.drawdownThreshold : null
      const ratioPct = addRatio !== null ? `${Math.round(addRatio * 100)}%` : null
      if (addMode === 'profit_pct') {
        const trigger = profitThreshold !== null ? `盈利 ${profitThreshold}% 后` : '盈利后'
        return ratioPct ? `加仓：${trigger}加仓 ${ratioPct}` : `加仓：${trigger}加仓`
      }
      if (addMode === 'drawdown_pct') {
        const trigger = drawdownThreshold !== null ? `回撤 ${drawdownThreshold}% 后` : '回撤后'
        return ratioPct ? `加仓：${trigger}加仓 ${ratioPct}` : `加仓：${trigger}加仓`
      }
      if (addMode === 'signal_confirm') {
        return ratioPct ? `加仓：信号确认后加仓 ${ratioPct}` : '加仓：信号确认后加仓'
      }
      return ratioPct ? `加仓：每次 ${ratioPct}` : '加仓'
    },
    clarificationRenderer: (slotKey, _params) => {
      if (slotKey === 'action.add_position.constraint') {
        return '请补充加仓约束，例如：最多加仓 3 次，或最大总敞口 30%。'
      }
      return '请补充加仓条件的缺失信息。'
    },
  }),
  presentation({
    key: 'action.reverse_position',
    publicName: '反手',
    aliases: ['反向开仓', '平仓后反向', '反转持仓', '翻仓'],
    positiveExamples: ['多单止损后反手开空', '信号反转时由多翻空，使用当前仓位', '由空翻多，下根 K 线执行'],
    negativeExamples: ['只平仓不反向'],
    goldenUtterances: getGoldenUtterancesForAtom('action.reverse_position'),
    displayRenderer: ({ params }) => {
      const fromSide = typeof params?.fromSide === 'string' ? params.fromSide : null
      const toSide = typeof params?.toSide === 'string' ? params.toSide : null
      if (fromSide && toSide) {
        const from = fromSide === 'long' ? '多' : fromSide === 'short' ? '空' : fromSide
        const to = toSide === 'long' ? '多' : toSide === 'short' ? '空' : toSide
        return `反手：由${from}翻${to}`
      }
      return '反手'
    },
    clarificationRenderer: (slotKey, _params) => {
      if (slotKey === 'action.reverse_position.same_bar_policy') {
        return '请确认反手执行时机：same_bar（当根 K 线立即）或 next_bar（下根 K 线）。'
      }
      if (slotKey === 'action.reverse_position.sizing_source') {
        return '请确认反手仓位来源：current_position（使用当前仓位）或 new_sizing（按新仓位规则）。'
      }
      return '请补充反手条件的缺失信息。'
    },
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
    displayRenderer: ({ params }) => renderDisplayToken('atom.risk.stop_loss_pct.display', {
      valuePct: numberParam(params, 'valuePct', 0),
    }),
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
    displayRenderer: ({ params }) => renderDisplayToken('atom.position.fixed_pct.display', {
      value: formatPercentLikeValue(numberParam(params, 'value', 0)),
    }),
  }),
  presentation({
    key: 'position.fixed_notional',
    publicName: '固定名义金额',
    aliases: ['固定金额仓位', '按金额下单'],
    positiveExamples: ['单笔 100 USDT'],
    negativeExamples: ['按账户比例下单'],
    goldenUtterances: ['每次固定投入 100 USDT'],
    displayRenderer: ({ params }) => renderDisplayToken('atom.position.fixed_notional.display', {
      value: numberParam(params, 'value', 0),
      asset: stringParam(params, 'asset', 'USDT'),
    }),
  }),
  presentation({
    key: 'position.fixed_quantity',
    publicName: '固定数量仓位',
    aliases: ['固定数量下单', '按数量下单'],
    positiveExamples: ['单笔 0.01 BTC'],
    negativeExamples: ['按账户余额百分比下单'],
    goldenUtterances: ['每次固定买入 0.01 BTC'],
    displayRenderer: ({ params }) => renderDisplayToken('atom.position.fixed_quantity.display', {
      value: numberParam(params, 'value', 0),
      asset: stringParam(params, 'asset', '币'),
    }),
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
    key: 'risk.partial_take_profit',
    publicName: '分批止盈',
    aliases: ['分档止盈', '多档止盈', '部分止盈', '阶梯止盈'],
    positiveExamples: ['盈利 5% 减仓 30%, 10% 再减 30%, 15% 全部平仓'],
    negativeExamples: ['盈利 10% 全部止盈'],
    goldenUtterances: getGoldenUtterancesForAtom('risk.partial_take_profit'),
    displayRenderer: ({ params }) => {
      const tiers = params.tiers
      if (!Array.isArray(tiers) || tiers.length === 0) {
        return renderDisplayToken('atom.risk.partial_take_profit.display.empty')
      }
      const parts = (tiers as Array<{ trigger?: { threshold?: number }; reduceRatio?: number }>).map((tier, i) => {
        const pct = typeof tier.trigger?.threshold === 'number' ? `+${tier.trigger.threshold}%` : '?%'
        const ratio = typeof tier.reduceRatio === 'number' ? `减 ${Math.round(tier.reduceRatio * 100)}%` : ''
        return `第${i + 1}档 ${pct} ${ratio}`.trim()
      })
      return renderDisplayToken('atom.risk.partial_take_profit.display', { tiers: parts.join('，') })
    },
    clarificationRenderer: (slotKey, _params) => {
      if (slotKey === 'risk.partial_take_profit.tiers') {
        return '请补充止盈档位，例如：盈利 5% 平 50%、盈利 10% 平 50%。'
      }
      return '请补充分批止盈的缺失信息。'
    },
  }),
  presentation({
    key: 'position.dca_schedule',
    publicName: 'DCA 补仓计划',
    aliases: ['定投补仓', '分批补仓计划', 'DCA', '网格补仓', '定期补仓'],
    positiveExamples: ['每跌 2% 补仓一次，最多 3 次', '定投补仓，总资金上限 1000 USDT'],
    negativeExamples: ['只开一次固定仓位', '单次加仓'],
    goldenUtterances: getGoldenUtterancesForAtom('position.dca_schedule'),
    displayRenderer: ({ params }) => {
      const maxCount = typeof params?.maxCount === 'number' ? `最多 ${params.maxCount} 次` : ''
      const triggerMode = typeof params?.triggerMode === 'string' ? renderDcaTriggerMode(params.triggerMode) : ''
      const parts = [triggerMode, maxCount].filter(Boolean)
      return parts.length > 0
        ? renderDisplayToken('atom.position.dca_schedule.display', { parts: parts.join('，') })
        : renderDisplayToken('atom.position.dca_schedule.display.empty')
    },
    clarificationRenderer: (slotKey, _params) => {
      if (slotKey === 'position.dca_schedule.max_count') return '请确认 DCA 最多执行几次，例如 3。'
      if (slotKey === 'position.dca_schedule.capital_cap') return '请确认 DCA 总资金上限，例如 1000 USDT。'
      if (slotKey === 'position.dca_schedule.per_order_sizing') return '请确认每次 DCA 补仓金额或比例，例如 100 USDT 或 10%。'
      if (slotKey === 'position.dca_schedule.trigger_mode') return '请确认 DCA 触发方式：price_interval（价格间隔）/ time_interval（时间间隔）/ signal（信号触发）。'
      if (slotKey === 'position.dca_schedule.exit_rule') return '请确认 DCA 停止规则，例如跌破前低停止或达到止损退出。'
      return '请补充 DCA 补仓计划的缺失信息。'
    },
  }),
  presentation({
    key: 'risk.time_stop_bars',
    publicName: '时间止损（K 线数）',
    aliases: ['超时离场', '持仓 K 线上限', 'time stop'],
    positiveExamples: ['持仓 20 根 K 线未盈利则离场', '超过 30 根 K 线强制平仓'],
    negativeExamples: ['按价格固定止损'],
    goldenUtterances: ['持仓 20 根 K 线仍未达成目标则离场', '超过 30 根 K 线强制平仓'],
  }),
  presentation({
    key: 'price.previous_extrema',
    publicName: '前高/前低（极值参考）',
    aliases: ['前高', '前低', 'previous high', 'previous low'],
    positiveExamples: ['前高之上突破做多', '跌破前低出场'],
    negativeExamples: ['形态像头肩顶'],
    goldenUtterances: ['突破前高后开多', '跌破前低后离场'],
  }),
  presentation({
    key: 'strategy.multi_timeframe',
    publicName: '多周期过滤',
    aliases: ['多周期', 'multi timeframe', 'HTF 过滤'],
    positiveExamples: ['1h 上涨才允许 5min 做多', '4h 区间内 15min 网格'],
    negativeExamples: ['看感觉的多周期'],
    goldenUtterances: ['1h 上涨趋势下才允许 5min 做多', '4h 区间内启用 15min 网格'],
  }),
  presentation({
    key: 'price.candle_pattern',
    publicName: 'K 线形态',
    aliases: [
      '吞没形态',
      '锤子线',
      '十字星',
      '连续实体',
      'engulfing',
      'hammer',
      'doji',
      'consecutive body',
      'bullish engulfing',
      'bearish engulfing',
    ],
    positiveExamples: [
      '出现看涨吞没形态后开多',
      '锤子线确认后做多',
      '十字星出现后开空',
      '连续 3 根阳线后加多',
    ],
    negativeExamples: ['像吞没', '疑似锤子', '看起来像十字星'],
    goldenUtterances: getGoldenUtterancesForAtom('price.candle_pattern'),
    displayRenderer: ({ params }) => {
      const pattern = stringParam(params, 'pattern', 'engulfing')
      const direction = stringParam(params, 'direction', '')
      const minBars = params && typeof params['minBars'] === 'number' ? (params['minBars'] as number) : undefined
      const minBarsLabel = minBars !== undefined ? `（≥${minBars} 根）` : ''
      return renderDisplayToken('atom.price.candle_pattern.display', {
        direction: direction ? renderEnumDisplayToken('enum.direction', direction) : '',
        pattern: renderEnumDisplayToken('enum.pattern.candle', pattern),
        minBars: minBarsLabel,
      })
    },
    clarificationRenderer: (slotKey, _params) => {
      if (slotKey === 'price.candle_pattern.pattern') return '请选择 K 线形态：engulfing（吞没）、hammer（锤子线）、doji（十字星）或 consecutive_body（连续实体）。'
      if (slotKey === 'price.candle_pattern.direction') return '请指明形态方向：bullish（看涨）或 bearish（看跌）。'
      if (slotKey === 'price.candle_pattern.minBars') return '连续实体形态需要指定最少连续根数（minBars），例如 3。'
      return '请补充 K 线形态条件的缺失信息。'
    },
  }),
  presentation({
    key: 'price.chart_pattern',
    publicName: '图形形态',
    aliases: [
      '头肩',
      '头肩顶',
      '头肩底',
      '双顶',
      '双底',
      '三角形',
      'head and shoulders',
      'inverse head and shoulders',
      'h&s',
      'double top',
      'double bottom',
      'triangle',
    ],
    positiveExamples: [
      '出现头肩底形态后开多',
      '双顶形成后开空',
      '双底形成后做多',
      '三角形向上突破后开多',
    ],
    negativeExamples: ['看起来像头肩', '疑似双顶', 'looks like a triangle'],
    goldenUtterances: getGoldenUtterancesForAtom('price.chart_pattern'),
    displayRenderer: ({ params }) => {
      const pattern = stringParam(params, 'pattern', 'head_and_shoulders')
      const direction = stringParam(params, 'direction', '')
      return renderDisplayToken('atom.price.chart_pattern.display', {
        direction: direction ? renderEnumDisplayToken('enum.direction', direction) : '',
        pattern: renderEnumDisplayToken('enum.pattern.chart', pattern),
      })
    },
    clarificationRenderer: (slotKey, _params) => {
      if (slotKey === 'price.chart_pattern.pattern') return '请选择图形形态：head_and_shoulders（头肩）、double_top（双顶）、double_bottom（双底）或 triangle（三角形）。'
      if (slotKey === 'price.chart_pattern.direction') return '请指明形态突破方向：bullish（看涨）或 bearish（看跌）。'
      return '请补充图形形态条件的缺失信息。'
    },
  }),
  presentation({
    key: 'liquidity.sweep',
    publicName: '流动性扫荡',
    aliases: [
      '流动性扫荡',
      '流动性猎杀',
      '扫止损',
      '扫单',
      '假突破',
      'liquidity sweep',
      'liquidity grab',
      'stop hunt',
      'sweep and reclaim',
    ],
    positiveExamples: [
      '扫前低后反弹做多',
      '扫前高后回落做空',
      'sweep prev low then reclaim within 3 bars',
      'liquidity grab at session high, open short',
    ],
    negativeExamples: ['看起来像扫荡', '疑似 sweep', 'looks like a stop hunt'],
    goldenUtterances: getGoldenUtterancesForAtom('liquidity.sweep'),
    displayRenderer: ({ params }) => {
      const direction = stringParam(params, 'direction', '')
      const reference = stringParam(params, 'reference', '')
      const reclaimBars = params && typeof params['reclaimBars'] === 'number' ? (params['reclaimBars'] as number) : undefined
      const reclaimLabel = reclaimBars !== undefined ? `（${reclaimBars} 根内 reclaim）` : ''
      return renderDisplayToken('atom.liquidity.sweep.display', {
        direction: direction ? renderEnumDisplayToken('enum.direction', direction) : '',
        reference: reference ? renderEnumDisplayToken('enum.reference', reference) : '',
        reclaimBars: reclaimLabel,
      })
    },
    clarificationRenderer: (slotKey, _params) => {
      if (slotKey === 'liquidity.sweep.direction') return '请指明扫荡反转方向：bullish（看涨，扫前低后反弹）或 bearish（看跌，扫前高后回落）。'
      if (slotKey === 'liquidity.sweep.reference') return '请选择被扫荡的关键位：prev_low（前低）、prev_high（前高）、session_low（日内低）或 session_high（日内高）。'
      if (slotKey === 'liquidity.sweep.reclaimBars') return '请指明 reclaim 的最大确认根数（reclaimBars），例如 3。'
      return '请补充流动性扫荡条件的缺失信息。'
    },
  }),
  presentation({
    key: 'indicator.divergence',
    publicName: '指标背离',
    aliases: [
      '背离',
      '顶背离',
      '底背离',
      'RSI 背离',
      'MACD 背离',
      'bullish divergence',
      'bearish divergence',
    ],
    positiveExamples: [
      'RSI 顶背离后开空',
      'MACD 底背离后开多',
      'RSI 底背离 + 确认 3 根 K 线',
    ],
    negativeExamples: ['像背离', '疑似背离', '看起来像背离'],
    goldenUtterances: getGoldenUtterancesForAtom('indicator.divergence'),
    displayRenderer: ({ params }) => {
      const indicator = stringParam(params, 'indicator', 'RSI').toUpperCase()
      const direction = stringParam(params, 'direction', '')
      const pivotWindow = numberParam(params, 'pivotWindow', 14)
      const confirmationBars = numberParam(params, 'confirmationBars', 3)
      return renderDisplayToken('atom.indicator.divergence.display', {
        indicator,
        direction: direction ? renderEnumDisplayToken('enum.divergence', direction) : '背离',
        pivotWindow,
        confirmationBars,
      })
    },
    clarificationRenderer: (slotKey, _params) => {
      if (slotKey === 'indicator.divergence.indicator') return '请选择背离使用的指标：rsi 或 macd。'
      if (slotKey === 'indicator.divergence.direction') return '请指明背离方向：bullish（底背离，价格创新低但指标未创新低）或 bearish（顶背离，价格创新高但指标未创新高）。'
      if (slotKey === 'indicator.divergence.pivotWindow') return '请指定背离判断的滚动窗口大小，例如 14（默认值）。'
      if (slotKey === 'indicator.divergence.confirmationBars') return '请指定确认 K 线数，例如 3（默认值）。'
      return '请补充指标背离条件的缺失信息。'
    },
  }),
  presentation({
    key: 'external.signal',
    publicName: '外部喊单 / Webhook 信号',
    aliases: [
      '外部喊单',
      '喊单群',
      'KOL 信号',
      '外部信号',
      'tradingview 信号',
      'discord 信号',
      'telegram 信号',
      'webhook',
      'external signal',
    ],
    positiveExamples: [
      '收到 TradingView webhook 信号后开多',
      'discord 喊单群发出 buy 信号就开仓',
      'telegram bot 推送外部信号触发开多',
    ],
    negativeExamples: ['看群里讨论后随手开仓'],
    goldenUtterances: [
      'OKX BTCUSDT 15m，收到 tradingview webhook 信号后开多，5% 止损。',
      'OKX BTCUSDT 15m, on discord buy signal open long, 5% stop loss.',
      'OKX BTCUSDT 15m，telegram bot 推送外部信号 BTC_LONG_01 时开仓。',
    ],
    displayRenderer: ({ params }) => {
      const provider = stringParam(params, 'provider', '')
      return renderDisplayToken('atom.external.signal.display', {
        provider: provider ? renderEnumDisplayToken('enum.provider', provider) : '外部信号',
      })
    },
    clarificationRenderer: (slotKey, _params) => {
      if (slotKey === 'external.signal.provider') return '请指明外部信号来源：tradingview / discord / telegram / webhook。'
      if (slotKey === 'external.signal.signalId') return '请提供外部信号订阅 ID（用于过滤推送）。'
      if (slotKey === 'external.signal.secret') return '请提供 HMAC 校验 secret，避免冒名信号触发开仓（可由系统生成后回填）。'
      return '请补充外部信号触发条件的缺失信息。'
    },
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

const PRESENTATIONS_BY_KEY: ReadonlyMap<string, SemanticPresentationMetadata> = new Map(
  PRESENTATIONS.map(metadata => [metadata.key, metadata]),
)

// module-load fail-loud：对全部 legacy entry 执行 guardLegacyMetadata，
// 确保静态文案（publicName / aliases / examples）在模块初始化时即触发 leak 检测，
// 不等到首次运行时调用才暴露问题。
;(() => {
  for (const metadata of PRESENTATIONS_BY_KEY.values()) {
    guardLegacyMetadata(metadata)
  }
})()

/**
 * 仅查 PRESENTATIONS（94 entry transition 全集），不合成 REGISTRY 形态。
 * 供需要完整 SemanticPresentationMetadata（aliases / examples / goldenUtterances）的调用方使用。
 */
export function getLegacyEntry(atomKey: string): SemanticPresentationMetadata | undefined {
  return PRESENTATIONS_BY_KEY.get(atomKey)
}

/**
 * 渲染 atom display 文案。优先级：
 *   1. ATOM_CONTRACT_REGISTRY[atomKey].display.summaryTemplate(params, 'zh') —— 36 已迁入 atom
 *   2. PRESENTATIONS[atomKey].displayRenderer({ params }) —— 60 transition entry fallback
 *   3. 都未命中 → throw SemanticPresentationTokenNotFoundException
 * 输出统一经 guardPublicText 兜底（internal-key leak fail-loud）。
 */
export function renderLegacyDisplay(atomKey: string, params: Record<string, unknown>): string {
  const registryEntry = ATOM_CONTRACT_REGISTRY[atomKey as AtomContractKey]
  if (registryEntry !== undefined) {
    if (typeof registryEntry.display?.summaryTemplate !== 'function') {
      throw new Error(
        `[legacy-presentation-data] REGISTRY entry ${atomKey} missing display.summaryTemplate (fail-closed contract violation)`,
      )
    }
    return guardPublicText(atomKey, registryEntry.display.summaryTemplate(params, 'zh'))
  }
  const legacy = PRESENTATIONS_BY_KEY.get(atomKey)
  if (!legacy) {
    throw new SemanticPresentationTokenNotFoundException({ token: atomKey })
  }
  return guardPublicText(atomKey, legacy.displayRenderer({ params }))
}

/**
 * 渲染 atom clarification 文案。优先级：
 *   1. ATOM_CONTRACT_REGISTRY[atomKey].clarificationQuestion(slotKey, params, 'zh')（函数时）
 *   2. PRESENTATIONS[atomKey].clarificationRenderer(slotKey, params)
 *   3. 都未命中 → throw SemanticPresentationTokenNotFoundException
 */
export function renderLegacyClarification(
  atomKey: string,
  slotKey: string,
  params: Record<string, unknown>,
): string {
  const registryEntry = ATOM_CONTRACT_REGISTRY[atomKey as AtomContractKey]
  const clarificationFn = registryEntry?.clarificationQuestion
  if (typeof clarificationFn === 'function') {
    const output = clarificationFn(slotKey, params, 'zh')
    return guardPublicText(atomKey, output)
  }
  const legacy = PRESENTATIONS_BY_KEY.get(atomKey)
  if (!legacy) {
    throw new SemanticPresentationTokenNotFoundException({ token: atomKey })
  }
  guardLegacyMetadata(legacy)
  return guardPublicText(atomKey, legacy.clarificationRenderer(slotKey, params))
}

/**
 * "是否显式声明 displayRenderer" 探测：
 *   - REGISTRY 内 atom 一律视为已显式（summaryTemplate 是必选契约）
 *   - PRESENTATIONS entry 走 hasExplicitDisplayRenderer 字段
 *   - 都不在 → false
 */
export function hasExplicitLegacyDisplayRenderer(atomKey: string): boolean {
  const registryEntry = ATOM_CONTRACT_REGISTRY[atomKey as AtomContractKey]
  if (registryEntry !== undefined) {
    return typeof registryEntry.display?.summaryTemplate === 'function'
  }
  return PRESENTATIONS_BY_KEY.get(atomKey)?.hasExplicitDisplayRenderer ?? false
}

function guardLegacyMetadata(metadata: SemanticPresentationMetadata): void {
  const fields = [
    metadata.publicName,
    ...metadata.aliases,
    ...metadata.positiveExamples,
    ...metadata.negativeExamples,
    ...metadata.goldenUtterances,
  ]
  for (const field of fields) {
    guardPublicText(metadata.key, field)
  }
}

function presentation(
  metadata: Omit<SemanticPresentationMetadata, 'clarificationRenderer' | 'displayRenderer' | 'hasExplicitDisplayRenderer'> & {
    clarificationRenderer?: SemanticPresentationMetadata['clarificationRenderer']
    displayRenderer?: SemanticPresentationMetadata['displayRenderer']
  },
): SemanticPresentationMetadata {
  const hasExplicitDisplayRenderer = typeof metadata.displayRenderer === 'function'
  return {
    ...metadata,
    displayRenderer: metadata.displayRenderer
      ?? (() => renderDisplayToken(`atom.${metadata.key}.name`)),
    hasExplicitDisplayRenderer,
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
    return renderDisplayToken('atom.indicator_boundary_touch.display', {
      indicator: 'BOLL',
      boundaryRole: renderBoundaryRole(boundaryRole),
      settings: `（${period}, ${stdDev}）`,
    })
  }

  return renderDisplayToken('atom.indicator_boundary_touch.display', {
    indicator: indicatorName.toUpperCase(),
    boundaryRole: renderBoundaryRole(boundaryRole),
    settings: '',
  })
}

function renderBoundaryRole(boundaryRole: string): string {
  return renderEnumDisplayToken('enum.boundaryRole', boundaryRole)
}

function renderRegimeGate(params: Record<string, unknown>): string {
  const sideScope = stringParam(params, 'sideScope', 'both')
  const indicator = stringParam(params, 'indicator', 'ema')
  const period = numberParam(params, 'period', 0)
  const operator = stringParam(params, 'operator', 'GT')
  const indicatorLabel = renderRegimeIndicator(indicator)
  const periodLabel = period > 0 ? `${period}` : ''
  const indicatorWithPeriod = `${indicatorLabel}${periodLabel}`

  const longLine = renderDisplayToken('atom.gate.regime.long.display', { indicator: indicatorWithPeriod })
  const shortLine = renderDisplayToken('atom.gate.regime.short.display', { indicator: indicatorWithPeriod })

  if (sideScope === 'long') {
    return operator === 'LT' ? shortLine : longLine
  }
  if (sideScope === 'short') {
    return operator === 'GT' ? longLine : shortLine
  }
  return renderDisplayToken('atom.gate.regime.both.display', { longLine, shortLine })
}

function renderRegimeIndicator(indicator: string): string {
  const normalized = indicator.toLowerCase()
  return renderEnumDisplayToken('enum.indicator', normalized)
}

function renderDcaTriggerMode(triggerMode: string): string {
  return renderEnumDisplayToken('enum.dca.triggerMode', triggerMode)
}

function renderRegimeGateClarification(slotKey: string): string {
  if (slotKey === 'orchestration.gate.regime.active_when') {
    return '请确认趋势过滤的指标（EMA/SMA/MA）与周期'
  }
  return '请补全趋势过滤参数'
}

function renderPortfolioDrawdown(params: Record<string, unknown>): string {
  const thresholdPct = numberParam(params, 'thresholdPct', 0)
  const mode = stringParam(params, 'mode', 'enforce')
  if (mode === 'observe') {
    return renderDisplayToken('atom.portfolioRisk.drawdown_block.display.observe', { thresholdPct })
  }
  return renderDisplayToken('atom.portfolioRisk.drawdown_block.display.enforce', { thresholdPct })
}

function renderPortfolioDrawdownClarification(slotKey: string): string {
  if (slotKey === 'orchestration.portfolio_drawdown.threshold_pct') {
    return '请确认账户回撤百分比阈值（0..100）'
  }
  return '请补全账户回撤护栏参数'
}

// Phase 5 S8 (#1119): symbol exposure cap render
function renderPortfolioSymbolExposureCap(params: Record<string, unknown>): string {
  const notionalCapPct = numberParam(params, 'notionalCapPct', 0)
  const mode = stringParam(params, 'mode', 'enforce')
  const effect = stringParam(params, 'effectWhenTriggered', 'block_new_entries')
  const symbolLabel = typeof params['symbolLabel'] === 'string' && params['symbolLabel'].trim() !== ''
    ? `${params['symbolLabel'].trim()} `
    : ''
  if (mode === 'observe') {
    return renderDisplayToken('atom.portfolioRisk.symbol_exposure_cap.display.observe', { symbolLabel, notionalCapPct })
  }
  if (effect === 'reduce_exposure') {
    return renderDisplayToken('atom.portfolioRisk.symbol_exposure_cap.display.enforce.reduce', { symbolLabel, notionalCapPct })
  }
  return renderDisplayToken('atom.portfolioRisk.symbol_exposure_cap.display.enforce.block', { symbolLabel, notionalCapPct })
}

function renderPortfolioSymbolExposureCapClarification(slotKey: string): string {
  if (slotKey.includes('notional_cap_pct')) {
    return renderDisplayToken('atom.portfolioRisk.symbol_exposure_cap.clarify.notional_cap_pct', {})
  }
  if (slotKey.includes('bound_symbol_scope_ref')) {
    return renderDisplayToken('atom.portfolioRisk.symbol_exposure_cap.clarify.bound_symbol_scope_ref', {})
  }
  if (slotKey.includes('effect')) {
    return renderDisplayToken('atom.portfolioRisk.symbol_exposure_cap.clarify.effect', {})
  }
  return '请补全标的敞口护栏参数'
}

// Phase 5 S8 (#1119): substrategy exposure cap render
function renderPortfolioSubStrategyExposureCap(params: Record<string, unknown>): string {
  const notionalCapPct = numberParam(params, 'notionalCapPct', 0)
  const mode = stringParam(params, 'mode', 'enforce')
  const effect = stringParam(params, 'effectWhenTriggered', 'block_new_entries')
  if (mode === 'observe') {
    return renderDisplayToken('atom.portfolioRisk.substrategy_exposure_cap.display.observe', { notionalCapPct })
  }
  if (effect === 'pause_substrategy') {
    return renderDisplayToken('atom.portfolioRisk.substrategy_exposure_cap.display.enforce.pause', { notionalCapPct })
  }
  return renderDisplayToken('atom.portfolioRisk.substrategy_exposure_cap.display.enforce.block', { notionalCapPct })
}

function renderPortfolioSubStrategyExposureCapClarification(slotKey: string): string {
  if (slotKey.includes('notional_cap_pct')) {
    return renderDisplayToken('atom.portfolioRisk.substrategy_exposure_cap.clarify.notional_cap_pct', {})
  }
  if (slotKey.includes('bound_substrategy_scope_ref')) {
    return renderDisplayToken('atom.portfolioRisk.substrategy_exposure_cap.clarify.bound_substrategy_scope_ref', {})
  }
  if (slotKey.includes('effect')) {
    return renderDisplayToken('atom.portfolioRisk.substrategy_exposure_cap.clarify.effect', {})
  }
  return '请补全子策略敞口护栏参数'
}

// Phase 5 S5：dynamic_grid 显式黑名单（critic round 1 M5 + critic round 2 m1）。
// 用户可见 display 文本绝不能出现这些字面量；publicName 用中文 "高点 / 低点 / 中点 / 动态网格"。
const DYNAMIC_GRID_DISPLAY_BLACKLIST = [
  'program.dynamic_grid',
  'dynamic_grid',
  'anchor_on_state_change',
  'high',
  'low',
  'mid',
] as const

function renderDynamicGrid(params: Record<string, unknown>): string {
  const inner = objectParam(params, 'params')
  const source = Object.keys(inner).length > 0 ? inner : params
  const lookback = numberParam(source, 'anchorLookbackBars', 0)
  const anchorSide = stringParam(source, 'anchorSide', 'high')
  const levels = numberParam(source, 'levelCount', 0)
  const step = objectParam(source, 'step')
  const stepMode = stringParam(step, 'mode', 'pct')
  const stepValue = numberParam(step, 'value', 0)
  const onDeactivate = stringParam(source, 'onDeactivate', 'cancel')

  const sideLabel: Record<string, string> = { high: '高点', low: '低点', mid: '中点' }
  const deactivateLabel: Record<string, string> = {
    cancel: '撤单',
    keep: '保留挂单',
    close: '平仓',
  }
  const stepLabel = stepMode === 'pct' ? `${stepValue}%` : `${stepValue}`
  const text = `围绕最近 ${lookback} 根 K 线${sideLabel[anchorSide] ?? '高点'}的 ${levels} 档动态网格（每档 ${stepLabel}），失活时${deactivateLabel[onDeactivate] ?? '撤单'}`
  // critic round 1 M5：display 输出绝不能含黑名单字面量
  for (const banned of DYNAMIC_GRID_DISPLAY_BLACKLIST) {
    if (text.includes(banned)) {
      throw new Error(`dynamic_grid display leaked blacklisted token: ${banned}`)
    }
  }
  return text
}

function renderDynamicGridClarification(slotKey: string): string {
  if (slotKey === 'orchestration.program.dynamic_grid.anchor_lookback_bars') {
    return '请确认动态网格的 anchor lookback K 线根数（10..1000 整数）'
  }
  if (slotKey === 'orchestration.program.dynamic_grid.anchor_side') {
    return '请确认 anchor 取值方向：高点 / 低点 / 中点'
  }
  if (slotKey === 'orchestration.program.dynamic_grid.dynamic_grid_step.mode'
    || slotKey === 'orchestration.program.dynamic_grid.dynamic_grid_step.value') {
    return '请确认网格步长（mode = pct/absolute；value > 0）'
  }
  if (slotKey === 'orchestration.program.dynamic_grid.level_count') {
    return '请确认网格档位数量（2..100 整数）'
  }
  if (slotKey === 'orchestration.program.dynamic_grid.anchor_drift_pct') {
    return '请确认 anchor 漂移阈值百分比（>0 ≤100）'
  }
  if (slotKey === 'orchestration.program.dynamic_grid.rebuild_min_interval_sec') {
    return '请确认 rebuild 最小间隔秒数（≥60）'
  }
  if (slotKey === 'orchestration.program.dynamic_grid.active_when_ref') {
    return '请确认动态网格的启用/失活条件（引用哪个趋势/状态过滤）'
  }
  if (slotKey === 'orchestration.program.dynamic_grid.sizing.mode'
    || slotKey === 'orchestration.program.dynamic_grid.sizing.value') {
    return '请确认每档下单数量（fixed_quote / fixed_base / fixed_pct）'
  }
  return '请补全动态网格策略参数'
}

function renderFixedGridGated(params: Record<string, unknown>): string {
  const inner = objectParam(params, 'params')
  const source = Object.keys(inner).length > 0 ? inner : params
  const lower = numberParam(source, 'lowerBound', 0)
  const upper = numberParam(source, 'upperBound', 0)
  const anchor = numberParam(source, 'anchorPrice', 0)
  const levels = numberParam(source, 'levelCount', 0)
  const step = numberParam(source, 'stepPct', 0)
  const onDeactivate = stringParam(source, 'onDeactivate', 'cancel')
  const rangeLabel = lower > 0 && upper > 0
    ? `在 ${lower}-${upper} 区间`
    : anchor > 0
      ? `锚定 ${anchor}`
      : '在指定区间'
  return renderDisplayToken('atom.program.fixed_grid_gated.display', {
    range: rangeLabel,
    levels,
    step,
    onDeactivate: renderEnumDisplayToken('enum.onDeactivate', onDeactivate),
  })
}

function renderFixedGridGatedClarification(slotKey: string): string {
  if (slotKey === 'orchestration.program.fixed_grid_gated.gridParams') {
    return '请确认网格区间、档数、步长'
  }
  if (slotKey === 'orchestration.program.fixed_grid_gated.activeWhenRef') {
    return '请确认网格的启用/失活条件（引用哪个趋势/状态过滤）'
  }
  if (slotKey === 'orchestration.program.fixed_grid_gated.sizing') {
    return '请确认每档下单数量'
  }
  return '请补全网格策略参数'
}

// Phase 5 S6 (#984): adaptive_volatility_grid
//
// 注意（critic round 2 Q8 黑名单 + 双向 grep）：
//   - 必须不出现内部 key 字面量：`program.adaptive_volatility_grid` /
//     `atr_window` / `adaptive_volatility_grid`（snake_case 内部标识）
//   - 必须保留用户友好 fragment：`ATR(N)` / `自适应网格` / `波动率` / `钳制`
function renderAdaptiveVolatilityGrid(params: Record<string, unknown>): string {
  const inner = objectParam(params, 'params')
  const source = Object.keys(inner).length > 0 ? inner : params
  const atrPeriod = numberParam(source, 'atrPeriod', 14)
  const atrMultiplier = numberParam(source, 'atrMultiplier', 1.5)
  const rangeMultiplier = numberParam(source, 'rangeMultiplier', 3)
  const minStepPct = numberParam(source, 'minStepPct', 0.2)
  const maxStepPct = numberParam(source, 'maxStepPct', 2)
  const levelCount = numberParam(source, 'levelCount', 6)
  const onDeactivate = stringParam(source, 'onDeactivate', 'cancel')
  const deactivateLabel: Record<string, string> = {
    cancel: '撤单',
    keep: '保留挂单',
    close: '平仓',
  }
  return (
    `ATR(${atrPeriod}) 的 ${atrMultiplier} 倍为步长、${rangeMultiplier} 倍为区间的自适应网格，`
    + `${levelCount} 档，每档 ${minStepPct}%-${maxStepPct}% 钳制，失活时${deactivateLabel[onDeactivate] ?? '撤单'}`
  )
}

// Phase 5 S12 (#1118): event_listener 显式黑名单（plan A16）。
//   用户可见 display 文本绝不能出现这些字面量；publicName 用中文 "事件监听 / 数据源 / 命名空间"。
const EVENT_LISTENER_DISPLAY_BLACKLIST = [
  'program.event_listener',
  'event_listener',
  'webhook_event',
  'on_schema_version_bump',
  'dedupWindowMs',
  'expirationTtlMs',
  'permissionScope',
] as const

function renderEventListener(params: Record<string, unknown>): string {
  const inner = objectParam(params, 'params')
  const source = Object.keys(inner).length > 0 ? inner : params
  const permissionScope = stringParam(source, 'permissionScope', '')
  // permissionScope 形如 `tradingview:alpha`；只露 provider 段
  const provider = permissionScope.split(':')[0] || '外部信号'
  const providerLabel: Record<string, string> = {
    tradingview: 'TradingView 喊单',
    discord: 'Discord 喊单',
    telegram: 'Telegram 喊单',
    webhook: 'Webhook 信号',
  }
  const text = `事件监听 — ${providerLabel[provider] ?? '外部事件'}`
  for (const banned of EVENT_LISTENER_DISPLAY_BLACKLIST) {
    if (text.includes(banned)) {
      throw new Error(`event_listener display leaked blacklisted token: ${banned}`)
    }
  }
  return text
}

function renderEventListenerClarification(slotKey: string): string {
  if (slotKey === 'orchestration.program.event_listener.event_schema_ref') {
    return '请确认事件 schema（仅支持 webhook 事件）'
  }
  if (slotKey === 'orchestration.program.event_listener.source_ref') {
    return '请确认事件源数据节点 id（引用一个 role=event 的数据源）'
  }
  if (slotKey === 'orchestration.program.event_listener.permission_scope') {
    return '请确认事件权限命名空间（如 tradingview:alpha；小写字母开头，3-64 字符）'
  }
  if (slotKey === 'orchestration.program.event_listener.idempotency_key.field_path') {
    return '请确认幂等字段名（仅允许 0-1 层路径，如 signalId 或 data.signalId）'
  }
  if (slotKey === 'orchestration.program.event_listener.dedup_window_ms') {
    return '请确认去重窗口毫秒（100..3600000 整数）'
  }
  if (slotKey === 'orchestration.program.event_listener.expiration_ttl_ms') {
    return '请确认事件过期时长毫秒（100..86400000 整数；必须严格大于去重窗口）'
  }
  if (slotKey === 'orchestration.program.event_listener.expiration_policy') {
    return '请确认过期事件处理策略（丢弃 / 上报）'
  }
  if (slotKey === 'orchestration.program.event_listener.on_deactivate') {
    return '请确认停用时行为（撤单 / 保留监听）'
  }
  if (slotKey === 'orchestration.program.event_listener.active_when_ref') {
    return '请确认事件监听的启用/失活条件（引用哪个趋势/状态过滤）'
  }
  if (slotKey === 'orchestration.program.event_listener.rebuild_policy') {
    return '请确认重建策略（始终保留 / schema 版本变更时清空）'
  }
  if (slotKey === 'orchestration.program.event_listener.program_kind') {
    return '请确认 programKind 为事件监听类型'
  }
  return '请补全事件监听参数'
}

function renderAdaptiveVolatilityGridClarification(slotKey: string): string {
  if (slotKey === 'orchestration.program.adaptive_volatility_grid.atr_period') return '请确认 ATR 周期（2..200 整数）'
  if (slotKey === 'orchestration.program.adaptive_volatility_grid.atr_multiplier') return '请确认 ATR 步长系数（>0）'
  if (slotKey === 'orchestration.program.adaptive_volatility_grid.range_multiplier') return '请确认 ATR 区间系数（>0）'
  if (slotKey === 'orchestration.program.adaptive_volatility_grid.atr_drift_pct') return '请确认 ATR 漂移百分比（>0 且 ≤100）'
  if (slotKey === 'orchestration.program.adaptive_volatility_grid.rebuild_cooldown_sec') return '请确认重建冷却时长（≥300 整数秒）'
  if (slotKey === 'orchestration.program.adaptive_volatility_grid.min_step_pct') return '请确认最小步长百分比（>0）'
  if (slotKey === 'orchestration.program.adaptive_volatility_grid.max_step_pct') return '请确认最大步长百分比（>0 且 ≥ 最小步长）'
  if (slotKey === 'orchestration.program.adaptive_volatility_grid.level_count') return '请确认档位数量（2..100 整数）'
  if (slotKey === 'orchestration.program.adaptive_volatility_grid.sizing') return '请确认每档下单数量'
  if (slotKey === 'orchestration.program.adaptive_volatility_grid.active_when_ref') return '请确认网格启用/失活条件（引用哪个趋势过滤）'
  return '请补全自适应网格参数'
}

// Phase 5 S2 (#1104): scope.symbol render
function renderSymbolScope(params: Record<string, unknown>): string {
  const symbolsRaw = params.symbols
  const symbols = Array.isArray(symbolsRaw)
    ? symbolsRaw.filter((s): s is string => typeof s === 'string').join('、')
    : ''
  if (symbols === '') return ''
  const primary = stringParam(params, 'primarySymbol', '')
  if (primary !== '') {
    return renderDisplayToken('atom.scope.symbol.display.with_primary', { symbols, primarySymbol: primary })
  }
  return renderDisplayToken('atom.scope.symbol.display.no_primary', { symbols })
}

function renderSymbolScopeClarification(slotKey: string): string {
  if (slotKey === 'orchestration.scope.symbol.symbols') return '请确认要绑定的标的列表'
  if (slotKey === 'orchestration.scope.symbol.primary_symbol') return '主标的必须在标的列表中'
  if (slotKey === 'orchestration.scope.symbol.symbols_overlap') return '多 scope 之间标的不能重叠'
  if (slotKey === 'orchestration.scope.symbol.primary_symbol_collision') return '多 scope 主标的必须各自唯一'
  if (slotKey === 'orchestration.scope.symbol.missing_binding') return '请确认该规则绑定到哪个 symbol scope'
  if (slotKey === 'orchestration.scope.unsupported_kind') return '当前仅支持 scope.symbol / scope.leg / scope.timeframe / scope.dataSource / scope.subStrategy'
  return '请补全标的范围参数'
}

// Phase 5 S11 (#1112): scope.leg render
function renderLegScope(params: Record<string, unknown>): string {
  const direction = stringParam(params, 'direction', '')
  const instrument = stringParam(params, 'instrumentSymbol', '') || stringParam(params, 'instrumentRef', '')
  if (direction === 'long' && instrument !== '') {
    return renderDisplayToken('atom.scope.leg.display.long', { instrument })
  }
  if (direction === 'short' && instrument !== '') {
    return renderDisplayToken('atom.scope.leg.display.short', { instrument })
  }
  // 多 leg 聚合渲染
  const legsRaw = params.legs
  if (Array.isArray(legsRaw)) {
    const parts: string[] = []
    for (const item of legsRaw) {
      if (typeof item !== 'object' || item === null) continue
      const r = item as Record<string, unknown>
      const d = typeof r.direction === 'string' ? r.direction : ''
      const sym = typeof r.instrumentSymbol === 'string' ? r.instrumentSymbol : ''
      if (sym === '') continue
      parts.push(d === 'short' ? `空 ${sym}` : `多 ${sym}`)
    }
    if (parts.length > 0) {
      return renderDisplayToken('atom.scope.leg.display.hedge', { legs: parts.join('、') })
    }
  }
  return ''
}

function renderLegScopeClarification(slotKey: string): string {
  if (slotKey === 'orchestration.scope.leg.unsupported_kind') return '当前仅支持 scope.leg 子类型'
  if (slotKey === 'orchestration.scope.leg.leg_scope_kind') return '请确认 legScopeKind 为 leg'
  if (slotKey === 'orchestration.scope.leg.leg_id') return '请确认腿 id（字母开头、字母数字下划线点、长度 ≤ 64）'
  if (slotKey === 'orchestration.scope.leg.direction') return '请确认腿方向（long/short）'
  if (slotKey === 'orchestration.scope.leg.instrument_ref') return '该腿引用的 scope.symbol 节点必须已存在且 readiness 已通过'
  if (slotKey === 'orchestration.scope.leg.leg_sizing.mode') return '请确认 legSizing.mode（fixed_pct/fixed_quote/fixed_ratio）'
  if (slotKey === 'orchestration.scope.leg.leg_sizing.value') return '请确认 legSizing.value（>0 有限数）'
  if (slotKey === 'orchestration.scope.leg.paired_leg_id') return 'fixed_ratio 模式必须指定 pairedLegId'
  if (slotKey === 'orchestration.scope.leg.direction_collision') return 'paired leg 必须方向相反（对冲腿）'
  if (slotKey === 'orchestration.scope.leg.missing_binding') return '请确认该规则绑定到哪个策略腿'
  return '请补全策略腿参数'
}

// Phase 5 S3 (#1109): scope.timeframe render
function renderTimeframeScope(params: Record<string, unknown>): string {
  const primary = stringParam(params, 'primaryTimeframe', '')
  const requiredRaw = params.requiredTimeframes
  const required = Array.isArray(requiredRaw)
    ? requiredRaw.filter((tf): tf is string => typeof tf === 'string').join('、')
    : ''
  const alignmentPolicy = stringParam(params, 'alignmentPolicy', 'strict')
  if (primary === '' || required === '') return ''
  return renderDisplayToken('atom.scope.timeframe.display.with_required', {
    primaryTimeframe: primary,
    requiredTimeframes: required,
    alignmentPolicy,
  })
}

function renderTimeframeScopeClarification(slotKey: string): string {
  if (slotKey === 'orchestration.scope.timeframe.primary_timeframe') return '请确认执行周期（主周期）'
  if (slotKey === 'orchestration.scope.timeframe.required_timeframes') return '请确认依赖周期列表（≥1 个，且与主周期不同）'
  if (slotKey === 'orchestration.scope.timeframe.required_length') return '依赖周期数量必须在 1..8 之间'
  if (slotKey === 'orchestration.scope.timeframe.primary_granularity') return '主周期粒度必须严格细于所有依赖周期'
  if (slotKey === 'orchestration.scope.timeframe.alignment_policy') return '请确认对齐严格度（strict / tolerant）'
  if (slotKey === 'orchestration.scope.timeframe.duplicate_definition') return '多 scope.timeframe 之间 (主周期, 依赖周期集合) 不能完全相同'
  if (slotKey === 'orchestration.scope.timeframe.missing_binding') return '请确认该规则绑定到哪个 timeframe scope（必须显式声明）'
  if (slotKey === 'orchestration.scope.timeframe.unsupported_key') return '当前仅支持 scope.timeframe'
  if (slotKey === 'orchestration.scope.timeframe.scope_kind') return '请确认 scopeKind 为 timeframe'
  return '请补全周期范围参数'
}

// Phase 5 S9 (#1110): scope.dataSource render — role 直出英文 enum（与 S2 风格一致）
function renderDataSourceScope(params: Record<string, unknown>): string {
  const role = stringParam(params, 'role', '')
  const feedId = stringParam(params, 'feedId', '')
  const schema = stringParam(params, 'schemaRef', '') || stringParam(params, 'schema', '')
  if (role === '' || feedId === '') return ''
  return renderDisplayToken('atom.scope.dataSource.display', { role, feedId, schema })
}

function renderDataSourceScopeClarification(slotKey: string): string {
  if (slotKey === 'orchestration.scope.dataSource.role') return '请确认数据源角色（primary/confirmation/event）'
  if (slotKey === 'orchestration.scope.dataSource.feed_id') return '请确认数据源 feedId（如 binance.spot.btcusdt）'
  if (slotKey === 'orchestration.scope.dataSource.schema_ref') return '请确认数据源 schema（ohlcv/orderbook/liquidation/webhook_event）'
  if (slotKey === 'orchestration.scope.dataSource.feed_id_overlap') return '多 scope 间 feedId 不能重复'
  if (slotKey === 'orchestration.scope.dataSource.primary_collision') return 'primary 数据源最多一个'
  if (slotKey === 'orchestration.scope.dataSource.missing_binding') return '请确认该规则绑定到哪个 dataSource scope'
  if (slotKey === 'orchestration.scope.dataSource.scope_kind') return '请确认 scopeKind 为 dataSource'
  return '请补全数据源参数'
}

// Phase 5 S10 (#1111): scope.subStrategy render
function renderSubStrategyScope(params: Record<string, unknown>): string {
  const label = stringParam(params, 'subStrategyLabel', '') || stringParam(params, 'subStrategyId', '')
  if (label === '') return ''
  const positionHandling = stringParam(params, 'positionHandlingOnDeactivate', '')
  const orderHandling = stringParam(params, 'orderHandlingOnDeactivate', '')
  if (positionHandling !== '' && orderHandling !== '') {
    return renderDisplayToken('atom.scope.subStrategy.display.with_handling', {
      label,
      positionHandling,
      orderHandling,
    })
  }
  return renderDisplayToken('atom.scope.subStrategy.display.no_handling', { label })
}

function renderSubStrategyScopeClarification(slotKey: string): string {
  if (slotKey === 'orchestration.scope.subStrategy.scope_kind') return '请确认 scopeKind 为 subStrategy'
  if (slotKey === 'orchestration.scope.subStrategy.substrategy_id') return '请确认子策略 ID（非空且长度 ≤ 64）'
  if (slotKey === 'orchestration.scope.subStrategy.position_handling') return '请确认子策略切换时是否平仓（close/keep）'
  if (slotKey === 'orchestration.scope.subStrategy.order_handling') return '请确认子策略切换时是否取消挂单（cancel/keep）'
  if (slotKey === 'orchestration.scope.subStrategy.id_collision') return '多 scope 子策略 ID 必须唯一'
  if (slotKey === 'orchestration.scope.subStrategy.missing_binding') return '请确认该规则绑定到哪个 sub-strategy scope'
  return '请补全子策略范围参数'
}

// Phase 5 S10 (#1111): gate.subStrategy render
function renderSubStrategyGate(params: Record<string, unknown>): string {
  const effect = stringParam(params, 'effectWhenFalse', '')
  if (effect === 'pause_substrategy') {
    const label = stringParam(params, 'subStrategyScopeRef', '')
    return renderDisplayToken('atom.gate.subStrategy.pause', { label })
  }
  if (effect === 'switch_substrategy') {
    const toLabel = stringParam(params, 'toSubStrategyScopeRef', '')
    return renderDisplayToken('atom.gate.subStrategy.switch', { toLabel })
  }
  return ''
}

function renderSubStrategyGateClarification(slotKey: string): string {
  if (slotKey === 'orchestration.gate.subStrategy.scope_ref_unknown') return 'gate 引用的子策略 scope 未声明'
  if (slotKey === 'orchestration.gate.subStrategy.effect_phase_mismatch') return 'phase=subStrategy 仅支持 pause_substrategy / switch_substrategy'
  if (slotKey === 'orchestration.gate.subStrategy.switch_target_required') return 'switch_substrategy gate 必须指定切换目标 scope'
  if (slotKey === 'orchestration.gate.subStrategy.switch_target_self') return '切换目标不能与源 scope 相同'
  if (slotKey === 'orchestration.gate.subStrategy.active_when') return '请确认 gate 的判定条件'
  if (slotKey === 'orchestration.gate.unsupported_phase') return '当前不支持 phase=strategy 的 gate'
  if (slotKey === 'orchestration.gate.regime.effect_phase_mismatch') return 'phase=entry 仅支持 block_new_entries effect'
  return '请补全子策略 gate 参数'
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

// ── 纯函数：由 service 私有 ad-hoc renderer 迁移而来（Issue #1179）──

function renderCrossCondition(params: Record<string, unknown>, direction: '上穿' | '下穿'): string {
  const indicator = typeof params.indicator === 'string' ? params.indicator.trim().toLowerCase() : ''

  if (indicator === 'macd') {
    const fast = typeof params.fastPeriod === 'number' ? params.fastPeriod : 12
    const slow = typeof params.slowPeriod === 'number' ? params.slowPeriod : 26
    const signal = typeof params.signalPeriod === 'number' ? params.signalPeriod : 9
    return `MACD ${fast}/${slow}/${signal} ${direction === '上穿' ? '金叉' : '死叉'}`
  }

  if (indicator === 'rsi') {
    const period = typeof params.period === 'number' ? params.period : 14
    const value = typeof params.value === 'number' ? params.value : null
    return value === null ? `RSI${period} ${direction}阈值` : `RSI${period} ${direction} ${value}`
  }

  const label = indicator === 'ema' ? 'EMA' : 'MA'
  const fast = typeof params.fastPeriod === 'number' ? params.fastPeriod : null
  const slow = typeof params.slowPeriod === 'number' ? params.slowPeriod : null
  const fastLabel = fast === null ? `${label}短周期` : `${label}${fast}`
  const slowLabel = slow === null ? `${label}长周期` : `${label}${slow}`
  return `${fastLabel} ${direction} ${slowLabel}`
}

function renderBollingerTouchCondition(params: Record<string, unknown>, band: '上轨' | '下轨' | '中轨'): string {
  const period = typeof params.period === 'number' ? params.period : null
  const stdDev = typeof params.stdDev === 'number' ? params.stdDev : null
  if (period !== null && stdDev !== null) {
    return `触及布林带 ${period} 周期 ${stdDev} 倍标准差${band}`
  }
  return `触及 ${period === null ? '周期待补充' : `MA${period}`} 的布林带${band}`
}

function renderRollingExtremaBreakoutCondition(params: Record<string, unknown>): string {
  const extrema = typeof params.extrema === 'string' && params.extrema === 'low' ? 'low' : 'high'
  const lookbackBars = typeof params.lookbackBars === 'number' && Number.isFinite(params.lookbackBars)
    ? params.lookbackBars
    : null
  const lookbackText = lookbackBars === null ? '过去若干根 K 线' : `过去 ${lookbackBars} 根 K 线`
  const timeframe = typeof params.timeframe === 'string' && params.timeframe.trim().length > 0
    ? params.timeframe.trim()
    : ''
  const prefix = timeframe ? `${timeframe} ` : ''
  return extrema === 'low'
    ? `${prefix}跌破${lookbackText}最低价`
    : `${prefix}突破${lookbackText}最高价`
}

function renderRelativeVolumeCondition(params: Record<string, unknown>): string {
  const lookbackBars = typeof params.lookbackBars === 'number' && Number.isFinite(params.lookbackBars)
    ? params.lookbackBars
    : null
  const multiplier = typeof params.multiplier === 'number' && Number.isFinite(params.multiplier)
    ? params.multiplier
    : null
  if (lookbackBars === null || multiplier === null) {
    const event = typeof params.event === 'string' ? params.event : ''
    return event === 'spike' ? '成交量放大' : ''
  }
  const comparator = typeof params.comparator === 'string' ? params.comparator : ''
  const direction = comparator === 'lt' || comparator === 'lte' ? '低于' : '高于'
  const inclusive = comparator === 'gte' || comparator === 'lte' ? '或等于' : ''
  return `成交量${direction}${inclusive}过去 ${lookbackBars} 根均量的 ${multiplier} 倍`
}

function renderReboundConfirmationCondition(params: Record<string, unknown>): string {
  const definition = typeof params.definition === 'string' && params.definition.trim().length > 0
    ? params.definition.trim()
    : ''
  if (definition) return `反弹确认（${definition}）`

  const windowBars = typeof params.windowBars === 'number' && Number.isFinite(params.windowBars)
    ? params.windowBars
    : typeof params.nextBars === 'number' && Number.isFinite(params.nextBars)
      ? params.nextBars
      : null
  if (windowBars !== null) return `${windowBars} 根 K 线内反弹确认`
  return '反弹确认'
}

function renderSequenceCondition(params: Record<string, unknown>): string {
  const sequenceKind = typeof params.sequenceKind === 'string' ? params.sequenceKind : ''
  if (!sequenceKind) return ''

  const lookbackWindow = typeof params.lookbackWindow === 'string' && params.lookbackWindow.trim().length > 0
    ? `（${params.lookbackWindow.trim()} 内）`
    : typeof params.lookbackBars === 'number' && Number.isFinite(params.lookbackBars)
      ? `（${params.lookbackBars} 根 K 线内）`
      : ''
  const memoryKey = typeof params.memoryKey === 'string' && params.memoryKey.trim().length > 0
    ? `，记录位 ${params.memoryKey.trim()}`
    : ''

  if (sequenceKind === 'breakout_retest') {
    return `突破后回踩确认${lookbackWindow}${memoryKey}`
  }
  if (sequenceKind === 'pullback_reclaim') {
    const reference = params.reference
    let refText = '关键位'
    if (reference && typeof reference === 'object' && !Array.isArray(reference)) {
      const rec = reference as Record<string, unknown>
      const ind = typeof rec.indicator === 'string' ? rec.indicator.toUpperCase() : ''
      const period = typeof rec.period === 'number' && Number.isFinite(rec.period) ? rec.period : null
      if (ind) refText = `${ind}${period === null ? '' : period}`
    }
    return `回踩${refText}后重新站上${lookbackWindow}${memoryKey}`
  }
  if (sequenceKind === 'rsi_reclaim') {
    const threshold = typeof params.threshold === 'number' && Number.isFinite(params.threshold)
      ? params.threshold
      : null
    return `RSI 回落后重新站上${threshold === null ? '阈值' : ` ${threshold}`}${lookbackWindow}${memoryKey}`
  }
  if (sequenceKind === 'consecutive_candles') {
    const count = typeof params.count === 'number' && Number.isFinite(params.count) ? params.count : null
    const dir = typeof params.direction === 'string' && params.direction === 'down' ? '收跌' : '收涨'
    return `连续 ${count === null ? '多' : count} 根 K 线${dir}${lookbackWindow}${memoryKey}`
  }
  return `序列条件 ${sequenceKind}${lookbackWindow}${memoryKey}`
}

function renderLogicalAnyOfCondition(params: Record<string, unknown>): string {
  const items = Array.isArray(params.items) ? params.items : []
  const childTexts = items
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return ''
      const rec = item as Record<string, unknown>
      const key = typeof rec.key === 'string' ? rec.key : ''
      if (!key || key === 'logical.any_of') return ''
      const childParams = rec.params && typeof rec.params === 'object' && !Array.isArray(rec.params)
        ? rec.params as Record<string, unknown>
        : {}
      // 递归渲染子条件（仅支持 cross/bollinger/rsi 等简单情形，复杂嵌套退化为 publicName）
      return renderLogicalAnyOfItemCondition(key, childParams)
    })
    .filter(text => text.length > 0)
  return childTexts.length > 0 ? `任一条件：${childTexts.join(' 或 ')}` : ''
}

/**
 * price.detect.indicator_boundary の裸条件文案（Issue #1179）：
 *   字面对齐旧 formatIndicatorBoundaryTriggerSummary 的条件部分（不含 phase 前缀和 action 后缀）。
 *   bollinger → "触及布林带 20 周期 2 倍标准差下轨" 或 "收盘确认突破布林带 20 周期 2 倍标准差下轨"
 *   其他      → "触及 <name>下轨"
 */
function renderIndicatorBoundaryDetectCondition(params: Record<string, unknown>): string {
  const indicatorRaw = params.indicator
  if (!indicatorRaw || typeof indicatorRaw !== 'object' || Array.isArray(indicatorRaw)) return ''
  const indicatorObj = indicatorRaw as Record<string, unknown>
  const name = typeof indicatorObj.name === 'string' ? indicatorObj.name.trim().toLowerCase() : ''
  if (!name) return ''

  const boundaryRole = typeof params.boundaryRole === 'string' ? params.boundaryRole : ''
  const boundaryText = boundaryRole === 'upper' ? '上轨' : boundaryRole === 'lower' ? '下轨' : '中轨'
  const actionText = params.confirmationMode === 'close_confirm' ? '收盘确认突破' : '触及'

  if (name === 'bollinger') {
    const period = typeof indicatorObj.period === 'number' && Number.isFinite(indicatorObj.period) ? indicatorObj.period : undefined
    const stdDev = typeof indicatorObj.stdDev === 'number' && Number.isFinite(indicatorObj.stdDev) ? indicatorObj.stdDev : undefined
    let periodStdDev = ''
    if (period !== undefined && stdDev !== undefined) {
      periodStdDev = `${period} 周期 ${stdDev} 倍标准差`
    }
    else if (period !== undefined) {
      periodStdDev = `${period} 周期`
    }
    return `${actionText}布林带 ${periodStdDev}${boundaryText}`
  }

  return `${actionText}${name}${boundaryText}`
}

function renderLogicalAnyOfItemCondition(key: string, params: Record<string, unknown>): string {
  if (key === 'indicator.cross_over') return renderCrossCondition(params, '上穿')
  if (key === 'indicator.cross_under') return renderCrossCondition(params, '下穿')
  if (key === 'indicator.above') return renderIndicatorCompareCondition(params, 'above')
  if (key === 'indicator.below') return renderIndicatorCompareCondition(params, 'below')
  if (key === 'bollinger.touch_upper') return renderBollingerTouchCondition(params, '上轨')
  if (key === 'bollinger.touch_lower') return renderBollingerTouchCondition(params, '下轨')
  if (key === 'bollinger.touch_middle') return renderBollingerTouchCondition(params, '中轨')
  if (key === 'price.rolling_extrema_breakout') return renderRollingExtremaBreakoutCondition(params)
  if (key === 'volume.relative_average') return renderRelativeVolumeCondition(params)
  if (key === 'confirmation.rebound') return renderReboundConfirmationCondition(params)
  if (key === 'price.detect.indicator_boundary' || key === 'indicator.boundary_touch') {
    return renderIndicatorBoundaryDetectCondition(params)
  }
  if (key === 'oscillator.rsi_gte') {
    const period = typeof params.period === 'number' ? params.period : 14
    const value = typeof params.value === 'number' ? params.value : null
    return value !== null ? `RSI${period} 高于或等于 ${value}` : `RSI${period} 高于或等于阈值`
  }
  if (key === 'oscillator.rsi_lte') {
    const period = typeof params.period === 'number' ? params.period : 14
    const value = typeof params.value === 'number' ? params.value : null
    return value !== null ? `RSI${period} 低于或等于 ${value}` : `RSI${period} 低于或等于阈值`
  }
  return ''
}

function renderIndicatorCompareCondition(params: Record<string, unknown>, direction: 'above' | 'below'): string {
  const period = typeof params['reference.period'] === 'number'
    ? params['reference.period']
    : typeof params['reference.period'] === 'string'
      ? params['reference.period']
      : ''
  const indicator = typeof params.indicator === 'string' && params.indicator.trim().length > 0
    ? params.indicator.trim().toUpperCase()
    : 'MA'
  const reference = `${indicator}${period}`
  return direction === 'above'
    ? `价格在 ${reference} 上方`
    : `价格低于 ${reference}`
}
