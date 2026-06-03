import type {
  CryptoCaseEvidence,
  CryptoCoverageScope,
  CryptoCoverageTaxonomyCaseMapping,
  CryptoCoverageTaxonomyEvidence,
  CryptoCoverageTaxonomyFamilyEvidence,
} from './crypto-coverage-types'

interface TaxonomyFamilyDefinition {
  readonly familyId: string
  readonly name: string
  readonly scope: CryptoCoverageScope
  readonly weightPct: number
  readonly weightSource: string
  readonly matches: (caseItem: CryptoCaseEvidence) => boolean
}

const B_WEIGHT_SOURCE = 'Internal Stage4 crypto acceptance taxonomy: weights reflect observed strategy surface in repository historical corpus, with unsupported latency/cross-venue automation excluded from executable denominator.'

const TAXONOMY_FAMILIES: readonly TaxonomyFamilyDefinition[] = [
  {
    familyId: 'trend_breakout_momentum',
    name: 'Trend, breakout, momentum',
    scope: 'B',
    weightPct: 24,
    weightSource: 'Largest reusable retail/systematic crypto class in Stage4 corpus: EMA crosses, breakouts, threshold filters, slope and volume confirmation.',
    matches: item => item.labels.includes('simple_trend'),
  },
  {
    familyId: 'mean_reversion_oscillator',
    name: 'Mean reversion and oscillator cycles',
    scope: 'B',
    weightPct: 13,
    weightSource: 'Common RSI and boundary-reversion strategies in historical acceptance cases.',
    matches: item => item.labels.includes('mean_reversion'),
  },
  {
    familyId: 'grid_range',
    name: 'Grid and range programs',
    scope: 'B',
    weightPct: 8,
    weightSource: 'Range-bound retail crypto automation represented by grid/range atoms and fixed-grid program cases.',
    matches: item => item.labels.includes('grid') || item.expectedAtomKeys.includes('program.fixed_grid_gated') || item.expectedAtomKeys.includes('pattern.range'),
  },
  {
    familyId: 'dca_position_scaling',
    name: 'DCA, pyramiding, martingale, sizing',
    scope: 'B',
    weightPct: 10,
    weightSource: 'Position construction layer: scheduled DCA, add-position caps, martingale and budget/fixed-notional sizing.',
    matches: item => item.labels.includes('dca') || item.labels.includes('add_position') || item.expectedAtomKeys.some(atom => atom.startsWith('position.') || atom === 'program.dca' || atom === 'program.martingale'),
  },
  {
    familyId: 'portfolio_risk_governance',
    name: 'Portfolio risk and kill-switch governance',
    scope: 'B',
    weightPct: 12,
    weightSource: 'Risk-control denominator covers drawdown, daily loss, exposure caps, concurrent position limits and kill switches.',
    matches: item => item.labels.includes('portfolio_risk') || item.labels.includes('risk') || item.expectedAtomKeys.some(atom => atom.startsWith('portfolioRisk.') || atom === 'risk.daily_loss_limit' || atom === 'risk.kill_switch'),
  },
  {
    familyId: 'multi_context_scope',
    name: 'Multi-timeframe, multi-symbol, multi-leg context',
    scope: 'B',
    weightPct: 9,
    weightSource: 'Context expansion class covers timeframe, symbol and leg scoping without cross-exchange fund movement.',
    matches: item => item.labels.includes('multi_timeframe') || item.labels.includes('multi_symbol') || item.expectedAtomKeys.some(atom => atom.startsWith('scope.')),
  },
  {
    familyId: 'crypto_data_sources',
    name: 'Crypto-native data source confirmations',
    scope: 'B',
    weightPct: 8,
    weightSource: 'Crypto-specific signal layer: orderbook, funding, open interest, liquidation and webhook/external signals.',
    matches: item => item.labels.includes('data_source_binding') || item.labels.includes('orderbook') || item.expectedAtomKeys.some(atom => atom.startsWith('orderbook.') || atom.startsWith('fundingRate.') || atom.startsWith('openInterest.') || atom.startsWith('liquidation.') || atom.startsWith('external.')),
  },
  {
    familyId: 'execution_lifecycle',
    name: 'Action lifecycle and execution options',
    scope: 'B',
    weightPct: 10,
    weightSource: 'Order/action control class: reduce-only, post-only, limit chase, conditional/limit orders, close/reduce/reverse lifecycle.',
    matches: item => item.labels.includes('action_lifecycle') || item.labels.includes('execution') || item.expectedAtomKeys.some(atom => atom.startsWith('execution.') || atom === 'action.limit_order' || atom === 'action.conditional_order' || atom === 'action.reduce_position' || atom === 'action.reverse_position'),
  },
  {
    familyId: 'execution_programs',
    name: 'Reusable execution programs',
    scope: 'B',
    weightPct: 6,
    weightSource: 'Program atom layer covers TWAP, DCA, rebalance, iceberg, martingale and fixed-grid execution templates.',
    matches: item => item.labels.includes('execution_program') || item.expectedAtomKeys.some(atom => atom.startsWith('program.')),
  },
  {
    familyId: 'unsupported_cross_exchange_transfer_arbitrage',
    name: 'Cross-exchange fund-transfer arbitrage',
    scope: 'C',
    weightPct: 0,
    weightSource: 'Excluded from executable denominator: requires automated exchange-to-exchange fund movement and venue settlement controls.',
    matches: item => item.expectedAtomKeys.includes('unsupported.cross_exchange_fund_transfer_arbitrage'),
  },
  {
    familyId: 'unsupported_triangular_arbitrage_matching',
    name: 'Triangular arbitrage matching',
    scope: 'C',
    weightPct: 0,
    weightSource: 'Excluded from executable denominator: requires multi-leg atomic matching semantics beyond generic strategy rules.',
    matches: item => item.expectedAtomKeys.includes('unsupported.triangular_arbitrage_matching'),
  },
  {
    familyId: 'unsupported_hft_market_making',
    name: 'HFT market making',
    scope: 'C',
    weightPct: 0,
    weightSource: 'Excluded from executable denominator: requires latency-sensitive colocated market-making runtime.',
    matches: item => item.expectedAtomKeys.includes('unsupported.hft_market_making'),
  },
  {
    familyId: 'unsupported_order_queue_alpha',
    name: 'Latency-sensitive order queue alpha',
    scope: 'C',
    weightPct: 0,
    weightSource: 'Excluded from executable denominator: requires queue-position alpha and microstructure runtime guarantees.',
    matches: item => item.expectedAtomKeys.includes('unsupported.latency_sensitive_order_queue_alpha'),
  },
]

