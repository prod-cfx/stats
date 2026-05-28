/**
 * Issue #1383 Lane A — Invariant：atom 自声明的 fulfillsStrategyPhase 必须与
 * SemanticExecutableSemanticsService 的判定结果一一对应。
 *
 * 反向不变量：禁止 atom 声明满足某 phase 但 service 判定不满足，反之亦然。
 * 守门作用：新增 atom / 修改 fulfillsStrategyPhase 时，conversation 行为同步切换，
 * 无需修改 service 代码。
 */
import {
  ATOM_CONTRACT_REGISTRY,
  getAtomFulfillsStrategyPhase,
} from '../../atom-contracts/atom-contract-registry'
import type { AtomContractKey } from '../../atom-contracts/atom-contract-types'
import type {
  SemanticActionState,
  SemanticContextSlotState,
  SemanticOrchestrationNode,
  SemanticPositionConstraintState,
  SemanticRiskState,
  SemanticState,
  SemanticTriggerState,
} from '../../types/semantic-state'
import { SemanticExecutableSemanticsService } from '../semantic-executable-semantics.service'

const EMPTY_CONTEXT_SLOTS: SemanticContextSlotState = {
  exchange: null,
  symbol: null,
  marketType: null,
  timeframe: null,
}

function emptyState(): SemanticState {
  return {
    version: 1,
    families: [],
    contextSlots: EMPTY_CONTEXT_SLOTS,
    position: null,
    trigger: [],
    action: [],
    risk: [],
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    normalizationNotes: [],
    updatedAt: new Date().toISOString(),
  }
}

function buildLockedTrigger(key: AtomContractKey, phase: 'entry' | 'exit'): SemanticTriggerState {
  return {
    id: `trigger-${phase}`,
    key,
    phase,
    params: {},
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
  }
}

function buildLockedAction(key: AtomContractKey): SemanticActionState {
  return {
    id: `action-${key}`,
    key,
    params: {},
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
  }
}

function buildLockedRisk(key: AtomContractKey, params: Record<string, unknown> = { valuePct: 5 }): SemanticRiskState {
  return {
    id: `risk-${key}`,
    key,
    params,
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
  }
}

function buildLockedConstraint(key: SemanticPositionConstraintState['key']): SemanticPositionConstraintState {
  return {
    id: `pc-${key}`,
    key,
    params: {},
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
  }
}

function buildLockedOrchestration(key: string): SemanticOrchestrationNode {
  const kind: SemanticOrchestrationNode['kind'] = key.startsWith('scope.')
    ? 'scope'
    : key.startsWith('program.')
      ? 'program'
      : key.startsWith('gate.')
        ? 'gate'
        : 'portfolioRisk'
  return {
    id: `orch-${key}`,
    kind,
    key,
    params: {},
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
    contracts: [],
  }
}

function buildStateWithLockedAtom(key: AtomContractKey, phase?: 'entry' | 'exit'): SemanticState {
  const base = emptyState()
  const bucket = ATOM_CONTRACT_REGISTRY[key].bucket
  if (bucket === 'trigger') {
    return { ...base, trigger: [...base.trigger, buildLockedTrigger(key, phase ?? 'entry')] }
  }
  if (bucket === 'action') {
    return { ...base, action: [...base.action, buildLockedAction(key)] }
  }
  if (bucket === 'risk') {
    const riskAtom = key === 'risk.partial_take_profit'
      ? buildLockedRisk(key, { tiers: [{ trigger: { threshold: 5 }, reduceRatio: 0.5 }] })
      : buildLockedRisk(key)
    return { ...base, risk: [...base.risk, riskAtom] }
  }
  if (bucket === 'positionConstraint') {
    return {
      ...base,
      positionConstraint: [
        ...base.positionConstraint,
        buildLockedConstraint(key as SemanticPositionConstraintState['key']),
      ],
    }
  }
  if (bucket === 'orchestration') {
    return { ...base, orchestration: [...base.orchestration, buildLockedOrchestration(key)] }
  }
  return base
}

