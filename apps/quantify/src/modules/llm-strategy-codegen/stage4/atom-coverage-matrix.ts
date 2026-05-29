export const STAGE4_ATOM_FAMILIES = [
  'predicate',
  'action',
  'risk',
  'position',
  'program',
  'orchestration',
] as const

export type Stage4AtomFamily = typeof STAGE4_ATOM_FAMILIES[number]

export type Stage4RulePath =
  | 'rules[].condition'
  | 'rules[].effects.actions'
  | 'rules[].effects.risks'
  | 'rules[].effects.positions'
  | 'rules[].effects.programs'
  | 'rules[].effects.orchestration'

export type Stage4AtomStatus =
  | 'planned'
  | 'dialogue_ready'
  | 'rules_ready'
  | 'readiness_ready'
  | 'display_ready'
  | 'canonical_ready'
  | 'ir_ready'
  | 'runtime_ready'
  | 'backtest_ready'
  | 'deploy_ready'
  | 'corpus_pass'

export type Stage4RequiredDataSource =
  | 'ohlcv'
  | 'orderbook'
  | 'funding'
  | 'open_interest'
  | 'liquidation'
  | 'webhook'
  | 'none'

export type Stage4PrBatch =
  | 'pr2-predicate'
  | 'pr3-risk-position'
  | 'pr4-action-program'
  | 'pr5-orchestration-data'
  | 'pr6-corpus-acceptance'

export interface Stage4AtomCoverageRow {
  readonly atomKey: string
  readonly family: Stage4AtomFamily
  readonly rulePath: Stage4RulePath
  readonly paramsSchema: readonly string[]
  readonly requiredSlots: readonly string[]
  readonly utteranceExamples: readonly string[]
  readonly displayShape: string
  readonly canonicalShape: string
  readonly irShape: string
  readonly runtimeRequirement: string
  readonly requiredDataSources: readonly Stage4RequiredDataSource[]
  readonly deployPayloadImpact: readonly string[]
  readonly corpusCases: readonly string[]
  readonly status: Stage4AtomStatus
  readonly unsupportedReason: string | null
  readonly prBatch: Stage4PrBatch
  readonly reachesBacktest: boolean
  readonly reachesDeployPayload: boolean
}

export const STAGE4_DEPLOY_READY_STATUSES = ['deploy_ready', 'corpus_pass'] as const satisfies readonly Stage4AtomStatus[]

export const STAGE4_ATOM_COVERAGE_MATRIX = [
  {
    atomKey: 'predicate.foundation.indicator_boundary',
    family: 'predicate',
    rulePath: 'rules[].condition',
    paramsSchema: ['indicator', 'boundary', 'direction'],
    requiredSlots: ['indicator', 'boundary'],
    utteranceExamples: [],
    displayShape: 'indicator boundary predicate',
    canonicalShape: 'CanonicalConditionAtom',
    irShape: 'predicate:indicator_boundary',
    runtimeRequirement: 'ohlcv bars and indicator series',
    requiredDataSources: ['ohlcv'],
    deployPayloadImpact: ['dataRequirements.requiredTimeframes'],
    corpusCases: [],
    status: 'planned',
    unsupportedReason: null,
    prBatch: 'pr2-predicate',
    reachesBacktest: false,
    reachesDeployPayload: false,
  },
  {
    atomKey: 'action.foundation.open_position',
    family: 'action',
    rulePath: 'rules[].effects.actions',
    paramsSchema: ['side', 'orderType'],
    requiredSlots: ['side'],
    utteranceExamples: [],
    displayShape: 'open position action effect',
    canonicalShape: 'canonical rule action',
    irShape: 'action:open_position',
    runtimeRequirement: 'order lifecycle action support',
    requiredDataSources: ['none'],
    deployPayloadImpact: ['execution.actions'],
    corpusCases: [],
    status: 'planned',
    unsupportedReason: null,
    prBatch: 'pr4-action-program',
    reachesBacktest: false,
    reachesDeployPayload: false,
  },
  {
    atomKey: 'risk.foundation.atr_stop',
    family: 'risk',
    rulePath: 'rules[].effects.risks',
    paramsSchema: ['multiple', 'period'],
    requiredSlots: ['multiple'],
    utteranceExamples: [],
    displayShape: 'ATR stop risk effect',
    canonicalShape: 'risk guard',
    irShape: 'guard:atr_stop',
    runtimeRequirement: 'atr series and position state',
    requiredDataSources: ['ohlcv'],
    deployPayloadImpact: ['riskPolicy.guards'],
    corpusCases: [],
    status: 'planned',
    unsupportedReason: null,
    prBatch: 'pr3-risk-position',
    reachesBacktest: false,
    reachesDeployPayload: false,
  },
  {
    atomKey: 'position.foundation.fixed_notional',
    family: 'position',
    rulePath: 'rules[].effects.positions',
    paramsSchema: ['notional'],
    requiredSlots: ['notional'],
    utteranceExamples: [],
    displayShape: 'fixed notional position effect',
    canonicalShape: 'position sizing policy',
    irShape: 'position:fixed_notional',
    runtimeRequirement: 'account equity and symbol price',
    requiredDataSources: ['ohlcv'],
    deployPayloadImpact: ['sizingPolicy'],
    corpusCases: [],
    status: 'planned',
    unsupportedReason: null,
    prBatch: 'pr3-risk-position',
    reachesBacktest: false,
    reachesDeployPayload: false,
  },
  {
    atomKey: 'program.foundation.fixed_grid',
    family: 'program',
    rulePath: 'rules[].effects.programs',
    paramsSchema: ['lower', 'upper', 'gridCount'],
    requiredSlots: ['lower', 'upper', 'gridCount'],
    utteranceExamples: [],
    displayShape: 'fixed grid program effect',
    canonicalShape: 'order program',
    irShape: 'program:fixed_grid',
    runtimeRequirement: 'order program lifecycle state',
    requiredDataSources: ['ohlcv'],
    deployPayloadImpact: ['orderPrograms'],
    corpusCases: [],
    status: 'planned',
    unsupportedReason: null,
    prBatch: 'pr4-action-program',
    reachesBacktest: false,
    reachesDeployPayload: false,
  },
  {
    atomKey: 'orchestration.foundation.scope_timeframe',
    family: 'orchestration',
    rulePath: 'rules[].effects.orchestration',
    paramsSchema: ['timeframe'],
    requiredSlots: ['timeframe'],
    utteranceExamples: [],
    displayShape: 'timeframe scope orchestration effect',
    canonicalShape: 'scope binding',
    irShape: 'scope:timeframe',
    runtimeRequirement: 'multi-timeframe runtime context',
    requiredDataSources: ['ohlcv'],
    deployPayloadImpact: ['scopeBindings.timeframes'],
    corpusCases: [],
    status: 'planned',
    unsupportedReason: null,
    prBatch: 'pr5-orchestration-data',
    reachesBacktest: false,
    reachesDeployPayload: false,
  },
] as const satisfies readonly Stage4AtomCoverageRow[]

export function isStage4DeployReadyAtom(row: Stage4AtomCoverageRow): boolean {
  const deployReadyStatuses: readonly Stage4AtomStatus[] = STAGE4_DEPLOY_READY_STATUSES

  return deployReadyStatuses.includes(row.status)
    && row.reachesBacktest
    && row.reachesDeployPayload
}
