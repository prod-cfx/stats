import { Injectable } from '@nestjs/common'

import {
  CURRENT_SEMANTIC_VERSION,
  isAtomExecutableForStrategy,
} from '../nl-gateway/version-gate/version-gate'
import type { StrategyVersionInfo } from '../nl-gateway/version-gate/version-gate.types'
import type {
  SemanticOrchestrationContract,
  SemanticOrchestrationNode,
  SemanticSlotState,
} from '../types/semantic-state'

export interface SemanticOrchestrationValidationResult {
  ok: boolean
  missingSlots: SemanticSlotState[]
}

const GATE_REGIME_KEY = 'gate.regime'
const PORTFOLIO_DRAWDOWN_BLOCK_KEY = 'portfolioRisk.drawdown_block'

const PORTFOLIO_DRAWDOWN_BLOCK_CONTRACT: SemanticOrchestrationContract = {
  id: 'portfolioRisk.drawdown_block',
  kind: 'portfolioRisk',
  capabilities: [
    {
      domain: 'orchestration',
      verb: 'portfolio_risk',
      object: 'drawdown_block',
      shape: {},
    },
  ],
  requires: [],
  params: {},
  runtimeRequirements: [
    {
      domain: 'runtime',
      verb: 'read',
      object: 'account_drawdown_pct',
    },
  ],
  stateRequirements: [],
  orderRequirements: [],
  openSlots: [],
  effects: [
    {
      domain: 'guard',
      verb: 'block',
      object: 'new_entries',
    },
  ],
  executableSinceVersion: CURRENT_SEMANTIC_VERSION,
}

const GATE_REGIME_CONTRACT: SemanticOrchestrationContract = {
  id: 'gate.regime',
  kind: 'gate',
  capabilities: [
    {
      domain: 'orchestration',
      verb: 'gate',
      object: 'entry_phase',
      shape: {},
    },
  ],
  requires: [],
  params: {},
  runtimeRequirements: [
    {
      domain: 'runtime',
      verb: 'provide',
      object: 'compiled_predicate_runtime',
    },
  ],
  stateRequirements: [],
  orderRequirements: [],
  openSlots: [],
  effects: [
    {
      domain: 'guard',
      verb: 'block',
      object: 'new_entries',
    },
  ],
  target: { phase: 'entry' },
  executableSinceVersion: CURRENT_SEMANTIC_VERSION,
}

@Injectable()
export class SemanticOrchestrationRegistryService {
  private readonly contracts: ReadonlyMap<string, SemanticOrchestrationContract> = new Map([
    [GATE_REGIME_KEY, GATE_REGIME_CONTRACT],
    [PORTFOLIO_DRAWDOWN_BLOCK_KEY, PORTFOLIO_DRAWDOWN_BLOCK_CONTRACT],
  ])

  getContractByKey(key: string): SemanticOrchestrationContract | null {
    return this.contracts.get(key) ?? null
  }

  validate(node: SemanticOrchestrationNode): SemanticOrchestrationValidationResult {
    const missingSlots: SemanticSlotState[] = []
    if (node.kind === 'portfolioRisk' && node.key === PORTFOLIO_DRAWDOWN_BLOCK_KEY) {
      const thresholdPct = node.thresholdPct
      const thresholdInvalid =
        thresholdPct === undefined ||
        typeof thresholdPct !== 'number' ||
        Number.isNaN(thresholdPct) ||
        thresholdPct <= 0 ||
        thresholdPct > 100
      const modeInvalid = node.mode !== 'observe' && node.mode !== 'enforce'
      const scopeInvalid = node.scope !== 'portfolio'
      if (thresholdInvalid || modeInvalid || scopeInvalid) {
        missingSlots.push({
          slotKey: 'orchestration.portfolio_drawdown.threshold_pct',
          fieldPath: `orchestration.portfolioRisk.drawdown_block[${node.id}]`,
          status: 'open',
          priority: 'core',
          questionHint: '请确认账户回撤百分比阈值（0..100）',
          affectsExecution: true,
        })
      }
      return { ok: missingSlots.length === 0, missingSlots }
    }
    if (node.activeWhen === undefined) {
      missingSlots.push({
        slotKey: 'orchestration.gate.regime.active_when',
        fieldPath: `orchestration.gate.regime[${node.id}]`,
        status: 'open',
        priority: 'core',
        questionHint: '请确认趋势过滤的指标与周期',
        affectsExecution: true,
      })
    }
    return { ok: missingSlots.length === 0, missingSlots }
  }

  isExecutableForStrategy(
    contract: SemanticOrchestrationContract,
    strategy: StrategyVersionInfo,
  ): boolean {
    return isAtomExecutableForStrategy(contract, strategy)
  }
}
