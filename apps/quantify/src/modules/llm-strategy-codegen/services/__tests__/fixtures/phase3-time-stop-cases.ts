import type { AtomCoverageGoldenCase } from './atom-coverage-golden-cases'

// Phase 3 MVP — risk.time_stop_bars 升级为 supported_executable atom 后的 corpus 用例草稿。
// 当前 seed-extractor 暂未把"持仓 N 根 K 线后市价平仓"自由文本解析为
// { maxBars / scope / effect } 三键，这些用例先以 fixture 形式存档，等待
// PR #1008 / #1011 合入 main 后再做联调 corpus（multi_timeframe + previous_extrema +
// time_stop 三能力组合），届时 expectedRoute 会按实际抽取结果调整。
export const phase3TimeStopCases: AtomCoverageGoldenCase[] = [
  {
    id: 'phase3-time-stop-bars-001-close-position-fully-specified',
    name: 'phase3 time stop bars close position fully specified',
    message: 'OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，持仓 10 根 K 线后市价平仓，单笔 10%。',
    tags: ['risk', 'trend', 'position_lifecycle'],
    expectedAtoms: [
      { key: 'indicator.cross_over', category: 'trigger' },
      { key: 'risk.time_stop_bars', category: 'risk' },
      { key: 'open_long', category: 'action' },
    ],
    expectedKeys: [
      'indicator.cross_over',
      'risk.time_stop_bars',
      'open_long',
    ],
    expectedRoute: 'open_slots',
    notes: 'Phase 3 MVP：seed extractor 暂未抽取 maxBars / scope / effect，路由到 open_slots，等待联调 corpus 阶段补全。',
  },
  {
    id: 'phase3-time-stop-bars-002-reduce-position-missing-reduce-pct',
    name: 'phase3 time stop bars reduce position missing reduce pct',
    message: 'OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，持仓 10 根 K 线后减仓，单笔 10%。',
    tags: ['risk', 'trend', 'position_lifecycle'],
    expectedAtoms: [
      { key: 'indicator.cross_over', category: 'trigger' },
      { key: 'risk.time_stop_bars', category: 'risk' },
    ],
    expectedKeys: [
      'indicator.cross_over',
      'risk.time_stop_bars',
    ],
    expectedRoute: 'open_slots',
    notes: 'Phase 3 MVP：effect=reduce_position 缺 reducePct，IR compiler 不编出 RISK_RULE，readiness 应保持 supported_requires_slot。',
  },
  {
    id: 'phase3-time-stop-bars-003-invalid-max-bars-zero',
    name: 'phase3 time stop bars invalid max bars zero',
    message: 'OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，持仓 0 根 K 线后市价平仓，单笔 10%。',
    tags: ['risk', 'trend', 'position_lifecycle'],
    expectedAtoms: [
      { key: 'indicator.cross_over', category: 'trigger' },
      { key: 'risk.time_stop_bars', category: 'risk' },
    ],
    expectedKeys: [
      'indicator.cross_over',
      'risk.time_stop_bars',
    ],
    expectedRoute: 'open_slots',
    notes: 'Phase 3 MVP：maxBars=0 非法，IR compiler fail-closed 不编出 RISK_RULE，readiness 保持 supported_requires_slot。',
  },
]
