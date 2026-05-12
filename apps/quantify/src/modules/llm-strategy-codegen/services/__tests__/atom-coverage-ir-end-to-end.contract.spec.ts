/**
 * Wave 2 — 端到端 atom 覆盖契约（IR-compiler 层）
 *
 * 不变量：
 *   每个 registry 标 `supported_executable` 的 atom，最小 spec 喂入 IR-compiler 后必须
 *   留下"可观测痕迹"。痕迹定义见 collectIrTrace()。痕迹空 = ghost atom（registry 自称
 *   可执行但 IR-compiler 未识别 → 静默丢弃），归类为 ❌ uncovered。
 *
 * 与既有 `atom-coverage-contract.spec.ts` 的边界：
 *   - 既有契约走的是 NL 路径（utterance → seed-extractor），保证 atom 能被自然语言识别；
 *   - 本契约走 IR 路径（canonical spec → IR compiler），保证 atom 能落到可执行 IR。
 *   两者互不替代：NL 识别成功但 IR 漏分支 = 本契约能抓的 ghost atom 故障类型。
 *
 * 失败收集策略：
 *   测试本身不直接 fail 每个 atom，而是按 atom key 字典序产出实测 snapshot，与
 *   `atom-coverage-ir-end-to-end.snapshot.json` 严格比对（含 covered/uncovered/skipped
 *   分类和失败层）。新 atom 落地 → snapshot 变更；新 ghost 出现 → snapshot 变更，
 *   reviewer 立刻看见 diff。
 *
 *   失败层分类：
 *     - compile-throw   ：compile() 直接抛异常（IR 不存在）
 *     - silent-discard  ：compile() 通过但 IR 相比 baseline 无任何新增节点
 *     - skipped         ：当前模板无法构造（位置 atom / 需特殊 substrate 等）
 *
 * 不更新本契约的常见错误：
 *   - 用本契约去断言"atom 落到具体 ruleBlock id"——那是 atom 私有 spec 的工作，不是覆盖率门禁
 *   - 用本契约去断言 runtime evaluator 数值——参见 atomic-contract-backtest-runtime-parity.spec.ts
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type {
  CanonicalConditionAtom,
  CanonicalRuleAction,
  CanonicalRuleV2,
  CanonicalStrategySpecV2,
} from '../../types/canonical-strategy-spec'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'

const SNAPSHOT_PATH = join(__dirname, 'atom-coverage-ir-end-to-end.snapshot.json')

type CoverageStatus = 'covered' | 'uncovered' | 'skipped'
type FailureLayer = 'compile-throw' | 'silent-discard' | 'none'

interface AtomCoverageEntry {
  key: string
  category: 'trigger' | 'action' | 'risk' | 'position'
  status: CoverageStatus
  failureLayer: FailureLayer
  trace: string[]
  note?: string
}

interface AtomCoverageSnapshot {
  description: string
  generatedFromContractVersion: string
  atoms: AtomCoverageEntry[]
}

const CONTRACT_VERSION = 'wave2-1'

const BASE_FALLBACK = {
  exchange: 'binance' as const,
  symbol: 'BTCUSDT',
  baseTimeframe: '1m',
  positionPct: 10,
}

/**
 * Baseline spec：只有"close > open 开多 + 1 个 RATIO sizing"，不附加任何待测 atom。
 * 用于在 collectIrTrace 中产出 baseline 痕迹集合，后续与"baseline + atom"实测痕迹做差。
 */
function buildBaselineSpec(): CanonicalStrategySpecV2 {
  return {
    version: 2,
    market: {
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      defaultTimeframe: '1m',
    },
    indicators: [],
    sizing: { mode: 'RATIO', value: 0.1 },
    executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
    dataRequirements: { requiredTimeframes: ['1m'] },
    rules: [
      {
        id: 'baseline-entry',
        phase: 'entry',
        sideScope: 'long',
        priority: 200,
        condition: {
          kind: 'expression',
          op: 'GT',
          left: { kind: 'series', source: 'bar', field: 'close' },
          right: { kind: 'series', source: 'bar', field: 'open' },
        },
        actions: [{ type: 'OPEN_LONG' }],
      },
    ],
  } satisfies CanonicalStrategySpecV2
}

