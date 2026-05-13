import type { NotApplicableIrShapeBuilder, Pr1bStubIrShapeBuilder } from '../atom-contract-registry'
import type { AtomContract, AtomContractDisplay, AtomContractEmit, AtomContractSurface } from '../atom-contract-types'
import {
  COMMON_PIPELINE,
  NO_SUMMARY,
  VIA_PRESENTATION_DISPLAY,
} from '../atom-contract-types'

const validSurface: AtomContractSurface = {
  intent: {
    keywords: ['RSI'],
    verbs: { lte: ['低于'] },
  },
  paramSlots: {},
  phaseResolver: 'by-clause-verb',
  sideResolver: 'inherit',
}

const validDisplay: AtomContractDisplay = {
  publicName: { zh: 'RSI 低于阈值', en: 'RSI 低于阈值' },
  paramRenderers: {},
  summaryTemplate: () => 'RSI 低于阈值',
}

const validEmit: AtomContractEmit = {
  capability: { domain: 'trigger', verb: 'emit', object: 'rsi_lte' },
  // PR3a: irShape 返回 predicate id `string`；stub 形态调用即抛错，与 createPr1bStubIrShape 等价
  irShape: Object.assign(
    ((): string => { throw new Error('[#1279 PR1b stub] counter-example placeholder') }) as AtomContractEmit['irShape'],
    { __pr1bStub: true as const },
  ),
  evidenceSource: 'clause',
}

describe('atom contract invariant counter examples', () => {
  it('keeps compile-time counter examples alive through @ts-expect-error', () => {
    // @ts-expect-error surface is required after PR1b.
    const missingSurface: AtomContract = {
      key: 'oscillator.rsi_lte',
      bucket: 'trigger',
      summaryContribution: NO_SUMMARY,
      readinessCheck: COMMON_PIPELINE,
      clarificationQuestion: VIA_PRESENTATION_DISPLAY,
      mutex: [],
      isActionable: false,
      sizingEvidence: null,
      display: validDisplay,
      emit: validEmit,
    }

    // @ts-expect-error display is required after PR1b.
    const missingDisplay: AtomContract = {
      key: 'oscillator.rsi_lte',
      bucket: 'trigger',
      summaryContribution: NO_SUMMARY,
      readinessCheck: COMMON_PIPELINE,
      clarificationQuestion: VIA_PRESENTATION_DISPLAY,
      mutex: [],
      isActionable: false,
      sizingEvidence: null,
      surface: validSurface,
      emit: validEmit,
    }

    // @ts-expect-error emit is required after PR1b.
    const missingEmit: AtomContract = {
      key: 'oscillator.rsi_lte',
      bucket: 'trigger',
      summaryContribution: NO_SUMMARY,
      readinessCheck: COMMON_PIPELINE,
      clarificationQuestion: VIA_PRESENTATION_DISPLAY,
      mutex: [],
      isActionable: false,
      sizingEvidence: null,
      surface: validSurface,
      display: validDisplay,
    }

    // @ts-expect-error PR3a：缺 `__pr1bStub: true` 品牌 → 不能赋给 Pr1bStubIrShapeBuilder（用于守护 stub vs real 分流）
    const nonStubIrShape: Pr1bStubIrShapeBuilder = () => 'real-predicate-id'

    // @ts-expect-error PR3e：缺 `__notApplicable: true` 品牌 → 不能赋给 NotApplicableIrShapeBuilder
    //   （守护 `irshape-not-applicable` 状态的 sentinel 与真实 irShape 不混淆，
    //   防止 non-condition bucket atom 被错误注入 condition predicate 实现）。
    const nonNotApplicableIrShape: NotApplicableIrShapeBuilder = () => 'real-predicate-id'

    expect([
      missingSurface,
      missingDisplay,
      missingEmit,
      nonStubIrShape,
      nonNotApplicableIrShape,
    ]).toBeDefined()
  })
})
