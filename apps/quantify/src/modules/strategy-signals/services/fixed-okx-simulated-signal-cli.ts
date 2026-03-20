import type { SignalDirection, SignalType } from '@/prisma/prisma.types'
import type { MarketType } from '@/modules/trading/core/types'

export type FixedOkxPreset =
  | 'open-spot'
  | 'close-spot'
  | 'open-perp'
  | 'close-perp'
  | 'open-close-roundtrip'

export interface FixedOkxCliStep {
  marketType: MarketType
  signalType: SignalType
  direction: SignalDirection
  reason: string
  entryPrice?: string
  positionSizeQuote?: string
  execute: boolean
}

export interface FixedOkxCliPlan {
  mode: 'single' | 'preset'
  preset?: FixedOkxPreset
  steps: FixedOkxCliStep[]
}

type ParsedArgs = {
  marketType: MarketType
  signalType: SignalType
  direction: SignalDirection
  reason?: string
  entryPrice?: string
  positionSizeQuote?: string
  execute: boolean
  preset?: FixedOkxPreset
}

export function parseFixedOkxSimulatedCliOptions(argv: string[]): FixedOkxCliPlan {
  const parsed = parseRawArgs(argv)
  if (!parsed.preset) {
    return {
      mode: 'single',
      steps: [buildSingleStep(parsed)],
    }
  }

  return buildPresetPlan(parsed)
}

function parseRawArgs(argv: string[]): ParsedArgs {
  const args = new Map<string, string>()
  let execute = false

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (current === '--execute') {
      execute = true
      continue
    }
    if (!current.startsWith('--')) {
      continue
    }

    const next = argv[index + 1]
    if (next && !next.startsWith('--')) {
      args.set(current, next)
      index += 1
    }
  }

  return {
    marketType: (args.get('--market') ?? 'spot') as MarketType,
    signalType: (args.get('--signal-type') ?? 'ENTRY') as SignalType,
    direction: (args.get('--direction') ?? 'BUY') as SignalDirection,
    reason: args.get('--reason') ?? undefined,
    entryPrice: args.get('--entry-price'),
    positionSizeQuote: args.get('--position-size-quote'),
    execute,
    preset: args.get('--preset') as FixedOkxPreset | undefined,
  }
}

function buildSingleStep(parsed: ParsedArgs): FixedOkxCliStep {
  const reason = parsed.reason ?? `fixed-okx-${parsed.marketType}-${parsed.direction.toLowerCase()}`

  return {
    marketType: parsed.marketType,
    signalType: parsed.signalType,
    direction: parsed.direction,
    reason,
    entryPrice: parsed.entryPrice,
    positionSizeQuote: parsed.positionSizeQuote,
    execute: parsed.execute,
  }
}

function buildPresetPlan(parsed: ParsedArgs): FixedOkxCliPlan {
  const market = parsed.marketType
  const preset = parsed.preset as FixedOkxPreset

  switch (preset) {
    case 'open-spot':
      return presetPlan(preset, [
        presetStep({
          marketType: 'spot',
          signalType: 'ENTRY',
          direction: 'BUY',
          reason: parsed.reason ?? 'fixed-okx-open-spot',
          entryPrice: parsed.entryPrice,
          positionSizeQuote: parsed.positionSizeQuote,
        }),
      ])
    case 'close-spot':
      return presetPlan(preset, [
        presetStep({
          marketType: 'spot',
          signalType: 'EXIT',
          direction: 'CLOSE_LONG',
          reason: parsed.reason ?? 'fixed-okx-close-spot',
          entryPrice: parsed.entryPrice,
        }),
      ])
    case 'open-perp':
      return presetPlan(preset, [
        presetStep({
          marketType: 'perp',
          signalType: 'ENTRY',
          direction: 'BUY',
          reason: parsed.reason ?? 'fixed-okx-open-perp',
          entryPrice: parsed.entryPrice,
          positionSizeQuote: parsed.positionSizeQuote,
        }),
      ])
    case 'close-perp':
      return presetPlan(preset, [
        presetStep({
          marketType: 'perp',
          signalType: 'EXIT',
          direction: 'CLOSE_LONG',
          reason: parsed.reason ?? 'fixed-okx-close-perp',
          entryPrice: parsed.entryPrice,
        }),
      ])
    case 'open-close-roundtrip':
      return presetPlan(preset, [
        presetStep({
          marketType: market,
          signalType: 'ENTRY',
          direction: 'BUY',
          reason: parsed.reason ? `${parsed.reason}-open` : `fixed-okx-${market}-roundtrip-open`,
          entryPrice: parsed.entryPrice,
          positionSizeQuote: parsed.positionSizeQuote,
        }),
        presetStep({
          marketType: market,
          signalType: 'EXIT',
          direction: 'CLOSE_LONG',
          reason: parsed.reason ? `${parsed.reason}-close` : `fixed-okx-${market}-roundtrip-close`,
        }),
      ])
  }
}

function presetPlan(preset: FixedOkxPreset, steps: FixedOkxCliStep[]): FixedOkxCliPlan {
  return {
    mode: 'preset',
    preset,
    steps,
  }
}

function presetStep(step: Omit<FixedOkxCliStep, 'execute'>): FixedOkxCliStep {
  return {
    ...step,
    execute: true,
  }
}
