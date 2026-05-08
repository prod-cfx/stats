import type { AtomCoverageGoldenCase } from './atom-coverage-golden-cases'

// 5 个 open_slot 与 IR compiler compilePhase1GateAtom() strategy.multi_timeframe 分支
// 解构的 5 键严格对齐：htfTimeframe / htfIndicator / htfPeriod / htfOp / htfRhs。
// htfCondition 自由文本未来由 seed-extractor 解析为这 5 键再注入；不再作为 required slot。
const MTF_OPEN_SLOTS = [
  'open_slot:strategy.multi_timeframe.htfTimeframe',
  'open_slot:strategy.multi_timeframe.htfIndicator',
  'open_slot:strategy.multi_timeframe.htfPeriod',
  'open_slot:strategy.multi_timeframe.htfOp',
  'open_slot:strategy.multi_timeframe.htfRhs',
]

export const phase3MtfCases: AtomCoverageGoldenCase[] = [
  {
    id: 'phase3-mtf-001-htf-ma-filter-with-ltf-cross-open-slots',
    name: 'phase3 mtf htf ma filter with ltf cross requires slots',
    message: 'OKX 合约 BTCUSDT 15m，多周期过滤：先看 4h 收盘在 MA50 上方，再用 15m MA20 上穿 MA50 开多，单笔 10%。',
    tags: ['trend', 'multi_timeframe', 'orchestration', 'position_lifecycle'],
    expectedAtoms: [
      { key: 'strategy.multi_timeframe', category: 'trigger' },
      { key: 'indicator.cross_over', category: 'trigger', minContractSubstrate: true },
      { key: 'open_long', category: 'action', minContractSubstrate: true },
      { key: 'position.fixed_pct', category: 'position', minContractSubstrate: true },
    ],
    expectedKeys: [
      'strategy.multi_timeframe',
      'indicator.cross_over',
      'open_long',
      'position.fixed_pct',
      ...MTF_OPEN_SLOTS,
    ],
    expectedRoute: 'open_slots',
    notes: 'Phase 3 MVP：seed extractor 暂未把自由文本解析为 5 个解构键，路由到 open_slots。',
  },
  {
    id: 'phase3-mtf-002-htf-rsi-filter-with-ltf-reclaim-open-slots',
    name: 'phase3 mtf htf rsi filter with ltf reclaim requires slots',
    message: 'OKX 合约 BTCUSDT 15m，多周期过滤：先看 4h RSI 低于 30 才允许做多，价格回踩 MA20 站上后开多，单笔 10%。',
    tags: ['mean_reversion', 'multi_timeframe', 'orchestration', 'position_lifecycle'],
    expectedAtoms: [
      { key: 'strategy.multi_timeframe', category: 'trigger' },
      { key: 'open_long', category: 'action', minContractSubstrate: true },
      { key: 'position.fixed_pct', category: 'position', minContractSubstrate: true },
    ],
    expectedKeys: [
      'strategy.multi_timeframe',
      'open_long',
      'position.fixed_pct',
      ...MTF_OPEN_SLOTS,
    ],
    expectedRoute: 'open_slots',
    notes: 'Phase 3 MVP：HTF RSI 阈值类提示同样路由到 open_slots，等待 seed-extractor / 用户答辩补齐 5 键。',
  },
  {
    id: 'phase3-mtf-003-missing-htf-timeframe-open-slots',
    name: 'phase3 mtf missing htf timeframe requires slots',
    message: 'OKX 合约 BTCUSDT 15m，多周期过滤后做多：15m MA20 上穿 MA50 开多，单笔 10%。',
    tags: ['multi_timeframe', 'orchestration', 'position_lifecycle'],
    expectedAtoms: [
      { key: 'strategy.multi_timeframe', category: 'trigger' },
      { key: 'indicator.cross_over', category: 'trigger', minContractSubstrate: true },
    ],
    expectedKeys: [
      'strategy.multi_timeframe',
      ...MTF_OPEN_SLOTS,
    ],
    expectedRoute: 'open_slots',
    notes: 'Phase 3 MVP：未给出具体 HTF 周期，5 键 open slots 全部待答辩。',
  },
  {
    id: 'phase3-mtf-004-missing-htf-condition-open-slots',
    name: 'phase3 mtf missing htf condition requires slots',
    message: 'OKX 合约 BTCUSDT 15m，多周期过滤：先看 4h 趋势，再用 15m MA20 上穿 MA50 开多，单笔 10%。',
    tags: ['multi_timeframe', 'orchestration', 'position_lifecycle'],
    expectedAtoms: [
      { key: 'strategy.multi_timeframe', category: 'trigger' },
      { key: 'indicator.cross_over', category: 'trigger', minContractSubstrate: true },
    ],
    expectedKeys: [
      'strategy.multi_timeframe',
      ...MTF_OPEN_SLOTS,
    ],
    expectedRoute: 'open_slots',
    notes: 'Phase 3 MVP：未给出 HTF 判定条件，5 键 open slots 必须包含 htfIndicator/htfPeriod/htfOp/htfRhs。',
  },
  {
    id: 'phase3-mtf-005-single-timeframe-baseline-regression',
    name: 'phase3 mtf single timeframe baseline regression',
    message: 'OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，5% 止损，10% 止盈，单笔 10%。',
    tags: ['trend', 'position_lifecycle'],
    expectedAtoms: [
      { key: 'indicator.cross_over', category: 'trigger', minContractSubstrate: true },
      { key: 'open_long', category: 'action', minContractSubstrate: true },
      { key: 'position.fixed_pct', category: 'position', minContractSubstrate: true },
      { key: 'risk.stop_loss_pct', category: 'risk', minContractSubstrate: true },
      { key: 'risk.take_profit_pct', category: 'risk', minContractSubstrate: true },
    ],
    expectedKeys: [
      'indicator.cross_over',
      'open_long',
      'position.fixed_pct',
      'risk.stop_loss_pct',
      'risk.take_profit_pct',
    ],
    forbiddenKeys: ['strategy.multi_timeframe'],
    expectedRoute: 'projection_gate',
    // 不含 multi_timeframe trigger 的 baseline regression：确认单周期识别不会被 phase 3 改动污染。
    notes: 'Phase 3 MVP baseline regression：单周期策略不含 multi_timeframe trigger，专门用于回归保护。',
  },
]