function pct(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(2))
}

function caseSource(caseId: string): CryptoCoverageTaxonomyCaseMapping['source'] {
  return caseId.startsWith('stage4-') ? 'stage4_real_strategy_corpus' : 'p1_crypto_extension_corpus'
}

function familyIdsForCase(caseItem: CryptoCaseEvidence): string[] {
  return TAXONOMY_FAMILIES.filter(family => family.matches(caseItem)).map(family => family.familyId)
}

export function buildCryptoCoverageTaxonomyEvidence(cases: readonly CryptoCaseEvidence[]): CryptoCoverageTaxonomyEvidence {
  const caseMappings = cases.map<CryptoCoverageTaxonomyCaseMapping>(caseItem => ({
    caseId: caseItem.id,
    scope: caseItem.scope,
    labels: caseItem.labels,
    familyIds: familyIdsForCase(caseItem),
    source: caseSource(caseItem.id),
    passed: caseItem.passed,
  }))

  const families = TAXONOMY_FAMILIES.map<CryptoCoverageTaxonomyFamilyEvidence>((family) => {
    const familyCases = caseMappings.filter(mapping => mapping.familyIds.includes(family.familyId))
    const passedCaseIds = familyCases.filter(mapping => mapping.passed).map(mapping => mapping.caseId)
    const covered = family.scope === 'C'
      ? familyCases.every(mapping => mapping.passed)
      : passedCaseIds.length > 0
    return {
      familyId: family.familyId,
      name: family.name,
      scope: family.scope,
      weightPct: family.weightPct,
      weightSource: family.weightSource,
      corpusCaseIds: familyCases.map(mapping => mapping.caseId),
      passedCaseIds,
      covered,
      denominatorIncluded: family.scope === 'B',
    }
  })

  const denominatorWeight = families.filter(family => family.denominatorIncluded).reduce((sum, family) => sum + family.weightPct, 0)
  const achievedWeight = families.filter(family => family.denominatorIncluded && family.covered).reduce((sum, family) => sum + family.weightPct, 0)

  return {
    targetCoveragePct: 90,
    achievedCoveragePct: pct(achievedWeight, denominatorWeight),
    denominator: 'B_supported_strategy_families',
    weightSource: B_WEIGHT_SOURCE,
    corpusSource: 'CRYPTO_STRATEGY_COVERAGE_CORPUS = STAGE4_REAL_STRATEGY_CORPUS plus P1 crypto extension cases; external exchange/user dataset is not claimed in this proof.',
    sourceLimitations: [
      'Evidence proves repository corpus coverage, not market-share coverage from an external user dataset.',
      'C-scope latency/cross-venue automation is intentionally fail-closed and excluded from executable B denominator.',
    ],
    families,
    caseMappings,
  }
}
