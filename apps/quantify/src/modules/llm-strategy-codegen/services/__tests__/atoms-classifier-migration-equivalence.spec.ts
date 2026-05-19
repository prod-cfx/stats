/**
 * 双源等价 spec — Issue #1334 PR2 Step D
 *
 * 对 ATOM_CONTRACT_REGISTRY 中每个 key，比较：
 *   - legacy: SemanticAtomRegistryService.resolve(key)
 *   - new:    adaptFromContractRegistry(ATOM_CONTRACT_REGISTRY[key])
 *
 * 断言 supportStatus（含 unsupported 类目）等价。
 * PR3 切换数据源后本 spec 仍需 100% 通过（行为不变）。
 *
 * 注意：
 *   - REGISTRY 中 unsupported atom（indicator.above/below, risk.partial_take_profit）
 *     的 classifier.supportStatus 为 `unsupported_*_public_beta_unsupported` 模板字面量；
 *     legacy 的 supportStatus 为 'recognized_unsupported'——两者语义等价但值不同，
 *     spec 做 isUnsupported() 判定等价而非字面量相等。
 *   - legacy category 'position' 对应 REGISTRY bucket 'positionConstraint'；
 *     'orchestration' 在两侧相同。
 */

import { UNSUPPORTED_SKIP } from '../../atom-contracts/atom-contract-types'
import { ATOM_CONTRACT_REGISTRY, DEFAULT_CLASSIFIER_META } from '../../atom-contracts/atom-contract-registry'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'

type AtomContractEntry = (typeof ATOM_CONTRACT_REGISTRY)[keyof typeof ATOM_CONTRACT_REGISTRY]

/** REGISTRY bucket → legacy category 映射
 *  #1364 AC-4：production `bucketToCategory` 将 `orchestration` 映射为
 *  `context`（SemanticAtomDefinition 的 category 联合中只有 'context'，无 'orchestration'）。
 *  Task 6 后 orchestration atom 可通过 legacy resolve()/list() 暴露，本映射与之对齐。
 */
function bucketToLegacyCategory(bucket: string): string {
  switch (bucket) {
    case 'trigger': return 'trigger'
    case 'action': return 'action'
    case 'risk': return 'risk'
    case 'positionConstraint': return 'position'
    case 'orchestration': return 'context'
    default: return bucket
  }
}

/**
 * Derive a classifier-like shape from REGISTRY entry.
 * Returns { supportStatus, isUnsupported, executableSinceVersion }.
 */
function adaptFromContractRegistry(entry: AtomContractEntry) {
  const { classifier } = entry
  const emit = entry.emit as {
    capabilityStatus: string
    riskGuardShape?: unknown
    ruleBlockShape?: unknown
    orchestrationPortfolioRiskShape?: unknown
    lifecyclePyramidingShape?: unknown
    actionShape?: unknown
  }
  // 与 production registry adapter 的无 params resolve()/list() 路径一致：
  // unsupported atom 不能只因 emit shape 存在而全局升级，必须由带 params 的 resolve() 特例提升。
  const isExecutableByEmit = (() => {
    if (classifier.supportStatus !== 'supported_executable') {
      return false
    }
    if (entry.readinessCheck === UNSUPPORTED_SKIP) {
      return false
    }

    switch (emit.capabilityStatus) {
      case 'pr3a-condition':
        return true
      case 'pr3e-risk-guard':
        return typeof emit.riskGuardShape === 'function'
      case 'pr3e-rule-block':
        return typeof emit.ruleBlockShape === 'function'
      case 'pr3e-orchestration-portfolio':
        return typeof emit.orchestrationPortfolioRiskShape === 'function'
      case 'pr3e-lifecycle':
        return typeof emit.lifecyclePyramidingShape === 'function'
      case 'pr3e-action':
        return typeof emit.actionShape === 'function'
      default:
        return false
    }
  })()
  const isUnsupported = classifier.supportStatus !== 'supported_executable' && !isExecutableByEmit
  return {
    supportStatus: classifier.supportStatus,
    isUnsupported,
    executableSinceVersion: classifier.supportStatus === 'supported_executable'
      ? classifier.executableSinceVersion
      : undefined,
    reasonCode: classifier.supportStatus === 'supported_executable'
      ? undefined
      : classifier.unsupportedMeta.reasonCode,
    // #1364 PR1：bucket 从 contract.bucket 单一真相源读
    bucket: entry.bucket,
    legacyCategory: bucketToLegacyCategory(entry.bucket),
  }
}

