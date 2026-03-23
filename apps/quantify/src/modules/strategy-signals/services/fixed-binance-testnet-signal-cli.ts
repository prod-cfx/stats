import type { MarketType } from '@/modules/trading/core/types'
import type { SignalDirection, SignalType } from '@/prisma/prisma.types'

export type FixedBinancePreset =
  | 'open-spot'
  | 'close-spot'
  | 'open-perp'
  | 'close-perp'
  | 'open-close-roundtrip'

export interface FixedBinanceCliStep {
  marketType: MarketType
  signalType: SignalType
  direction: SignalDirection
  reason: string
  entryPrice?: string
  positionSizeQuote?: string
  execute: boolean
}

export interface FixedBinanceCliPlan {
  mode: 'single' | 'preset'
  preset?: FixedBinancePreset
  steps: FixedBinanceCliStep[]
}

interface ParsedArgs {
  marketType: MarketType
  signalType: SignalType
  direction: SignalDirection
  reason?: string
  entryPrice?: string
  positionSizeQuote?: string
  execute: boolean
  preset?: FixedBinancePreset
}

export function parseFixedBinanceTestnetCliOptions(argv: string[]): FixedBinanceCliPlan {
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
    preset: args.get('--preset') as FixedBinancePreset | undefined,
  }
}

function buildSingleStep(parsed: ParsedArgs): FixedBinanceCliStep {
  const reason = parsed.reason ?? `fixed-binance-${parsed.marketType}-${parsed.direction.toLowerCase()}`

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

function buildPresetPlan(parsed: ParsedArgs): FixedBinanceCliPlan {
  const market = parsed.marketType
  const preset = parsed.preset as FixedBinancePreset

  switch (preset) {
    case 'open-spot':
      return presetPlan(preset, [
        presetStep({
          marketType: 'spot',
          signalType: 'ENTRY',
          direction: 'BUY',
          reason: parsed.reason ?? 'fixed-binance-open-spot',
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
          reason: parsed.reason ?? 'fixed-binance-close-spot',
          entryPrice: parsed.entryPrice,
        }),
      ])
    case 'open-perp':
      return presetPlan(preset, [
        presetStep({
          marketType: 'perp',
          signalType: 'ENTRY',
          direction: 'BUY',
          reason: parsed.reason ?? 'fixed-binance-open-perp',
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
          reason: parsed.reason ?? 'fixed-binance-close-perp',
          entryPrice: parsed.entryPrice,
        }),
      ])
    case 'open-close-roundtrip':
      return presetPlan(preset, [
        presetStep({
          marketType: market,
          signalType: 'ENTRY',
          direction: 'BUY',
          reason: parsed.reason ? `${parsed.reason}-open` : `fixed-binance-${market}-roundtrip-open`,
          entryPrice: parsed.entryPrice,
          positionSizeQuote: parsed.positionSizeQuote,
        }),
        presetStep({
          marketType: market,
          signalType: 'EXIT',
          direction: 'CLOSE_LONG',
          reason: parsed.reason ? `${parsed.reason}-close` : `fixed-binance-${market}-roundtrip-close`,
        }),
      ])
  }
}

function presetPlan(preset: FixedBinancePreset, steps: FixedBinanceCliStep[]): FixedBinanceCliPlan {
  return {
    mode: 'preset',
    preset,
    steps,
  }
}

function presetStep(step: Omit<FixedBinanceCliStep, 'execute'>): FixedBinanceCliStep {
  return {
    ...step,
    execute: true,
  }
}
