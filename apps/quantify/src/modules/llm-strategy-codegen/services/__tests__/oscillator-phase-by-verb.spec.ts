/**
 * oscillator-phase-by-verb.spec.ts
 *
 * Requirement-driven tests for Issue #1219:
 * oscillator / threshold trigger 的 phase 与 sideScope 必须由子句动词决定，
 * 与阈值方向（低于 / 高于 / 超买 / 超卖）解耦。
 *
 * 覆盖（限于当前 SemanticSeedExtractor 实际支持的 RSI 范围；
 * KDJ / ADX extractor 尚未实现，已拆到后续 issue（待创建，跟踪 KDJ/ADX oscillator 支持），这里不做断言）：
 * - RSI: 低于+开多 / 高于+开空 / 高于+平多 / 低于+平空
 * - Case 0 utterance: 多触发 AND 串联场景下 RSI 子句仍为 entry/long
 * - 子句无动词时 phase/sideScope 跟随父级（不再用阈值方向兜底）
 */
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'

type SeedTrigger = NonNullable<ReturnType<SemanticSeedExtractorService['extract']>['triggers']>[number]

let extractor: SemanticSeedExtractorService

beforeEach(() => {
  extractor = new SemanticSeedExtractorService()
})

function extractTriggers(message: string): SeedTrigger[] {
  const patch = extractor.extract(message)
  return patch.triggers ?? []
}

function findOscillatorTrigger(triggers: SeedTrigger[], keyPattern: RegExp): SeedTrigger | undefined {
  return triggers.find(t => keyPattern.test(t.key))
}

describe('oscillator/threshold trigger phase 由子句动词决定（Issue #1219）', () => {
  it('[#1] RSI14 低于 35 开多 → entry/long（不是 exit）', () => {
    const triggers = extractTriggers('RSI14 低于 35 开多')
    const rsi = findOscillatorTrigger(triggers, /rsi/i)
    expect(rsi).toBeDefined()
    expect(rsi!.phase).toBe('entry')
    expect(rsi!.sideScope).toBe('long')
  })

  it('[#2] RSI14 高于 70 开空 → entry/short（不是 exit）', () => {
    const triggers = extractTriggers('RSI14 高于 70 开空')
    const rsi = findOscillatorTrigger(triggers, /rsi/i)
    expect(rsi).toBeDefined()
    expect(rsi!.phase).toBe('entry')
    expect(rsi!.sideScope).toBe('short')
  })

  it('[#3] RSI14 高于 70 平多 → exit/long', () => {
    const triggers = extractTriggers('RSI14 高于 70 平多')
    const rsi = findOscillatorTrigger(triggers, /rsi/i)
    expect(rsi).toBeDefined()
    expect(rsi!.phase).toBe('exit')
    expect(rsi!.sideScope).toBe('long')
  })

  it('[#4] RSI14 低于 30 平空 → exit/short', () => {
    const triggers = extractTriggers('RSI14 低于 30 平空')
    const rsi = findOscillatorTrigger(triggers, /rsi/i)
    expect(rsi).toBeDefined()
    expect(rsi!.phase).toBe('exit')
    expect(rsi!.sideScope).toBe('short')
  })

  it('[#5] Case 0 utterance：多触发 AND 串联，RSI 子句仍为 entry/long phase', () => {
    const triggers = extractTriggers(
      'MA20 上穿 MA50 且 RSI14 低于 35 且 EMA7 上穿 EMA21 开多',
    )
    const rsi = findOscillatorTrigger(triggers, /rsi/i)
    expect(rsi).toBeDefined()
    expect(rsi!.phase).toBe('entry')
    expect(rsi!.sideScope).toBe('long')
  })

  it('[#6] RSI14 低于 35（子句无动词）+ segment 含 开多 → 跟随父级 entry/long，不被阈值方向兜底为 exit', () => {
    const triggers = extractTriggers('开多条件：RSI14 低于 35')
    const rsi = findOscillatorTrigger(triggers, /rsi/i)
    expect(rsi).toBeDefined()
    expect(rsi!.phase).toBe('entry')
    expect(rsi!.sideScope).toBe('long')
  })

  it('[#7] RSI14 高于 70（子句无动词）+ segment 含 开空 → 跟随父级 entry/short，不被阈值方向兜底为 exit', () => {
    const triggers = extractTriggers('开空条件：RSI14 高于 70')
    const rsi = findOscillatorTrigger(triggers, /rsi/i)
    expect(rsi).toBeDefined()
    expect(rsi!.phase).toBe('entry')
    expect(rsi!.sideScope).toBe('short')
  })

  it('[#8] RSI14 高于 70 卖出（裸卖出）→ exit/long regression 兜底', () => {
    const triggers = extractTriggers('RSI14 高于 70 卖出')
    const rsi = findOscillatorTrigger(triggers, /rsi/i)
    expect(rsi).toBeDefined()
    expect(rsi!.phase).toBe('exit')
    expect(rsi!.sideScope).toBe('long')
  })

  it('[#9] RSI14 做空仓位达到止损点 → exit/short（exit 动词优先于 short-side entry）', () => {
    const triggers = extractTriggers('RSI14 低于 50 做空仓位达到止损点')
    const rsi = findOscillatorTrigger(triggers, /rsi/i)
    expect(rsi).toBeDefined()
    expect(rsi!.phase).toBe('exit')
    expect(rsi!.sideScope).toBe('short')
  })

  it('[#10] RSI14 低于 40（clause 无动词）且 segment 也无动词 → trigger 被整体跳过（intent=null）', () => {
    const triggers = extractTriggers('RSI14 低于 40')
    const rsi = findOscillatorTrigger(triggers, /rsi/i)
    // 无动词时 intent=null → pushRsiTriggers 中 continue，trigger 不产出
    expect(rsi).toBeUndefined()
  })

  it('[#11] RSI14 高于 70 做空条件下平仓 → exit/short（平仓 + 空头线索）', () => {
    const triggers = extractTriggers('做空条件：RSI14 高于 70 平仓')
    const rsi = findOscillatorTrigger(triggers, /rsi/i)
    expect(rsi).toBeDefined()
    expect(rsi!.phase).toBe('exit')
    expect(rsi!.sideScope).toBe('short')
  })

  it('[#12] segment 含 开多策略，clause 含 平空 → clause 动词优先，phase=exit/short', () => {
    const triggers = extractTriggers('开多策略：RSI14 高于 70 平空')
    const rsi = findOscillatorTrigger(triggers, /rsi/i)
    expect(rsi).toBeDefined()
    expect(rsi!.phase).toBe('exit')
    expect(rsi!.sideScope).toBe('short')
  })
})