/**
 * 痕迹集合：把 IR 上所有可观测节点拍平成 string set。
 *   - `series:<kind>`
 *   - `predicate:<kind>`
 *   - `guard:<id>`
 *   - `guard.kind:<kind>`
 *   - `portfolio-risk:<id>`
 *   - `rule-block:<id>`
 *   - `rule-block-action:<kind>`
 *   - `orchestration-gate:<id>` / `orchestration-program:<id>`
 *   - `risk-predicate:<id>`
 *
 * baseline_only 之外的元素 = 这次 atom 注入"留下的可观测痕迹"。
 */
function collectIrTrace(ir: ReturnType<CanonicalSpecV2IrCompilerService['compile']>['ir']): Set<string> {
  const out = new Set<string>()
  for (const s of ir.signalCatalog?.series ?? []) {
    if (s.kind) out.add(`series:${s.kind}`)
  }
  for (const p of ir.signalCatalog?.predicates ?? []) {
    if (p.kind) out.add(`predicate:${p.kind}`)
  }
  for (const g of ir.riskPolicy?.guards ?? []) {
    if (g.id) out.add(`guard:${g.id}`)
    if (g.kind) out.add(`guard.kind:${g.kind}`)
  }
  for (const rp of ir.riskPolicy?.riskPredicates ?? []) {
    if (rp.id) out.add(`risk-predicate:${rp.id}`)
  }
  for (const pr of ir.orchestrationPortfolioRisks ?? []) {
    if (pr.id) out.add(`portfolio-risk:${pr.id}`)
  }
  for (const gate of ir.orchestrationGates ?? []) {
    if (gate.id) out.add(`orchestration-gate:${gate.id}`)
  }
  for (const prog of ir.orchestrationPrograms ?? []) {
    if (prog.id) out.add(`orchestration-program:${prog.id}`)
  }
  for (const rb of ir.ruleBlocks ?? []) {
    if (rb.id) out.add(`rule-block:${rb.id}`)
    for (const a of rb.actions ?? []) {
      if (a.kind) out.add(`rule-block-action:${a.kind}`)
    }
  }
  return out
}

/**
 * spec mutator：对 baseline spec 注入待测 atom，返回完整 spec。
 * 返回 null = 当前模板无法构造该 atom（skip）。
 */
type SpecMutation = (atomKey: string) => CanonicalStrategySpecV2 | null

const TRIGGER_GATE_RULE_ID = 'probe-gate-rule'
const TRIGGER_ENTRY_RULE_ID = 'probe-entry-rule'
const ACTION_RULE_ID = 'probe-action-rule'
const RISK_RULE_ID = 'probe-risk-rule'

/**
 * trigger atom：phase='gate' 是大多数 trigger atom 的标准注入位（command-injection）。
 * 不能用 gate 形式的 trigger atom 在下面 SPECIAL_TRIGGER_MUTATORS 单点覆盖。
 */
function mutateAsGateTrigger(atomKey: string, conditionParams: CanonicalConditionAtom['params'] = {}): CanonicalStrategySpecV2 {
  const spec = buildBaselineSpec()
  spec.rules.push({
    id: TRIGGER_GATE_RULE_ID,
    phase: 'gate',
    sideScope: 'both',
    priority: 100,
    condition: {
      kind: 'atom',
      key: atomKey,
      semanticScope: 'market',
      op: 'GT',
      value: 1,
      params: conditionParams,
    },
    actions: [{ type: 'BLOCK_NEW_ENTRY' }],
  })
  return spec
}