describe('atoms-classifier-migration-equivalence', () => {
  const service = new SemanticAtomRegistryService()

  const registryKeys = Object.keys(ATOM_CONTRACT_REGISTRY) as (keyof typeof ATOM_CONTRACT_REGISTRY)[]

  // risk.partial_take_profit has special resolution logic in legacy (resolvePartialTakeProfitAtom):
  // without params it returns supported_requires_slot, not recognized_unsupported.
  // REGISTRY marks it unsupported_* at the static classifier level (PR2 intent).
  // Skip in generic loop; tested separately below.
  const specialCaseKeys = new Set(['risk.partial_take_profit'])

  const dottedActionKeys = [
    'action.open_long',
    'action.close_long',
    'action.open_short',
    'action.close_short',
  ] as const

  describe('full equivalence for atoms present in both sources', () => {
    for (const key of registryKeys) {
      if (specialCaseKeys.has(key)) continue

      it(`${key}: classification + category + version + reasonCode all agree`, () => {
        const entry = ATOM_CONTRACT_REGISTRY[key]
        const adapted = adaptFromContractRegistry(entry)
        const legacy = service.resolve(key)

        const legacyIsUnsupported = legacy.supportStatus === 'recognized_unsupported'
          || legacy.supportStatus === 'unsupported_unknown'

        // (a) unsupported / supported classification agrees
        expect(adapted.isUnsupported).toBe(legacyIsUnsupported)

        // (b) legacy category 与 REGISTRY bucket→legacyCategory 一致
        expect(adapted.legacyCategory).toBe(legacy.category)

        // (c) supported_executable 双侧 executableSinceVersion 一致
        if (!adapted.isUnsupported && !legacyIsUnsupported) {
          const legacyVersion = (legacy as { executableSinceVersion?: string }).executableSinceVersion
          expect(adapted.executableSinceVersion).toBe(legacyVersion)
        }

        // (d) unsupported atom reasonCode 与 legacy unsupported.reasonCode 字面一致
        if (adapted.isUnsupported && legacy.supportStatus === 'recognized_unsupported') {
          expect(adapted.reasonCode).toBe(legacy.unsupported.reasonCode)
        }
      })
    }
  })

  describe('dotted lifecycle action keys resolve as supported executable', () => {
    for (const key of dottedActionKeys) {
      it(`${key}: legacy resolve 必须为 supported_executable`, () => {
        const legacy = service.resolve(key)
        expect(legacy.supportStatus).toBe('supported_executable')
        expect(legacy.category).toBe('action')
      })
    }
  })

  describe('unsupported atoms carry correct reasonCode in classifier', () => {
    it('indicator.above has indicator_static_compare_public_beta_unsupported', () => {
      const entry = ATOM_CONTRACT_REGISTRY['indicator.above']
      expect(entry.classifier.supportStatus).toBe('unsupported_indicator_static_compare_public_beta_unsupported')
      expect((entry.classifier as { unsupportedMeta?: { reasonCode?: string } }).unsupportedMeta?.reasonCode).toBe('indicator_static_compare_public_beta_unsupported')
    })

    it('indicator.below has indicator_static_compare_public_beta_unsupported', () => {
      const entry = ATOM_CONTRACT_REGISTRY['indicator.below']
      expect(entry.classifier.supportStatus).toBe('unsupported_indicator_static_compare_public_beta_unsupported')
      expect((entry.classifier as { unsupportedMeta?: { reasonCode?: string } }).unsupportedMeta?.reasonCode).toBe('indicator_static_compare_public_beta_unsupported')
    })

    it('risk.partial_take_profit promoted to supported_executable (Issue #1383 Lane A)', () => {
      // Issue #1383 Lane A：risk.partial_take_profit 升级为 supported_executable，
      //   不再走 recognized_unsupported reasonCode 路径。
      const entry = ATOM_CONTRACT_REGISTRY['risk.partial_take_profit']
      expect(entry.classifier.supportStatus).toBe('supported_executable')
    })
  })

  describe('executableSinceVersion equivalence', () => {
    const versionAtoms: (keyof typeof ATOM_CONTRACT_REGISTRY)[] = [
      'volume.threshold',
      'volatility.atr_threshold',
      'strategy.time_window',
      'position.has_position',
      'position.no_position',
      'indicator.divergence',
      'price.candle_pattern',
      'price.chart_pattern',
      'liquidity.sweep',
      'action.add_position',
      'action.reverse_position',
      'position.dca_schedule',
    ]

    for (const key of versionAtoms) {
      it(`${key} has executableSinceVersion '2026.05.W02'`, () => {
        const entry = ATOM_CONTRACT_REGISTRY[key]
        const adapted = adaptFromContractRegistry(entry)
        expect(adapted.executableSinceVersion).toBe('2026.05.W02')

        // Also verify legacy has the same version
        const legacy = service.resolve(key)
        if (legacy.supportStatus !== 'unsupported_unknown' && legacy.supportStatus !== 'recognized_unsupported') {
          const legacyVersion = (legacy as { executableSinceVersion?: string }).executableSinceVersion
          expect(legacyVersion).toBe('2026.05.W02')
        }
      })
    }
  })

  describe('bucket→category mapping coverage', () => {
    it('all registry atoms have a valid bucket→legacyCategory mapping', () => {
      for (const key of registryKeys) {
        const entry = ATOM_CONTRACT_REGISTRY[key]
        const adapted = adaptFromContractRegistry(entry)
        expect(['trigger', 'action', 'risk', 'position', 'context']).toContain(adapted.legacyCategory)
      }
    })
  })

  describe('DEFAULT_CLASSIFIER_META remains supported_executable baseline', () => {
    it('DEFAULT_CLASSIFIER_META.supportStatus is supported_executable', () => {
      expect(DEFAULT_CLASSIFIER_META.supportStatus).toBe('supported_executable')
    })

    it('atoms without version override still have no executableSinceVersion', () => {
      // These atoms use DEFAULT_CLASSIFIER_META directly and should have no version
      const noVersionAtoms: (keyof typeof ATOM_CONTRACT_REGISTRY)[] = [
        'oscillator.rsi_lte',
        'oscillator.rsi_gte',
        'bollinger.touch_upper',
        'price.percent_change',
        'action.open_long',
        'action.close_long',
      ]
      for (const key of noVersionAtoms) {
        const entry = ATOM_CONTRACT_REGISTRY[key]
        expect((entry.classifier as { executableSinceVersion?: string }).executableSinceVersion).toBeUndefined()
      }
    })
  })
})
