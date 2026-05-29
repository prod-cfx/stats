import type { Stage4AtomCoverageRow } from './atom-coverage-matrix'
import type { Stage4BlockerKind } from './staging-dialogue-runner'
import { isStage4DeployReadyAtom } from './atom-coverage-matrix'

export type Stage4CorpusResultStatus = 'corpus_pass' | 'failed'

export interface Stage4CorpusResult {
  readonly id: string
  readonly passed: boolean
  readonly attemptCount: number
  readonly status: Stage4CorpusResultStatus
  readonly blocker: Stage4BlockerKind | null
}

export interface Stage4CoverageReport {
  readonly atomTotal: number
  readonly atomDeployReady: number
  readonly atomDeployReadyPct: number
  readonly corpusTotal: number
  readonly corpusPass: number
  readonly corpusPassPct: number
  readonly attemptOnePassPct: number
  readonly blockers: Partial<Record<Stage4BlockerKind, number>>
}

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Number(((numerator / denominator) * 100).toFixed(2))
}

function isStage4CorpusPass(result: Stage4CorpusResult): boolean {
  return result.status === 'corpus_pass' && result.passed && result.attemptCount === 1
}

export function buildStage4CoverageReport(input: {
  readonly atoms: readonly Stage4AtomCoverageRow[]
  readonly corpusResults: readonly Stage4CorpusResult[]
}): Stage4CoverageReport {
  const atomDeployReady = input.atoms.filter(isStage4DeployReadyAtom).length
  const corpusPass = input.corpusResults.filter(isStage4CorpusPass).length
  const attemptOnePass = corpusPass
  const blockers: Partial<Record<Stage4BlockerKind, number>> = {}

  for (const result of input.corpusResults) {
    if (!result.blocker) continue
    blockers[result.blocker] = (blockers[result.blocker] ?? 0) + 1
  }

  return {
    atomTotal: input.atoms.length,
    atomDeployReady,
    atomDeployReadyPct: pct(atomDeployReady, input.atoms.length),
    corpusTotal: input.corpusResults.length,
    corpusPass,
    corpusPassPct: pct(corpusPass, input.corpusResults.length),
    attemptOnePassPct: pct(attemptOnePass, input.corpusResults.length),
    blockers,
  }
}