/**
 * action atom：以 entry rule action 的形式注入。actionType 由 atom key 映射。
 * 注：condition 借用 expression(close>open)，避免在 condition 层混入其它 atom 信号。
 */
function mutateAsAction(actionType: CanonicalRuleAction['type'], metadata?: CanonicalRuleV2['metadata']): CanonicalStrategySpecV2 {
  const spec = buildBaselineSpec()
  const sizing = (
    actionType === 'ADD_LONG' || actionType === 'ADD_SHORT'
      ? { mode: 'RATIO' as const, value: 20 }
      : undefined
  )
  spec.rules.push({
    id: ACTION_RULE_ID,
    phase: 'entry',
    sideScope: actionType === 'OPEN_SHORT' || actionType === 'CLOSE_SHORT' || actionType === 'REDUCE_SHORT' || actionType === 'ADD_SHORT' ? 'short' : 'long',
    priority: 150,
    condition: {
      kind: 'expression',
      op: 'GT',
      left: { kind: 'series', source: 'bar', field: 'close' },
      right: { kind: 'series', source: 'bar', field: 'open' },
    },
    actions: [
      sizing ? { type: actionType, sizing } : { type: actionType },
    ],
    metadata,
  })
  return spec
}

/**
 * risk atom（pct 类）：phase='risk' + condition.atom + FORCE_EXIT/REDUCE_*.
 */
function mutateAsRisk(atomKey: string, opts?: { semanticScope?: 'market' | 'position' | 'portfolio', op?: CanonicalConditionAtom['op'], value?: number, params?: CanonicalConditionAtom['params'], actionType?: CanonicalRuleAction['type'] }): CanonicalStrategySpecV2 {
  const spec = buildBaselineSpec()
  spec.rules.push({
    id: RISK_RULE_ID,
    phase: 'risk',
    sideScope: 'both',
    priority: 100,
    condition: {
      kind: 'atom',
      key: atomKey,
      semanticScope: opts?.semanticScope ?? 'position',
      op: opts?.op ?? 'GTE',
      value: opts?.value ?? 0.05,
      params: opts?.params,
    },
    actions: [{ type: opts?.actionType ?? 'FORCE_EXIT' }],
  })
  return spec
}

/**
 * trigger atom 注入策略表。默认走 mutateAsGateTrigger；
 * 个别 atom 因要求特殊 params/位置在此覆盖。
 */
