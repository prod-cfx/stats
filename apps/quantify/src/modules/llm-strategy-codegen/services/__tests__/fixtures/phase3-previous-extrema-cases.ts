import type { AtomCoverageGoldenCase } from './atom-coverage-golden-cases'

// Phase 3 MVP — price.previous_extrema 升级为 supported_requires_slot 后的 5 个 corpus 用例。
// requiredParams 与 IR compiler `compileConditionAtom` 中 'price.previous_extrema' 分支严格对齐：
//   - kind: 'prev_high' | 'prev_low' | 'swing_high' | 'swing_low'
//   - lookback: 滚动窗口（>0 整数）
//   - memoryKey: contract 占位；缺失时由 semantic-state-normalization 仿 partial_take_profit 模式
//                以 hash 自动补齐（hash 输入仅引用 kind / lookback / sourceText，等价 trigger 复用同一 key）
// seed-extractor 当前给出的 params 仅含 reference / event，三键全缺，因此 readiness 路由到 open_slots。
const PREVIOUS_EXTREMA_OPEN_SLOTS = [
  'open_slot:price.previous_extrema.kind',
  'open_slot:price.previous_extrema.lookback',
  'open_slot:price.previous_extrema.memoryKey',
]

export const phase3PreviousExtremaCases: AtomCoverageGoldenCase[] = [
  {
    id: 'phase3-previous-extrema-001-prev-high-breakout-open-slots',
    name: 'phase3 previous extrema prev high breakout requires slots',
    message: 'OKX 合约 BTCUSDT 15m，前高突破买入，单笔 10%。',
    tags: ['breakout', 'position_lifecycle'],
    expectedAtoms: [
      { key: 'price.previous_extrema', category: 'trigger' },
      { key: 'open_long', category: 'action', minContractSubstrate: true },
      { key: 'position.fixed_pct', category: 'position', minContractSubstrate: true },
    ],
    expectedKeys: [
      'price.previous_extrema',
      'open_long',
      'position.fixed_pct',
      ...PREVIOUS_EXTREMA_OPEN_SLOTS,
    ],
    expectedRoute: 'open_slots',
    notes: 'Phase 3 MVP：seed extractor 暂未把"前高突破"自由文本解析为 kind/lookback/memoryKey 三键，路由到 open_slots。',
  },
  {
    id: 'phase3-previous-extrema-002-prev-low-and-swing-low-open-slots',
    name: 'phase3 previous extrema prev low requires slots',
    message: 'OKX 合约 BTCUSDT 15m，跌破前低卖出，单笔 10%。',
    tags: ['breakout', 'position_lifecycle'],
    expectedAtoms: [
      { key: 'price.previous_extrema', category: 'trigger' },
      { key: 'close_long', category: 'action', minContractSubstrate: true },
      { key: 'position.fixed_pct', category: 'position', minContractSubstrate: true },
    ],
    expectedKeys: [
      'price.previous_extrema',
      'close_long',
      'position.fixed_pct',
      ...PREVIOUS_EXTREMA_OPEN_SLOTS,
    ],
    expectedRoute: 'open_slots',
    notes: 'Phase 3 MVP：跌破前低同样落入 open_slots，等待补齐 swing_low / lookback / memoryKey 后才能进入 IR 编译。',
  },
  {
    id: 'phase3-previous-extrema-003-prev-high-low-combo-open-slots',
    name: 'phase3 previous extrema prev high low combo requires slots',
    message: 'OKX 合约 BTCUSDT 15m，前高突破买入，跌破前低卖出，单笔 10%。',
    tags: ['breakout', 'position_lifecycle'],
    expectedAtoms: [
      { key: 'price.previous_extrema', category: 'trigger' },
      { key: 'open_long', category: 'action', minContractSubstrate: true },
      { key: 'close_long', category: 'action', minContractSubstrate: true },
      { key: 'position.fixed_pct', category: 'position', minContractSubstrate: true },
    ],
    expectedKeys: [
      'price.previous_extrema',
      'open_long',
      'close_long',
      'position.fixed_pct',
      ...PREVIOUS_EXTREMA_OPEN_SLOTS,
    ],
    expectedRoute: 'open_slots',
    notes: 'Phase 3 MVP：前高 + 前低组合用例，readiness 仍要补齐 kind/lookback/memoryKey 三键。',
  },
  {
    id: 'phase3-previous-extrema-004-baseline-no-previous-extrema',
    name: 'phase3 previous extrema baseline single ma trend regression',
    message: 'OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，MA20 下穿 MA50 平多，单笔 10%。',
    tags: ['trend', 'position_lifecycle'],
    expectedAtoms: [
      { key: 'indicator.cross_over', category: 'trigger', minContractSubstrate: true },
      { key: 'indicator.cross_under', category: 'trigger', minContractSubstrate: true },
      { key: 'open_long', category: 'action', minContractSubstrate: true },
      { key: 'close_long', category: 'action', minContractSubstrate: true },
      { key: 'position.fixed_pct', category: 'position', minContractSubstrate: true },
    ],
    expectedKeys: [
      'indicator.cross_over',
      'indicator.cross_under',
      'open_long',
      'close_long',
      'position.fixed_pct',
    ],
    forbiddenKeys: ['price.previous_extrema'],
    expectedRoute: 'projection_gate',
    notes: 'Phase 3 MVP baseline regression：不含前高/前低语义的策略不应被错误识别为 price.previous_extrema。',
  },
]
