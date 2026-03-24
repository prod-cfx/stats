import type { SignalDirection, SignalType } from '@ai/shared'
import type { MarketType } from '@/modules/trading/core/types'

export type FixedHyperliquidPreset
  = 'open-spot'
    | 'close-spot'
    | 'open-close-spot-roundtrip'
    | 'open-perp'
    | 'close-perp'
    | 'open-close-roundtrip'

export interface FixedHyperliquidCliStep {
  marketType: MarketType
  signalType: SignalType
  direction: SignalDirection
  reason: string
  entryPrice?: string
  positionSizeQuote?: string
  execute: boolean
}

export interface FixedHyperliquidCliPlan {
  mode: 'single' | 'preset'
  preset?: FixedHyperliquidPreset
  steps: FixedHyperliquidCliStep[]
}

interface ParsedArgs {
  marketType: MarketType
  signalType: SignalType
  direction: SignalDirection
  reason?: string
  entryPrice?: string
  positionSizeQuote?: string
  execute: boolean
  preset?: FixedHyperliquidPreset
}

export function parseFixedHyperliquidTestnetCliOptions(argv: string[]): FixedHyperliquidCliPlan {
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
    marketType: (args.get('--market') ?? 'perp') as MarketType,
    signalType: (args.get('--signal-type') ?? 'ENTRY') as SignalType,
    direction: (args.get('--direction') ?? 'BUY') as SignalDirection,
    reason: args.get('--reason') ?? undefined,
    entryPrice: args.get('--entry-price'),
    positionSizeQuote: args.get('--position-size-quote'),
    execute,
    preset: args.get('--preset') as FixedHyperliquidPreset | undefined,
  }
}

function buildSingleStep(parsed: ParsedArgs): FixedHyperliquidCliStep {
  return {
    marketType: parsed.marketType,
    signalType: parsed.signalType,
    direction: parsed.direction,
    reason: parsed.reason ?? `fixed-hyperliquid-${parsed.marketType}-${parsed.direction.toLowerCase()}`,
    entryPrice: parsed.entryPrice,
    positionSizeQuote: parsed.positionSizeQuote,
    execute: parsed.execute,
  }
}

function buildPresetPlan(parsed: ParsedArgs): FixedHyperliquidCliPlan {
  const preset = parsed.preset as FixedHyperliquidPreset

  switch (preset) {
    case 'open-spot':
      return presetPlan(preset, [
        presetStep({
          marketType: 'spot',
          signalType: 'ENTRY',
          direction: 'BUY',
          reason: parsed.reason ?? 'fixed-hyperliquid-open-spot',
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
          reason: parsed.reason ?? 'fixed-hyperliquid-close-spot',
          entryPrice: parsed.entryPrice,
        }),
      ])
    case 'open-close-spot-roundtrip':
      return presetPlan(preset, [
        presetStep({
          marketType: 'spot',
          signalType: 'ENTRY',
          direction: 'BUY',
          reason: parsed.reason ? `${parsed.reason}-open` : 'fixed-hyperliquid-spot-roundtrip-open',
          entryPrice: parsed.entryPrice,
          positionSizeQuote: parsed.positionSizeQuote,
        }),
        presetStep({
          marketType: 'spot',
          signalType: 'EXIT',
          direction: 'CLOSE_LONG',
          reason: parsed.reason ? `${parsed.reason}-close` : 'fixed-hyperliquid-spot-roundtrip-close',
        }),
      ])
    case 'open-perp':
      return presetPlan(preset, [
        presetStep({
          marketType: 'perp',
          signalType: 'ENTRY',
          direction: 'BUY',
          reason: parsed.reason ?? 'fixed-hyperliquid-open-perp',
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
          reason: parsed.reason ?? 'fixed-hyperliquid-close-perp',
          entryPrice: parsed.entryPrice,
        }),
      ])
    case 'open-close-roundtrip':
      return presetPlan(preset, [
        presetStep({
          marketType: 'perp',
          signalType: 'ENTRY',
          direction: 'BUY',
          reason: parsed.reason ? `${parsed.reason}-open` : 'fixed-hyperliquid-roundtrip-open',
          entryPrice: parsed.entryPrice,
          positionSizeQuote: parsed.positionSizeQuote,
        }),
        presetStep({
          marketType: 'perp',
          signalType: 'EXIT',
          direction: 'CLOSE_LONG',
          reason: parsed.reason ? `${parsed.reason}-close` : 'fixed-hyperliquid-roundtrip-close',
        }),
      ])
  }
}

function presetPlan(preset: FixedHyperliquidPreset, steps: FixedHyperliquidCliStep[]): FixedHyperliquidCliPlan {
  return {
    mode: 'preset',
    preset,
    steps,
  }
}

function presetStep(step: Omit<FixedHyperliquidCliStep, 'execute'>): FixedHyperliquidCliStep {
  return {
    ...step,
    execute: true,
  }
}