const SPECIAL_TRIGGER_MUTATORS: Record<string, SpecMutation> = {
  // execution.on_start: 不是市场 trigger，注入位是 entry rule 的 condition slot。
  'execution.on_start': () => {
    const spec = buildBaselineSpec()
    spec.rules.push({
      id: TRIGGER_ENTRY_RULE_ID,
      phase: 'entry',
      sideScope: 'long',
      priority: 150,
      condition: {
        kind: 'atom',
        key: 'execution.on_start',
        semanticScope: 'market',
        op: 'EQ',
        value: 1,
        params: { timing: 'BAR_CLOSE', orderType: 'market', occurrence: 'once' },
      },
      actions: [{ type: 'OPEN_LONG' }],
    })
    return spec
  },
  // semantic.missing_entry_atom / semantic.missing_exit_atom: 占位 atom，由 builder
  // 在 spec 缺槽时插入；非由用户/LLM 直接喂入 — 走 skipped。
  'semantic.missing_entry_atom': () => null,
  'semantic.missing_exit_atom': () => null,
  // condition.expression: 不是 atom-shaped condition，它本身就是 expression kind。
  'condition.expression': () => null,
  // 'volume.threshold' phase-1 gate：需 metric 参数
  'volume.threshold': key => mutateAsGateTrigger(key, { metric: 'base_volume' }),
  // 'volatility.atr_threshold' phase-1 gate：需 period + thresholdUnit
  'volatility.atr_threshold': key => mutateAsGateTrigger(key, { period: 14, thresholdUnit: 'percent_of_close' }),
  // 'strategy.time_window' phase-1 gate：windows JSON + timezone
  'strategy.time_window': key => {
    const spec = buildBaselineSpec()
    spec.rules.push({
      id: TRIGGER_GATE_RULE_ID,
      phase: 'gate',
      sideScope: 'both',
      priority: 100,
      condition: {
        kind: 'atom',
        key,
        semanticScope: 'market',
        op: 'EQ',
        value: 1,
        params: { timezone: 'UTC', windows: JSON.stringify([{ start: '00:00', end: '23:59' }]) },
      },
      actions: [{ type: 'BLOCK_NEW_ENTRY' }],
    })
    return spec
  },
  // 'position.has_position' / 'position.no_position' phase-1 gate：semanticScope='position'
  'position.has_position': key => {
    const spec = buildBaselineSpec()
    spec.rules.push({
      id: TRIGGER_GATE_RULE_ID,
      phase: 'gate',
      sideScope: 'both',
      priority: 100,
      condition: { kind: 'atom', key, semanticScope: 'position', op: 'EQ', value: true },
      actions: [{ type: 'BLOCK_NEW_ENTRY' }],
    })
    return spec
  },
  'position.no_position': key => {
    const spec = buildBaselineSpec()
    spec.rules.push({
      id: TRIGGER_GATE_RULE_ID,
      phase: 'gate',
      sideScope: 'both',
      priority: 100,
      condition: { kind: 'atom', key, semanticScope: 'position', op: 'EQ', value: false },
      actions: [{ type: 'BLOCK_NEW_ENTRY' }],
    })
    return spec
  },
  // candle/chart pattern：需 pattern + direction
  'price.candle_pattern': key => mutateAsGateTrigger(key, { pattern: 'engulfing', direction: 'bullish' }),
  'price.chart_pattern': key => mutateAsGateTrigger(key, { pattern: 'double_bottom', direction: 'bullish' }),
  // indicator.divergence：需 indicator + direction
  'indicator.divergence': key => mutateAsGateTrigger(key, { indicator: 'rsi', direction: 'bullish', pivotWindow: 5, confirmationBars: 1 }),
  // liquidity.sweep
  'liquidity.sweep': key => mutateAsGateTrigger(key, { direction: 'bullish', reference: 'prev_low' }),
  // grid.* atoms 与 orderPrograms 绑定 — 不能裸用 condition.atom 探测，标 skip
  'grid.price_levels': () => null,
  'grid.fixed_range': () => null,
  'grid.range_rebalance': () => null,
  // condition.sequence 需要嵌套 children，超出本契约模板能力
  'condition.sequence': () => null,
  // logical.any_of 需要 children 数组
  'logical.any_of': () => null,
  // confirmation.rebound 需要前驱信号链路
  'confirmation.rebound': () => null,
}

/**
 * action atom → CanonicalRuleAction.type 映射。
 * registry 里的 action atom key 用 snake_case；ruleAction.type 用 SCREAMING_SNAKE。
 */
const ACTION_TYPE_MAP: Record<string, CanonicalRuleAction['type'] | null> = {
  'open_long': 'OPEN_LONG',
  'open_short': 'OPEN_SHORT',
  'close_long': 'CLOSE_LONG',
  'close_short': 'CLOSE_SHORT',
  'close_position': 'CLOSE_LONG', // alias — both close_long and close_short emit同口径
  'action.reduce_position': 'REDUCE_LONG',
  'reduce_long': 'REDUCE_LONG',
  'reduce_short': 'REDUCE_SHORT',
  'action.add_position': 'ADD_LONG',
  // action.reverse_position 形态不是单一 action — CLOSE+OPEN 组合 + metadata.reversePosition
  'action.reverse_position': null,
  // grid_ladder / place_limit_grid 是 orderProgram 配套 action，不走 CanonicalRuleAction
  'action.grid_ladder': null,
  'place_limit_grid': null,
}

