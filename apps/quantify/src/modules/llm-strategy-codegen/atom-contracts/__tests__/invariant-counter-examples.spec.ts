import type { Pr1bStubIrShapeBuilder } from '../atom-contract-registry'
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
  irShape: Object.assign(
    (() => ({ kind: 'stub', atomKey: 'oscillator.rsi_lte', params: {} })),
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

    // @ts-expect-error PR1b irShape values must carry the stub marker until PR3a.
    const nonStubIrShape: Pr1bStubIrShapeBuilder = () => ({ kind: 'real', atomKey: 'x', params: {} })

    expect([
      missingSurface,
      missingDisplay,
      missingEmit,
      nonStubIrShape,
    ]).toBeDefined()
  })
})
