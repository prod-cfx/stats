/**
 * 31 条策略 golden harness fixture（Issue #1496 块 1）
 *
 * 数据源：
 *  - `user-five-strategy-entry-to-publication.spec.ts` 中 10 条用户实际反馈用例
 *  - `atom-coverage-golden-cases.ts` 顶部 `ATOMIC_CONTRACT_EXECUTION_UPGRADE_CASES` 9 条
 *  - `original-strategy-atomic-cases.ts`（"策略一/二/三/..." 与衍生 plain 用例）
 *
 * 策略编号 1..31 对应 #1491 父 Issue 验收表格里的 31 条策略；这里保留与父 Issue 同序。
 *
 * 阶段 A 期望（#1496 round-2 C-NEW-1 修复后，#1498 完成 #22/#23 翻 pass 后）：
 *  - pass: 29 条（registry / synth allowlist 内 atom 全覆盖的策略）。
 *  - unsupported: 2 条 — #16（#1497 范围）/ #25（#1499 范围）。harness 在首轮 seed 之前预检
 *    mock.semanticPatch.rules 全树叶子 atom，命中 `HARNESS_SYNTHESIZABLE_ATOM_KEYS ∪
 *    ATOM_CONTRACT_REGISTRY` 之外的 key 即视为 `unknown_atom:<key>` unsupported，
 *    与阶段 A 「unsupported 必须 fail-closed」承诺对齐，揭示生产 seed builder
 *    `dispatchAtomsByContractBucket` 对未识别 atom 仅 logger.warn 后丢弃的"伪 pass"。
 *  - 第 1 轮审查中被误标 unsupported 的 #17 / #18 / #30 / #31：实测 mock atom 全部
 *    落在 registry / synth allowlist（condition.sequence / position.dca_schedule /
 *    grid.range_rebalance / condition.expression 等都已识别），仍按 pass 收口；
 *    若阶段 B 加严识别（例如要求 grid.range_rebalance.activeWhen / position.dca_schedule
 *    interval slot 必填），会再次回到 unsupported，由 #1497/#1498/#1499 跟进。
 */

export interface ThirtyOneStrategyFixture {
  /** 1..31，与父 Issue #1491 的策略编号一一对应 */
  id: number
  /** 简短业务命名，便于报告检索 */
  name: string
  /** 用户原始描述（送入 nl-gateway 的入口字符串） */
  userInput: string
  /**
   * 顺序回放 readiness clarification 提问的答案；
   * 块 2 runner 与 readiness 服务联调时再细化具体顺序。
   * 默认 `[]` 表示当前预期不会触发任何澄清。
   */
  clarificationAnswers: string[]
  /** 期望出现在 rules tree / state buckets 中的核心 atom 集合 */
  expectedAtoms: Array<{ key: string; phase?: 'entry' | 'exit'; category: string }>
  /** 阶段 A 期望路由结论 */
  expectedRoute: 'pass' | { kind: 'unsupported'; reason: string }
  /** rules tree 顶层结构约束（不强制覆盖每条，留给块 3 报告器细化） */
  expectedRuleStructure?: {
    entryCount?: number
    exitCount?: number
    topLevelOp?: 'AND' | 'OR'
  }
  /** 关联到的子 Issue（用于报告归因） */
  affectedSubIssue?: 1497 | 1498 | 1499
  /** [GAP] userInput 来源未直接来自 issue 原文，需后续与产品确认 */
  isUserInputGap?: boolean
}