const ACTION_SPECIAL_MUTATORS: Record<string, SpecMutation> = {
  'action.add_position': () => mutateAsAction('ADD_LONG', {
    addPosition: { stateKey: 'pyramiding_layer_count', addMode: 'signal_confirm', addRatio: 0.2, maxLayers: 3 },
  }),
  'action.reverse_position': () => {
    const spec = buildBaselineSpec()
    spec.rules.push({
      id: ACTION_RULE_ID,
      phase: 'exit',
      sideScope: 'long',
      priority: 150,
      condition: {
        kind: 'expression',
        op: 'LT',
        left: { kind: 'series', source: 'bar', field: 'close' },
        right: { kind: 'series', source: 'bar', field: 'open' },
      },
      actions: [
        { type: 'CLOSE_LONG' },
        { type: 'OPEN_SHORT' },
      ],
      metadata: {
        reversePosition: { fromSide: 'long', toSide: 'short', sameBarPolicy: 'next_bar_only', sizingSource: 'fixed' },
      },
    })
    return spec
  },
}

const RISK_SPECIAL_MUTATORS: Record<string, SpecMutation> = {
  // risk.max_drawdown_pct: semanticScope='portfolio'，value 是 fraction (>0 <1)
  'risk.max_drawdown_pct': key => mutateAsRisk(key, { semanticScope: 'portfolio', op: 'GTE', value: 0.15 }),
  // risk.cooldown_bars: IR compiler 无对应 case（真 ghost atom），直接走 condition_unsupported；无法通过补 params 修复
  'risk.cooldown_bars': key => mutateAsRisk(key, { semanticScope: 'position', op: 'GTE', value: 1, params: { bars: 3 } }),
  // risk.time_stop_bars: tryCompileRiskPredicate 要求 effect=close_position 才产出 RiskPredicateDef；
  //   effect=force_exit 时 return null → 规则走主循环 → compileConditionAtom default → throw；
  //   使用 close_position 确保走 RiskPredicate 路径，产出可观测痕迹
  'risk.time_stop_bars': key => mutateAsRisk(key, { semanticScope: 'position', op: 'GTE', value: 1, params: { maxBars: 10, scope: 'position', effect: 'close_position' } }),
  // risk.atr_multiple_stop/take_profit: tryCompileRiskPredicate 有对应 case，但需 params.multiple > 0
  'risk.atr_multiple_stop': key => mutateAsRisk(key, { semanticScope: 'position', op: 'GTE', value: 1, params: { multiple: 2 } }),
  'risk.atr_multiple_take_profit': key => mutateAsRisk(key, { semanticScope: 'position', op: 'GTE', value: 1, params: { multiple: 2 } }),
  // 这些 risk atom 不是 condition-shaped — 它们是 reduceAction-shape，需要专门 builder
  'risk.partial_take_profit': () => null,
  'risk.boundary_guard': () => null,
  'risk.protective_exit': () => null,
  'risk.condition_expression': () => null,
  'risk.stop_loss': () => null,
  'risk.take_profit': () => null,
  // remembered_level_stop / falling_knife_guard 需要外部 memory key 上下文
  'risk.remembered_level_stop': () => null,
}

/**
 * position atom 不通过 condition.atom 路径，而是通过 spec.sizing / spec.positionConstraints。
 * 本契约不直接构造 position atom 痕迹 — 标 skip，由 canonical-spec-builder/canonical-strategy-ast-compiler
 * 的现有 spec 覆盖；本契约保留位置以便未来扩展。
 */
const POSITION_ATOMS_SKIPPED_NOTE = 'position atom 通过 spec.sizing/positionConstraints 注入，与 condition.atom 模板正交；由 canonical-spec-builder spec 单独覆盖。'

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  try { return String(err) } catch { return 'unknown' }
}

