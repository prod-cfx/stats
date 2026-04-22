import type { StrategyLogicSnapshot, StrategyRuleBasis, StrategyRuleDraft } from '../types/strategy-logic-snapshot'

export interface StrategyRuleDraftCollection {
  entry: StrategyRuleDraft[]
  exit: StrategyRuleDraft[]
  risk: StrategyRuleDraft[]
}

function normalizeTimeframe(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const normalized = raw.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeDraft(
  draft: StrategyRuleDraft,
  fallback: {
    id: string
    phase: StrategyRuleDraft['phase']
    text: string
    timeframe: string | null
    basis: StrategyRuleBasis['kind'] | null
  },
): StrategyRuleDraft {
  const text = typeof draft.text === 'string' && draft.text.trim().length > 0
    ? draft.text.trim()
    : fallback.text
  const timeframe = normalizeTimeframe(draft.timeframe) ?? fallback.timeframe
  const basis = typeof draft.basis === 'string' && draft.basis.trim().length > 0
    ? draft.basis
    : fallback.basis

  return {
    id: typeof draft.id === 'string' && draft.id.trim().length > 0 ? draft.id.trim() : fallback.id,
    phase: draft.phase === fallback.phase ? draft.phase : fallback.phase,
    text,
    timeframe,
    ...(basis ? { basis } : {}),
  }
}

export function extractRuleTimeframe(text: string): string | null {
  const matched = text.match(/(\d{1,4})\s*(min|分钟|小时|[mhd天])/iu)
  if (!matched?.[1] || !matched[2]) {
    return null
  }
  const value = matched[1]
  const unit = matched[2].toLowerCase()
  if (unit === 'm' || unit === 'min' || unit === '分钟') return `${value}m`
  if (unit === 'h' || unit === '小时') return `${value}h`
  return `${value}d`
}

export function resolveStrategyDefaultTimeframe(checklist: StrategyLogicSnapshot): string | null {
  return normalizeTimeframe(checklist.market?.defaultTimeframe)
    ?? normalizeTimeframe(checklist.entryRuleDrafts?.[0]?.timeframe)
    ?? (Array.isArray(checklist.entryRules)
        ? normalizeTimeframe(extractRuleTimeframe(checklist.entryRules[0] ?? ''))
        : null)
    ?? normalizeTimeframe(checklist.timeframes?.[0])
    ?? normalizeTimeframe(checklist.exitRuleDrafts?.[0]?.timeframe)
}

export function buildStrategyRuleDrafts(checklist: StrategyLogicSnapshot): StrategyRuleDraftCollection {
  const defaultTimeframe = resolveStrategyDefaultTimeframe(checklist)
  const timeframes = (checklist.timeframes ?? [])
    .map(item => normalizeTimeframe(item))
    .filter((item): item is string => item !== null)

  const buildDrafts = (input: {
    phase: 'entry' | 'exit' | 'risk'
    rules?: string[]
    drafts?: StrategyRuleDraft[]
    bases?: Record<string, StrategyRuleBasis['kind']>
    fallbackTimeframe: (index: number) => string | null
  }): StrategyRuleDraft[] => {
    const rules = (input.rules ?? [])
      .map(rule => rule.trim())
      .filter(Boolean)

    return rules.map((text, index) => {
      const id = `${input.phase}-${index + 1}`
      const fallbackBasis = input.bases?.[id] ?? null
      const fallback = {
        id,
        phase: input.phase,
        text,
        timeframe: extractRuleTimeframe(text) ?? input.fallbackTimeframe(index),
        basis: fallbackBasis,
      }
      const explicitDraft = input.drafts?.[index]
      return explicitDraft
        ? normalizeDraft(explicitDraft, fallback)
        : normalizeDraft(fallback, fallback)
    })
  }

  const entry = buildDrafts({
    phase: 'entry',
    rules: checklist.entryRules,
    drafts: checklist.entryRuleDrafts,
    bases: checklist.entryRuleBases,
    fallbackTimeframe: () => timeframes[0] ?? defaultTimeframe,
  })
  const exit = buildDrafts({
    phase: 'exit',
    rules: checklist.exitRules,
    drafts: checklist.exitRuleDrafts,
    bases: checklist.exitRuleBases,
    fallbackTimeframe: (index) => {
      if (timeframes.length >= 2) {
        return timeframes[Math.min(index + 1, timeframes.length - 1)] ?? timeframes[0] ?? defaultTimeframe
      }
      return timeframes[0] ?? defaultTimeframe
    },
  })
  const risk = buildDrafts({
    phase: 'risk',
    rules: checklist.riskRuleDrafts?.map(draft => draft.text),
    drafts: checklist.riskRuleDrafts,
    fallbackTimeframe: () => defaultTimeframe,
  })

  return { entry, exit, risk }
}

export function resolveRulePhaseDefaultTimeframe(
  drafts: StrategyRuleDraft[],
  fallbackTimeframe: string | null,
): string | null {
  for (const draft of drafts) {
    const timeframe = normalizeTimeframe(draft.timeframe)
    if (timeframe) {
      return timeframe
    }
  }
  return normalizeTimeframe(fallbackTimeframe)
}

export function resolveRequiredRuleTimeframes(
  drafts: StrategyRuleDraftCollection,
  fallbackTimeframe: string | null,
): string[] {
  const ordered = new Set<string>()
  for (const draft of [...drafts.entry, ...drafts.exit, ...drafts.risk]) {
    const timeframe = normalizeTimeframe(draft.timeframe)
    if (timeframe) {
      ordered.add(timeframe)
    }
  }

  const normalizedFallback = normalizeTimeframe(fallbackTimeframe)
  if (normalizedFallback) {
    ordered.add(normalizedFallback)
  }

  return [...ordered]
}