export const THIRTY_ONE_STRATEGIES: readonly ThirtyOneStrategyFixture[] = [
  {
    id: 1,
    name: 'OKX BTCUSDT perp 双向网格 60000-80000',
    userInput:
      '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'grid.range_rebalance', phase: 'entry', category: 'trigger' },
      { key: 'risk.stop_loss_pct', category: 'risk' },
      { key: 'risk.take_profit_pct', category: 'risk' },
    ],
    expectedRoute: 'pass',
    expectedRuleStructure: { entryCount: 1 },
  },
  {
    id: 2,
    name: 'EMA trend gate + BOLL trigger 双向开仓',
    userInput:
      '15min k线里面 价格在ema20 ema60 ema144上方时做多开仓 都位于下方只开空 入场是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损5%止损',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'indicator.above', phase: 'entry', category: 'trigger' },
      { key: 'indicator.below', phase: 'entry', category: 'trigger' },
      { key: 'bollinger.touch_lower', phase: 'entry', category: 'trigger' },
      { key: 'bollinger.touch_upper', phase: 'entry', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'open_short', category: 'action' },
    ],
    expectedRoute: 'pass',
    expectedRuleStructure: { entryCount: 2 },
  },
  {
    id: 3,
    name: 'EMA 多均线上方做多 + 跌破 EMA20 平多',
    userInput:
      '入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'indicator.above', phase: 'entry', category: 'trigger' },
      { key: 'indicator.below', phase: 'exit', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'close_long', category: 'action' },
    ],
    expectedRoute: 'pass',
    expectedRuleStructure: { topLevelOp: 'AND' },
  },
  {
    id: 4,
    name: 'BOLL 上/下/中轨双向 + 中轨平仓（不降级 internal boundary）',
    userInput:
      'OKX 合约 BTCUSDT 15m，价格触及/突破布林带(20,2)上轨时做空，触及/突破下轨时做多；多单在价格回到布林带中轨(MA20)时平仓，空单在价格跌破布林带中轨(MA20)时平仓；单笔仓位 10%。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'bollinger.touch_upper', phase: 'entry', category: 'trigger' },
      { key: 'bollinger.touch_lower', phase: 'entry', category: 'trigger' },
      { key: 'bollinger.touch_middle', phase: 'exit', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'open_short', category: 'action' },
    ],
    expectedRoute: 'pass',
  },
  {
    id: 5,
    name: 'RSI(14) ≤ 30 开多 + ATR 止损 + 分批止盈 + 回撤护栏',
    userInput:
      'ETH 永续，15 分钟。RSI(14) ≤ 30 时开多，仓位的 2% ATR 作为止损，达到 3% 利润分批止盈一半；任何时刻账户回撤超过 10% 暂停开新仓。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'oscillator.rsi_lte', phase: 'entry', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'risk.partial_take_profit', category: 'risk' },
      { key: 'portfolioRisk.drawdown_block', category: 'orchestration' },
    ],
    expectedRoute: 'pass',
  },
  {
    id: 6,
    name: 'EMA 多均线上方/下方 双向 + BOLL 触轨入场',
    userInput:
      '15min k线里面 价格在ema20 ema60 ema144上方时做多开仓 都位于下方只开空 入场是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损5%止损',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'indicator.above', phase: 'entry', category: 'trigger' },
      { key: 'bollinger.touch_lower', phase: 'entry', category: 'trigger' },
      { key: 'bollinger.touch_upper', phase: 'entry', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'open_short', category: 'action' },
    ],
    expectedRoute: 'pass',
    // #1496-m4: 与 #2 共享同一段 userInput 是 #1491 父 Issue 表格里的并列编号——
    //   #2 验收角度落在「EMA gate（above/below）+ BOLL trigger 双向开仓」的多周期 EMA 栈，
    //   #6 验收角度落在「EMA(20) + BOLL 触轨」的最小双向组合（expectedAtoms 仅 EMA20，不含
    //   EMA60/EMA144）。同源 userInput 但 expectedAtoms / expectedRuleStructure 不同，
    //   不合并；待与产品确认是否拆出更精细的差异化文本时去掉本注释。
    isUserInputGap: true,
  },
  {
    id: 7,
    name: 'OKX BTCUSDT perp 15m BOLL 双向 + 中轨平仓（publishable）',
    userInput:
      'OKX 合约 BTCUSDT 15m，价格触及/突破布林带(20,2)上轨时做空，触及/突破下轨时做多；多单在价格回到布林带中轨(MA20)时平仓，空单在价格跌破布林带中轨(MA20)时平仓；单笔仓位 10%。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'bollinger.touch_upper', phase: 'entry', category: 'trigger' },
      { key: 'bollinger.touch_lower', phase: 'entry', category: 'trigger' },
      { key: 'bollinger.touch_middle', phase: 'exit', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'open_short', category: 'action' },
      { key: 'close_long', category: 'action' },
      { key: 'close_short', category: 'action' },
    ],
    expectedRoute: 'pass',
  },
  {
    id: 8,
    name: '阳线开多 / 阴线平多（candle pattern）',
    userInput:
      'binance 永续 BTCUSDT 1m K 线。每次最新 K 线收盘价高于开盘价时尝试开多。如果已有持仓则不再开仓。收盘价低于开盘价时平多。单笔仓位 10%。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'condition.expression', phase: 'entry', category: 'trigger' },
      { key: 'condition.expression', phase: 'exit', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'close_long', category: 'action' },
    ],
    expectedRoute: 'pass',
  },
  {
    id: 9,
    name: 'EMA7 上穿 EMA21 + 下穿平多（publishable）',
    userInput: 'binance 永续 BTCUSDT 15m。EMA7 上穿 EMA21 时开多；下穿 时平多。单笔仓位 10%。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'indicator.cross_over', phase: 'entry', category: 'trigger' },
      { key: 'indicator.cross_under', phase: 'exit', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'close_long', category: 'action' },
    ],
    expectedRoute: 'pass',
  },
  {
    id: 10,
    name: 'OKX 现货 ETHUSDT 1m centered grid（部署时当前价为中心）',
    userInput:
      'OKX 现货 ETHUSDT、1m 网格以部署时当前价为中心，上下各0.4%共10格、每格10 USDT、限价单并相邻网格自动挂反向单、不用趋势信号开仓；当价格突破上下边界时执行"立即停止并撤销所有未成交订单"',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'grid.range_rebalance', phase: 'entry', category: 'trigger' },
    ],
    expectedRoute: 'pass',
  },
  {
    id: 11,
    name: 'OKX 现货 ORDI/USDT 1h 立即市价开多 + 涨跌幅止盈止损',
    userInput:
      '在 OKX 现货 ORDI/USDT 上，主周期 1h，使用 10% 固定仓位只做多；入场动作为立即开始时市价买入；出场规则为价格相对前收盘上涨 1% 时卖出，另有相对入场均价下跌 5% 止损卖出、相对入场均价上涨 10% 止盈卖出。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'execution.on_start', phase: 'entry', category: 'trigger' },
      { key: 'price.percent_change', phase: 'exit', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'close_long', category: 'action' },
    ],
    expectedRoute: 'pass',
  },
  {
    id: 12,
    name: 'BOLL 简写：下轨买入 / 上轨卖出（15min）',
    userInput: '15min 布林带下轨买入 上轨卖出',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'bollinger.touch_lower', phase: 'entry', category: 'trigger' },
      { key: 'bollinger.touch_upper', phase: 'exit', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'close_long', category: 'action' },
    ],
    expectedRoute: 'pass',
    // TODO(#1496): plain 简写体，issue 原文未提供完整版本；当前用 plain-bollinger-15m 顶替
    isUserInputGap: true,
  },
  {
    id: 13,
    name: 'OKX BTC/USDT 1h MACD 金叉买入 / 死叉卖出',
    userInput: 'OKX 上用 BTC/USDT，1 小时 K，MACD 金叉买入死叉卖出',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'indicator.cross_over', phase: 'entry', category: 'trigger' },
      { key: 'indicator.cross_under', phase: 'exit', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'close_long', category: 'action' },
    ],
    expectedRoute: 'pass',
  },
  {
    id: 14,
    name: 'OKX BTCUSDT perp 15m EMA7/EMA21 cross + cross margin',
    userInput:
      '创建一个 OKX BTCUSDT 永续合约策略，使用 15 分钟 K 线。当 EMA7 上穿 EMA21 时开多；当 EMA7 下穿 EMA21 时平多。每次使用账户权益的 10% 开仓，杠杆 1 倍，逐仓不要使用，使用全仓 cross。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'indicator.cross_over', phase: 'entry', category: 'trigger' },
      { key: 'indicator.cross_under', phase: 'exit', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'close_long', category: 'action' },
    ],
    expectedRoute: 'pass',
  },
  {
    id: 15,
    name: 'OKX BTCUSDT perp 15m 双向网格 79200-80200',
    userInput:
      '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 79200-80200，采用双向网格，每格间距 0.1%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'grid.range_rebalance', phase: 'entry', category: 'trigger' },
      { key: 'risk.stop_loss_pct', category: 'risk' },
      { key: 'risk.take_profit_pct', category: 'risk' },
    ],
    expectedRoute: 'pass',
  },
  {
    id: 16,
    name: 'BTC 4h rolling extrema breakout 出场',
    userInput: 'BTC 4小时突破过去 20 根 K 线最高价做多，跌破过去 10 根 K 线最低价平仓。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'price.rolling_extrema_breakout', phase: 'entry', category: 'trigger' },
      { key: 'price.rolling_extrema_breakout', phase: 'exit', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'close_long', category: 'action' },
    ],
    expectedRoute: 'pass',
  },
  {
    id: 17,
    name: 'ETH 日线 MA120 上方 + 回踩 MA20 重新站上买入',
    userInput: 'ETH 日线在 MA120 上方时，只做多；价格回踩 MA20 后重新站上 MA20 买入。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'condition.expression', phase: 'entry', category: 'trigger' },
      { key: 'condition.sequence', phase: 'entry', category: 'trigger' },
      { key: 'open_long', category: 'action' },
    ],
    expectedRoute: 'pass',
    affectedSubIssue: 1498,
  },
  {
    id: 18,
    name: 'BTC 连跌三根 15m + 下一根放量反弹买入',
    userInput: 'BTC 连续跌三根 15 分钟 K 线后，如果下一根开始放量反弹就买一点。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'condition.sequence', phase: 'entry', category: 'trigger' },
      { key: 'volume.relative_average', phase: 'entry', category: 'trigger' },
      { key: 'open_long', category: 'action' },
    ],
    expectedRoute: 'pass',
    affectedSubIssue: 1498,
  },
  {
    id: 19,
    name: 'BTC 1h MA50>MA200 + RSI 跌破 35 后重新上穿 35 买入 / RSI≥65 卖出',
    userInput: 'BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入，RSI 超过 65 卖出。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'condition.expression', phase: 'entry', category: 'trigger' },
      { key: 'condition.sequence', phase: 'entry', category: 'trigger' },
      { key: 'oscillator.rsi_gte', phase: 'exit', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'close_long', category: 'action' },
    ],
    expectedRoute: 'pass',
    expectedRuleStructure: { topLevelOp: 'AND' },
  },
  {
    id: 20,
    name: 'ETH 15m BOLL 下轨 AND 量价放大买入 / 上轨卖出',
    userInput: 'ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'price.detect.indicator_boundary', phase: 'entry', category: 'trigger' },
      { key: 'volume.relative_average', phase: 'entry', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'close_long', category: 'action' },
    ],
    expectedRoute: 'pass',
    expectedRuleStructure: { topLevelOp: 'AND' },
  },
  {
    id: 21,
    name: 'SOL 30m MA100 + MACD 金叉买入 / 跌破 MA100 OR 死叉卖出',
    userInput: 'SOL 30分钟价格在 MA100 上方，MACD 金叉买入；跌破 MA100 或 MACD 死叉卖出。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'indicator.above', phase: 'entry', category: 'trigger' },
      { key: 'indicator.cross_over', phase: 'entry', category: 'trigger' },
      { key: 'indicator.below', phase: 'exit', category: 'trigger' },
      { key: 'indicator.cross_under', phase: 'exit', category: 'trigger' },
      { key: 'logical.any_of', phase: 'exit', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'close_long', category: 'action' },
    ],
    expectedRoute: 'pass',
    expectedRuleStructure: { topLevelOp: 'OR' },
  },
  {
    id: 22,
    name: 'BTC 突破 24h 高点后等回踩 + remembered level stop',
    userInput: 'BTC 突破过去 24 小时高点后不立刻买，等回踩不破突破位再买，跌回突破位下方止损。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'condition.sequence', phase: 'entry', category: 'trigger' },
      { key: 'risk.remembered_level_stop', category: 'risk' },
      { key: 'open_long', category: 'action' },
    ],
    expectedRoute: 'pass',
  },
  {
    id: 23,
    name: 'ETH 1h 突破 MA20 + 2x ATR 止损 / 3x ATR 止盈',
    userInput: 'ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'indicator.cross_over', phase: 'entry', category: 'trigger' },
      { key: 'risk.atr_multiple_stop', category: 'risk' },
      { key: 'risk.atr_multiple_take_profit', category: 'risk' },
      { key: 'open_long', category: 'action' },
    ],
    expectedRoute: 'pass',
  },
  {
    id: 24,
    name: 'binance BTCUSDT perp 多周期 EMA20 上方买入 / 15m 跌破卖出',
    userInput: '15min 1h 4h的价格都在ema20的上方买入 15min跌破ema20卖出 再币安交易所 btcusdt永续合约',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'indicator.above', phase: 'entry', category: 'trigger' },
      { key: 'indicator.below', phase: 'exit', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'close_long', category: 'action' },
    ],
    expectedRoute: 'pass',
    expectedRuleStructure: { topLevelOp: 'AND', exitCount: 1 },
  },
  {
    id: 25,
    name: 'Webhook 外部信号 binding（secret + signalId）',
    // TODO(#1496): issue 原文未提供 webhook 标准描述，先用合成描述占位，块 2 联调时与产品对齐
    userInput:
      '接入外部 webhook 信号 entry-long 时开多，外部信号 exit-long 时平多；webhook 共享 signalId 与 secret，币安 BTCUSDT 永续 15m，仓位 10%。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'external_signal', phase: 'entry', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'close_long', category: 'action' },
    ],
    // #1499：mock atom key 之前用下划线 `external_signal`（registry 实际注册名是
    //   `external.signal`），导致 harness unknown_atom 预检拒绝 → 表面 unsupported。
    //   修正 key 后 codegen 链路（registry / canonical_spec / IR / AST emit）全部正常，
    //   #25 真实落 pass。
    //   ⚠️ 仍未实装的是 **webhook runtime 基建**（webhook ingestion endpoint、HMAC 校验、
    //   signal queue、IR predicate runtime evaluator），与 codegen 不在同一层；该缺口
    //   由 follow-up issue 跟踪（fixtures/external-signal.example.ts:9-12 显式承认）。
    //   即：本 fixture 的 'pass' 仅覆盖 codegen 路由，不代表生产 runtime 可执行。
    expectedRoute: 'pass',
    affectedSubIssue: 1499,
    isUserInputGap: true,
  },
  {
    id: 26,
    name: 'RSI 跌破阈值入场 / 回到阈值出场',
    // TODO(#1496): issue 原文未提供完整 RSI 阈值策略描述；这里合成一个最小可识别版本
    userInput:
      'binance BTCUSDT 永续 15m。RSI(14) 跌破 30 时开多，回到 50 上方平多；单笔仓位 10%，止损 5%。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'oscillator.rsi_lte', phase: 'entry', category: 'trigger' },
      { key: 'oscillator.rsi_gte', phase: 'exit', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'close_long', category: 'action' },
    ],
    expectedRoute: 'pass',
    isUserInputGap: true,
  },
  {
    id: 27,
    name: 'OKX BTCUSDT perp 1m BOLL(5,1) 双向 + 中轨平仓 + 紧 SL/TP',
    userInput:
      'OKX 合约 BTCUSDT 1m，使用布林带 5,1。价格触及或突破上轨时做空，价格触及或突破下轨时做多；多单在价格回到中轨时平仓，空单在价格回到中轨时平仓；单笔仓位 10%，止损 1%，止盈 1.5%。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'bollinger.touch_upper', phase: 'entry', category: 'trigger' },
      { key: 'bollinger.touch_lower', phase: 'entry', category: 'trigger' },
      { key: 'bollinger.touch_middle', phase: 'exit', category: 'trigger' },
      { key: 'open_long', category: 'action' },
      { key: 'open_short', category: 'action' },
      { key: 'close_long', category: 'action' },
      { key: 'close_short', category: 'action' },
    ],
    expectedRoute: 'pass',
  },
  {
    id: 28,
    name: '账户回撤超过 10% 暂停开新仓（portfolioRisk.drawdown_block）',
    userInput:
      'ETH 永续，15 分钟。RSI(14) ≤ 30 时开多，仓位的 2% ATR 作为止损，达到 3% 利润分批止盈一半；任何时刻账户回撤超过 10% 暂停开新仓。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'portfolioRisk.drawdown_block', category: 'orchestration' },
      { key: 'oscillator.rsi_lte', phase: 'entry', category: 'trigger' },
      { key: 'open_long', category: 'action' },
    ],
    expectedRoute: 'pass',
  },
  {
    id: 29,
    name: 'BTC 回踩 MA20 不破后加仓 + pyramiding limit',
    userInput: 'BTC 回踩 MA20 不破后加仓，每次加仓 20%，最多加仓 3 次。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'condition.sequence', phase: 'entry', category: 'trigger' },
      { key: 'action.add_position', category: 'action' },
      { key: 'position.pyramiding_limit', category: 'position' },
    ],
    expectedRoute: 'pass',
  },
  {
    id: 30,
    name: 'DCA 定投 + 回撤加投 overlay',
    // TODO(#1496): issue 原文未给完整文本，这里合成一段最小描述触发 DCA + drawdown overlay
    userInput:
      'BTC 现货定投策略：每周一定投 100 USDT；当账户回撤超过 10% 时额外加投一次 200 USDT；总投入不超过 2000 USDT。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'position.dca_schedule', category: 'position' },
      { key: 'portfolioRisk.drawdown_block', category: 'orchestration' },
    ],
    expectedRoute: 'pass',
    affectedSubIssue: 1499,
    isUserInputGap: true,
  },
  {
    id: 31,
    name: '自适应网格（range quantile gate + activeWhen + 停网平仓）',
    // TODO(#1496): issue 原文未给完整文本；合成一段触发 adaptive_grid 编排原子
    userInput:
      'BTCUSDT 永续 15m。当最近 4 小时价格落入区间分位 [0.2, 0.8] 时启用网格；区间内 1% 步长双向挂网；价格离开区间时停止网格并平掉所有仓位。',
    clarificationAnswers: [],
    expectedAtoms: [
      { key: 'grid.range_rebalance', phase: 'entry', category: 'trigger' },
    ],
    // TODO(#1497) 阶段 A 期望 range quantile gate / activeWhen 未实装；当前 dispatcher fallback 把它当作普通网格 pass
    expectedRoute: 'pass',
    affectedSubIssue: 1499,
    isUserInputGap: true,
  },
] as const

// 编号唯一性 + 数量校验（避免后续 review 阶段静默漏条）
{
  const ids = THIRTY_ONE_STRATEGIES.map(item => item.id)
  if (ids.length !== 31) {
    throw new Error(`[thirty-one-strategies] expected 31 entries, got ${ids.length}`)
  }
  const uniq = new Set(ids)
  if (uniq.size !== 31) {
    throw new Error(`[thirty-one-strategies] duplicate ids found: ${ids.join(',')}`)
  }
  for (let i = 1; i <= 31; i += 1) {
    if (!uniq.has(i)) {
      throw new Error(`[thirty-one-strategies] missing strategy id ${i}`)
    }
  }
}