function buildEntryForAtom(atomKey: string, category: AtomCoverageEntry['category']): { spec: CanonicalStrategySpecV2 | null, note?: string } {
  if (category === 'trigger') {
    const mutator = SPECIAL_TRIGGER_MUTATORS[atomKey]
    if (mutator) {
      const spec = mutator(atomKey)
      return spec ? { spec } : { spec: null, note: '当前模板无法以 condition.atom 形式独立注入；由专用 spec 覆盖' }
    }
    return { spec: mutateAsGateTrigger(atomKey) }
  }
  if (category === 'action') {
    const mutator = ACTION_SPECIAL_MUTATORS[atomKey]
    if (mutator) {
      const spec = mutator(atomKey)
      return spec ? { spec } : { spec: null, note: 'action atom 不映射到单一 CanonicalRuleAction.type' }
    }
    const actionType = ACTION_TYPE_MAP[atomKey]
    if (!actionType) {
      return { spec: null, note: 'action atom 不映射到单一 CanonicalRuleAction.type（orderProgram / 组合 action）' }
    }
    return { spec: mutateAsAction(actionType) }
  }
  if (category === 'risk') {
    const mutator = RISK_SPECIAL_MUTATORS[atomKey]
    if (mutator) {
      const spec = mutator(atomKey)
      return spec ? { spec } : { spec: null, note: 'risk atom 非 condition.atom 形态（reduceAction-shape 或 memory-bound）' }
    }
    // 默认走 pct 类 risk —— stop_loss_pct / take_profit_pct / trailing_stop_pct / max_single_loss_pct / atr_multiple_*
    return { spec: mutateAsRisk(atomKey, { semanticScope: 'position', op: 'GTE', value: 0.05 }) }
  }
  return { spec: null, note: POSITION_ATOMS_SKIPPED_NOTE }
}

function evaluateAtom(atomKey: string, category: AtomCoverageEntry['category']): AtomCoverageEntry {
  const { spec, note } = buildEntryForAtom(atomKey, category)
  if (spec === null) {
    return { key: atomKey, category, status: 'skipped', failureLayer: 'none', trace: [], note: note ?? '无法构造' }
  }

  const compiler = new CanonicalSpecV2IrCompilerService()

  let baselineTrace: Set<string>
  try {
    const baselineResult = compiler.compile({ canonicalSpec: buildBaselineSpec(), fallback: BASE_FALLBACK })
    baselineTrace = collectIrTrace(baselineResult.ir)
  } catch (err) {
    // baseline 本身挂掉说明 compiler 基础设施坏了 — 这是更大的回归，let 它一路抛
    throw new Error(`atom-coverage-contract baseline compile failed: ${describeError(err)}`)
  }

  try {
    const result = compiler.compile({ canonicalSpec: spec, fallback: BASE_FALLBACK })
    const fullTrace = collectIrTrace(result.ir)
    const delta = [...fullTrace].filter(t => !baselineTrace.has(t)).sort()
    if (delta.length === 0) {
      return { key: atomKey, category, status: 'uncovered', failureLayer: 'silent-discard', trace: [], note: 'compile 通过但 IR 无新增可观测节点（ghost atom 嫌疑）' }
    }
    return { key: atomKey, category, status: 'covered', failureLayer: 'none', trace: delta }
  } catch (err) {
    return { key: atomKey, category, status: 'uncovered', failureLayer: 'compile-throw', trace: [], note: describeError(err) }
  }
}

function loadSnapshot(): AtomCoverageSnapshot {
  const raw = readFileSync(SNAPSHOT_PATH, 'utf-8')
  return JSON.parse(raw) as AtomCoverageSnapshot
}