describe('SemanticExecutableSemanticsService — fulfillsStrategyPhase invariant', () => {
  const service = new SemanticExecutableSemanticsService()
  const allKeys = Object.keys(ATOM_CONTRACT_REGISTRY) as AtomContractKey[]

  describe.each(allKeys)('atom: %s', (key) => {
    const phases = getAtomFulfillsStrategyPhase(key)
    const bucket = ATOM_CONTRACT_REGISTRY[key].bucket

    if (bucket === 'trigger') {
      it('entry instance: service 判定与 fulfillsStrategyPhase.includes("entry") 一致', () => {
        const state = buildStateWithLockedAtom(key, 'entry')
        const expected = phases.includes('entry')
        expect(service.hasExecutableEntrySemantics(state)).toBe(expected)
      })
      it('exit instance: service 判定与 fulfillsStrategyPhase.includes("exit") 一致', () => {
        const state = buildStateWithLockedAtom(key, 'exit')
        const expected = phases.includes('exit')
        expect(service.hasExecutableExitSemantics(state)).toBe(expected)
      })
      // Issue #1383 Round 1 C7：交叉相位负断言。
      //   即使 atom 在 registry 自声明 ['entry','exit']，单个 trigger 实例的
      //   atom.phase 字段也只能满足对应 phase。例如 `volume.threshold` 若误写成
      //   `['entry']`，旧 invariant 仍 trivially-pass；新增交叉断言会发现：
      //   - entry 实例 + has*Exit* 必须 false（除非该 atom 同时是 risk-bucket forced-exit）
      //   - exit 实例 + has*Entry* 必须 false
      it('entry instance 不满足 exit 语义（trigger phase 闭锁）', () => {
        const state = buildStateWithLockedAtom(key, 'entry')
        expect(service.hasExecutableExitSemantics(state)).toBe(false)
      })
      it('exit instance 不满足 entry 语义（trigger phase 闭锁）', () => {
        const state = buildStateWithLockedAtom(key, 'exit')
        expect(service.hasExecutableEntrySemantics(state)).toBe(false)
      })
    }
    else {
      it('entry: service 判定与 fulfillsStrategyPhase.includes("entry") 一致', () => {
        const state = buildStateWithLockedAtom(key)
        const expected = phases.includes('entry')
        expect(service.hasExecutableEntrySemantics(state)).toBe(expected)
      })
      it('exit: service 判定与 fulfillsStrategyPhase.includes("exit") 一致', () => {
        const state = buildStateWithLockedAtom(key)
        const expected = phases.includes('exit')
        expect(service.hasExecutableExitSemantics(state)).toBe(expected)
      })
    }
  })

  // Issue #1383 Round 1 C3 配套：百分比类 forced-exit risk atom 必须 valuePct > 0
  describe('pct forced-exit risk atom requires valuePct > 0', () => {
    // 注：max_drawdown_pct / max_single_loss_pct 是 legacy key（不在 ATOM_CONTRACT_REGISTRY），
    //   走 hasLegacyForcedExitRiskSemantics 路径；stop_loss_pct / take_profit_pct 已注册，
    //   走 hasLockedAtomFulfilling + PCT_FORCED_EXIT_RISK_KEYS 路径。
    //   两条路径都必须强制 valuePct > 0。
    const PCT_KEYS = [
      'risk.stop_loss_pct',
      'risk.take_profit_pct',
      'risk.max_drawdown_pct',
      'risk.max_single_loss_pct',
    ] as const
    for (const key of PCT_KEYS) {
      it(`${key}: valuePct=0 时不应满足 exit 语义`, () => {
        const base = emptyState()
        const state = { ...base, risk: [...base.risk, buildLockedRisk(key as AtomContractKey, { valuePct: 0 })] }
        expect(service.hasExecutableExitSemantics(state)).toBe(false)
      })
      it(`${key}: valuePct 缺失时不应满足 exit 语义`, () => {
        const base = emptyState()
        const state = { ...base, risk: [...base.risk, buildLockedRisk(key as AtomContractKey, {})] }
        expect(service.hasExecutableExitSemantics(state)).toBe(false)
      })
      it(`${key}: valuePct > 0 时应满足 exit 语义`, () => {
        const base = emptyState()
        const state = { ...base, risk: [...base.risk, buildLockedRisk(key as AtomContractKey, { valuePct: 5 })] }
        expect(service.hasExecutableExitSemantics(state)).toBe(true)
      })
    }
  })

  describe('rules-native facts', () => {
    it('detects executable entry/exit/sizing semantics from rules-only DCA schedule leaves', () => {
      const state: SemanticState = {
        ...emptyState(),
        rules: [{
          id: 'rules-dca',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'volume.threshold', params: { value: 1000 } },
          effects: {
            actions: [],
            risks: [],
            positions: [{
              kind: 'atom',
              key: 'position.dca_schedule',
              params: { perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' } },
            }],
            orchestration: [],
            programs: [],
          },
        }],
      }

      expect(service.hasExecutableEntrySemantics(state)).toBe(true)
      expect(service.hasExecutableExitSemantics(state)).toBe(true)
      expect(service.anyAtomFulfillsPhase(state, 'sizing')).toBe(true)
    })
  })
})