describe('atom coverage IR end-to-end contract (Wave 2)', () => {
  const registry = new SemanticAtomRegistryService()
  const executableAtoms = registry.list().filter(
    a => a.supportStatus === 'supported_executable',
  )

  it('registry 至少包含一个 supported_executable atom（避免空跑）', () => {
    expect(executableAtoms.length).toBeGreaterThan(0)
  })

  it('snapshot 与当前实测一致（按 atom key 字典序）', () => {
    const sorted = [...executableAtoms].sort((a, b) => a.key.localeCompare(b.key))
    const measured: AtomCoverageEntry[] = sorted.map(atom => evaluateAtom(atom.key, atom.category as AtomCoverageEntry['category']))

    // ATOM_COVERAGE_REGENERATE=1 模式：把实测结果直接写回 snapshot 文件，跳过断言。
    // 仅在新增 atom / 修 ghost atom / 调整契约模板时使用。CI/常规 dx test 严禁开启。
    // 硬约束：CI 环境（process.env.CI === 'true'）+ REGENERATE 同时打开 → 直接 fail，
    // 防止 CI pipeline 误用后门绕过覆盖回归。Review Round 1 M2 修复。
    if (process.env.ATOM_COVERAGE_REGENERATE === '1' && process.env.CI === 'true') {
      throw new Error('atom-coverage-ir-end-to-end: ATOM_COVERAGE_REGENERATE 禁止在 CI 环境启用')
    }
    if (process.env.ATOM_COVERAGE_REGENERATE === '1') {
      const regenerated: AtomCoverageSnapshot = {
        description: 'Wave 2 atom-coverage IR 端到端契约快照。每条记录 atom 在 IR-compiler 层的覆盖状态 + 失败层 + 痕迹集合。新 atom 落地或 ghost atom 修复 → 此文件应同步更新。',
        generatedFromContractVersion: CONTRACT_VERSION,
        atoms: measured,
      }
      writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(regenerated, null, 2)}\n`, 'utf-8')
      // eslint-disable-next-line no-console
      console.warn(`[atom-coverage-ir-end-to-end] snapshot regenerated: ${measured.length} atoms`)
      return
    }

    const snapshot = loadSnapshot()

    // 1) 集合一致：snapshot.atoms 的 key 集合 == measured 的 key 集合
    const measuredKeys = measured.map(m => m.key)
    const snapshotKeys = snapshot.atoms.map(s => s.key)
    expect(measuredKeys).toEqual(snapshotKeys)

    // 2) 逐项一致：对每个 atom 比较 status + failureLayer + trace 集合
    //    note 字段允许漂移（实现细节，错误消息可能微调）— 不参与断言。
    for (const m of measured) {
      const s = snapshot.atoms.find(item => item.key === m.key)
      expect(s).toBeDefined()
      expect({ key: m.key, status: m.status, failureLayer: m.failureLayer, trace: m.trace })
        .toEqual({ key: m.key, status: s!.status, failureLayer: s!.failureLayer, trace: s!.trace })
    }
  })

  it('snapshot 元数据完整且未漂移', () => {
    const snapshot = loadSnapshot()
    expect(snapshot.generatedFromContractVersion).toBe(CONTRACT_VERSION)
    expect(snapshot.description).toEqual(expect.any(String))
    expect(snapshot.atoms.length).toBeGreaterThan(0)
  })

  it('snapshot 统计可观察：covered / uncovered / skipped 数量打印为日志', () => {
    const snapshot = loadSnapshot()
    const counts = snapshot.atoms.reduce(
      (acc, a) => {
        acc[a.status] += 1
        return acc
      },
      { covered: 0, uncovered: 0, skipped: 0 } as Record<CoverageStatus, number>,
    )
    // eslint-disable-next-line no-console
    console.warn(`[atom-coverage-ir-end-to-end] covered=${counts.covered} uncovered=${counts.uncovered} skipped=${counts.skipped} total=${snapshot.atoms.length}`)
    // 不强制 uncovered=0 —— 本契约的价值是"暴露"，修复 ghost atom 走单独 PR；
    // 但 covered 数量必须 > 0，否则契约本身有问题。
    expect(counts.covered).toBeGreaterThan(0)
  })
})
