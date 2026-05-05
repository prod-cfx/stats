# AI Quant Semantic Event Frame And Open Slot Answer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI Quant semantic understanding bind natural-language `trigger + action` events correctly and close grid density open slots from short user replies such as `20格`.

**Architecture:** Add a small deterministic semantic event layer before the existing atom patch path, and add a slot answer resolver at conversation-continue time. Keep `SemanticState`, support classification, contract readiness, projection gate, canonical spec, IR, AST, script generation, and runtime semantics unchanged.

**Tech Stack:** NestJS service classes, TypeScript, Jest unit tests, existing `dx test unit quantify` / Nx test target.

---

## File Structure

- Create `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-event-frame.ts`
  - Defines `SemanticEventFrame`, `SemanticEventTrigger`, and `SemanticEventAction`.
  - This is a pure type file. It must not import NestJS.
- Create `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-event-frame-parser.service.ts`
  - Parses user text into `trigger + action` frames.
  - Handles same-sentence multi-event parsing and omitted moving-average cross operands.
- Create `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-event-frame-projector.service.ts`
  - Converts event frames into `CodegenSemanticPatch`.
  - Reuses `SemanticSeedExtractorService` for non-frame semantics such as context, risk, position, grid, unsupported atoms.
- Create `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts`
  - Resolves short replies against existing open slots in a persisted `SemanticState`.
  - Updates original contract shape and returns an updated semantic state when it can close a slot.
- Create `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-clarification-question-renderer.service.ts`
  - Maps internal semantic slot keys to business-language question hints.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
  - Delegate event-frame-capable trigger/action extraction to the new projector.
  - Preserve current extraction for grid, risk, position, context, unsupported, and existing supported atoms.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  - Before treating a continue message as a new strategy patch, try `SemanticOpenSlotAnswerResolver`.
  - Apply rendered question hints to semantic clarification items.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts`
  - Use rendered question hint metadata for semantic open slots.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts`
  - Register the four new services.
- Add tests:
  - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-event-frame-parser.service.spec.ts`
  - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-event-frame-projector.service.spec.ts`
  - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts`
  - Extend `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`
  - Extend `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
  - Extend `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts`

## Task 1: Add Semantic Event Frame Types

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-event-frame.ts`

- [ ] **Step 1: Create the type file**

Use `apply_patch` to add:

```ts
export type SemanticEventPhase = 'entry' | 'exit'
export type SemanticEventSideScope = 'long' | 'short' | 'both'
export type SemanticEventTriggerKind = 'indicator_cross'
export type SemanticEventActionKind = 'open_long' | 'close_long' | 'open_short' | 'close_short'

export interface SemanticIndicatorCrossTrigger {
  kind: 'indicator_cross'
  indicator: 'ma' | 'ema' | 'macd' | 'moving_average'
  direction: 'over' | 'under'
  fastPeriod?: number
  slowPeriod?: number
  signalPeriod?: number
  semantic: 'cross_up' | 'cross_down'
}

export type SemanticEventTrigger = SemanticIndicatorCrossTrigger

export interface SemanticEventAction {
  kind: SemanticEventActionKind
}

export interface SemanticEventFrame {
  id: string
  trigger: SemanticEventTrigger
  action: SemanticEventAction
  sideScope: SemanticEventSideScope
  phase: SemanticEventPhase
  evidenceText: string
  inheritedFrom?: string
}
```

- [ ] **Step 2: Run type-aware test target**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
```

Expected: existing tests still pass or no tests are selected from this type-only change.

- [ ] **Step 3: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/semantic-event-frame.ts
git commit -F - <<'MSG'
feat: add semantic event frame types

Refs: #960
MSG
```

## Task 2: Build SemanticEventFrameParser

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-event-frame-parser.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-event-frame-parser.service.spec.ts`

- [ ] **Step 1: Write failing parser tests**

Add:

```ts
import { SemanticEventFrameParserService } from '../semantic-event-frame-parser.service'

describe('SemanticEventFrameParserService', () => {
  const service = new SemanticEventFrameParserService()

  it('inherits omitted moving-average operands for exit trigger wording', () => {
    const frames = service.parse('EMA7 上穿 EMA21 时开多；下穿时平多。')

    expect(frames).toEqual([
      expect.objectContaining({
        id: 'event-frame-1',
        phase: 'entry',
        sideScope: 'long',
        evidenceText: 'EMA7 上穿 EMA21 时开多',
        trigger: {
          kind: 'indicator_cross',
          indicator: 'ema',
          direction: 'over',
          semantic: 'cross_up',
          fastPeriod: 7,
          slowPeriod: 21,
        },
        action: { kind: 'open_long' },
      }),
      expect.objectContaining({
        id: 'event-frame-2',
        phase: 'exit',
        sideScope: 'long',
        evidenceText: '下穿时平多',
        inheritedFrom: 'event-frame-1',
        trigger: {
          kind: 'indicator_cross',
          indicator: 'ema',
          direction: 'under',
          semantic: 'cross_down',
          fastPeriod: 7,
          slowPeriod: 21,
        },
        action: { kind: 'close_long' },
      }),
    ])
  })

  it('splits MACD golden-cross buy and death-cross sell in one sentence', () => {
    const frames = service.parse('OKX 上用 BTC/USDT，1 小时 K，MACD 金叉买入死叉卖出。')

    expect(frames).toEqual([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        trigger: expect.objectContaining({
          kind: 'indicator_cross',
          indicator: 'macd',
          direction: 'over',
          semantic: 'cross_up',
        }),
        action: { kind: 'open_long' },
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        trigger: expect.objectContaining({
          kind: 'indicator_cross',
          indicator: 'macd',
          direction: 'under',
          semantic: 'cross_down',
        }),
        action: { kind: 'close_long' },
      }),
    ])
  })

  it('keeps explicit short entry and short exit actions', () => {
    const frames = service.parse('EMA7 下穿 EMA21 做空；EMA7 上穿 EMA21 平空。')

    expect(frames).toEqual([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        action: { kind: 'open_short' },
        trigger: expect.objectContaining({ direction: 'under' }),
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'short',
        action: { kind: 'close_short' },
        trigger: expect.objectContaining({ direction: 'over' }),
      }),
    ])
  })
})
```

- [ ] **Step 2: Run parser tests and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-event-frame-parser.service.spec.ts
```

Expected: FAIL because `semantic-event-frame-parser.service.ts` does not exist.

- [ ] **Step 3: Implement minimal parser**

Create `SemanticEventFrameParserService` with:

```ts
import { Injectable } from '@nestjs/common'
import type { SemanticEventAction, SemanticEventFrame, SemanticEventTrigger } from '../types/semantic-event-frame'

interface CrossContext {
  frameId: string
  indicator: 'ma' | 'ema' | 'macd' | 'moving_average'
  fastPeriod?: number
  slowPeriod?: number
  signalPeriod?: number
}

@Injectable()
export class SemanticEventFrameParserService {
  parse(message: string): SemanticEventFrame[] {
    const frames: SemanticEventFrame[] = []
    let lastCross: CrossContext | null = null

    for (const segment of this.splitSegments(message)) {
      for (const clause of this.splitEventClauses(segment)) {
        const trigger = this.parseCrossTrigger(clause, lastCross)
        const action = this.parseAction(clause)
        if (!trigger || !action) continue

        const id = `event-frame-${frames.length + 1}`
        const frame: SemanticEventFrame = {
          id,
          trigger,
          action,
          phase: action.kind.startsWith('open_') ? 'entry' : 'exit',
          sideScope: action.kind.endsWith('_short') ? 'short' : 'long',
          evidenceText: clause,
          ...(trigger.kind === 'indicator_cross' && this.isInheritedCross(clause, trigger, lastCross)
            ? { inheritedFrom: lastCross?.frameId }
            : {}),
        }
        frames.push(frame)
        if (trigger.kind === 'indicator_cross') {
          lastCross = {
            frameId: id,
            indicator: trigger.indicator,
            fastPeriod: trigger.fastPeriod,
            slowPeriod: trigger.slowPeriod,
            signalPeriod: trigger.signalPeriod,
          }
        }
      }
    }

    return frames
  }

  private splitSegments(message: string): string[] {
    return message
      .split(/[；;。]/u)
      .map(segment => segment.trim())
      .filter(Boolean)
  }

  private splitEventClauses(segment: string): string[] {
    const expanded = segment
      .replace(/(MACD\s*金叉\s*(?:买入|做多|开多))(死叉\s*(?:卖出|平多|平仓))/giu, '$1，MACD $2')
      .replace(/((?:EMA|MA)\s*\d{1,4}\s*(?:上穿|下穿)\s*(?:EMA|MA)\s*\d{1,4}\s*(?:时)?\s*(?:开多|做多|买入|开空|做空))\s*((?:上穿|下穿)\s*(?:时)?\s*(?:平多|平空|卖出|平仓))/giu, '$1，$2')
    return expanded
      .split(/[，,]/u)
      .map(clause => clause.trim())
      .filter(Boolean)
  }

  private parseCrossTrigger(clause: string, lastCross: CrossContext | null): SemanticEventTrigger | null {
    const normalized = clause.replace(/\s+/gu, '')
    const direction = /上穿|金叉|crossover/iu.test(normalized)
      ? 'over'
      : (/下穿|死叉|crossunder/iu.test(normalized) ? 'under' : null)
    if (!direction) return null

    const macdParams = this.parseMacdParams(clause)
    if (/MACD|DIF|DEA/iu.test(clause) || (lastCross?.indicator === 'macd' && /金叉|死叉/u.test(clause))) {
      return {
        kind: 'indicator_cross',
        indicator: 'macd',
        direction,
        semantic: direction === 'over' ? 'cross_up' : 'cross_down',
        ...(macdParams ?? {}),
      }
    }

    const refs = Array.from(normalized.matchAll(/(EMA|MA)(\d{1,4})/giu))
    const indicator = refs.some(match => match[1]?.toUpperCase() === 'EMA') ? 'ema' : (lastCross?.indicator ?? 'ma')
    const periods = refs.map(match => Number(match[2])).filter(Number.isFinite)
    const fastPeriod = periods[0] ?? lastCross?.fastPeriod
    const slowPeriod = periods[1] ?? lastCross?.slowPeriod
    if (!fastPeriod || !slowPeriod) return null

    return {
      kind: 'indicator_cross',
      indicator: indicator === 'macd' ? 'ma' : indicator,
      direction,
      semantic: direction === 'over' ? 'cross_up' : 'cross_down',
      fastPeriod,
      slowPeriod,
    }
  }

  private parseAction(clause: string): SemanticEventAction | null {
    if (/买回平空|平空|买回空单/u.test(clause)) return { kind: 'close_short' }
    if (/平多|卖出平多|卖出多单|卖出|平仓/u.test(clause)) return { kind: 'close_long' }
    if (/做空|开空|空单|short/u.test(clause)) return { kind: 'open_short' }
    if (/开多|做多|买入|long/u.test(clause)) return { kind: 'open_long' }
    return null
  }

  private parseMacdParams(clause: string): { fastPeriod: number; slowPeriod: number; signalPeriod: number } | null {
    const match = clause.match(/MACD\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*\/\s*(\d{1,3})/iu)
    if (!match?.[1] || !match[2] || !match[3]) return null
    return {
      fastPeriod: Number(match[1]),
      slowPeriod: Number(match[2]),
      signalPeriod: Number(match[3]),
    }
  }

  private isInheritedCross(clause: string, trigger: SemanticEventTrigger, lastCross: CrossContext | null): boolean {
    return trigger.kind === 'indicator_cross'
      && lastCross !== null
      && !/(?:EMA|MA)\s*\d{1,4}/iu.test(clause)
      && trigger.indicator === lastCross.indicator
  }
}
```

- [ ] **Step 4: Run parser tests and verify pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-event-frame-parser.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/semantic-event-frame.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-event-frame-parser.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-event-frame-parser.service.spec.ts
git commit -F - <<'MSG'
feat: parse semantic trigger action frames

Refs: #960
MSG
```

## Task 3: Project Event Frames Into Semantic Patch

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-event-frame-projector.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-event-frame-projector.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`

- [ ] **Step 1: Write failing projector tests**

Add:

```ts
import { SemanticEventFrameParserService } from '../semantic-event-frame-parser.service'
import { SemanticEventFrameProjectorService } from '../semantic-event-frame-projector.service'

describe('SemanticEventFrameProjectorService', () => {
  const parser = new SemanticEventFrameParserService()
  const service = new SemanticEventFrameProjectorService()

  it('projects inherited EMA frames into trigger and action atoms', () => {
    const frames = parser.parse('EMA7 上穿 EMA21 时开多；下穿时平多。')
    const patch = service.project(frames)

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.cross_over',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({ indicator: 'ema', fastPeriod: 7, slowPeriod: 21 }),
      }),
      expect.objectContaining({
        key: 'indicator.cross_under',
        phase: 'exit',
        sideScope: 'long',
        params: expect.objectContaining({ indicator: 'ema', fastPeriod: 7, slowPeriod: 21 }),
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
      expect.objectContaining({ key: 'close_long' }),
    ]))
  })

  it('projects MACD one-sentence frames into separate entry and exit atoms', () => {
    const frames = parser.parse('MACD 金叉买入死叉卖出。')
    const patch = service.project(frames)

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.cross_over',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({ indicator: 'macd' }),
      }),
      expect.objectContaining({
        key: 'indicator.cross_under',
        phase: 'exit',
        sideScope: 'long',
        params: expect.objectContaining({ indicator: 'macd' }),
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
      expect.objectContaining({ key: 'close_long' }),
    ]))
  })
})
```

- [ ] **Step 2: Run projector tests and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-event-frame-projector.service.spec.ts
```

Expected: FAIL because the projector service does not exist.

- [ ] **Step 3: Implement projector**

Add:

```ts
import { Injectable } from '@nestjs/common'
import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import type { SemanticEventFrame } from '../types/semantic-event-frame'

@Injectable()
export class SemanticEventFrameProjectorService {
  project(frames: readonly SemanticEventFrame[]): CodegenSemanticPatch {
    const triggers: NonNullable<CodegenSemanticPatch['triggers']> = []
    const actions: NonNullable<CodegenSemanticPatch['actions']> = []
    const seenActions = new Set<string>()

    for (const [index, frame] of frames.entries()) {
      if (frame.trigger.kind !== 'indicator_cross') continue
      triggers.push({
        id: `event-trigger-${index + 1}`,
        key: frame.trigger.direction === 'over' ? 'indicator.cross_over' : 'indicator.cross_under',
        phase: frame.phase,
        sideScope: frame.sideScope,
        params: {
          indicator: frame.trigger.indicator,
          semantic: frame.trigger.semantic,
          ...(frame.trigger.fastPeriod !== undefined ? { fastPeriod: frame.trigger.fastPeriod } : {}),
          ...(frame.trigger.slowPeriod !== undefined ? { slowPeriod: frame.trigger.slowPeriod } : {}),
          ...(frame.trigger.signalPeriod !== undefined ? { signalPeriod: frame.trigger.signalPeriod } : {}),
        },
        evidence: { text: frame.evidenceText, source: 'user_explicit' },
      })

      const actionKey = frame.action.kind
      if (!seenActions.has(actionKey)) {
        seenActions.add(actionKey)
        actions.push({ key: actionKey })
      }
    }

    return {
      ...(triggers.length > 0 ? { triggers } : {}),
      ...(actions.length > 0 ? { actions } : {}),
    }
  }
}
```

- [ ] **Step 4: Run projector tests and verify pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-event-frame-projector.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Integrate projector into seed extractor**

Modify `SemanticSeedExtractorService` constructor and `extract` flow:

```ts
constructor(
  private readonly positionSizingContracts: PositionSizingContractService = new PositionSizingContractService(),
  private readonly eventFrameParser: SemanticEventFrameParserService = new SemanticEventFrameParserService(),
  private readonly eventFrameProjector: SemanticEventFrameProjectorService = new SemanticEventFrameProjectorService(),
) {}
```

In `extract`, before current trigger/action extraction:

```ts
const eventFrames = this.eventFrameParser.parse(text)
const eventPatch = this.eventFrameProjector.project(eventFrames)
const triggers = this.atomizeTriggers(this.mergeSeedTriggers(
  eventPatch.triggers ?? [],
  this.extractTriggers(text, aliasContext),
))
const actions = this.atomizeActions(this.mergeSeedActions(
  eventPatch.actions ?? [],
  this.extractActions(text, triggers),
))
```

Add private helpers:

```ts
private mergeSeedTriggers(left: SeedTrigger[], right: SeedTrigger[]): SeedTrigger[] {
  const merged: SeedTrigger[] = []
  const seen = new Set<string>()
  for (const trigger of [...left, ...right]) {
    const signature = JSON.stringify({
      key: trigger.key,
      phase: trigger.phase,
      sideScope: trigger.sideScope ?? null,
      params: trigger.params ?? {},
    })
    if (seen.has(signature)) continue
    seen.add(signature)
    merged.push(trigger)
  }
  return merged
}

private mergeSeedActions(left: SeedAction[], right: SeedAction[]): SeedAction[] {
  const merged: SeedAction[] = []
  const seen = new Set<string>()
  for (const action of [...left, ...right]) {
    const signature = JSON.stringify({ key: action.key, params: action.params ?? {} })
    if (seen.has(signature)) continue
    seen.add(signature)
    merged.push(action)
  }
  return merged
}
```

Also import the two new services.

- [ ] **Step 6: Extend extractor regression tests**

Add cases to `semantic-seed-extractor.service.spec.ts`:

```ts
it('extracts omitted EMA cross-under exit from prior trigger context', () => {
  const patch = service.extract('EMA7 上穿 EMA21 时开多；下穿时平多。')

  expect(patch.triggers).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'indicator.cross_over',
      phase: 'entry',
      sideScope: 'long',
      params: expect.objectContaining({ indicator: 'ema', fastPeriod: 7, slowPeriod: 21 }),
    }),
    expect.objectContaining({
      key: 'indicator.cross_under',
      phase: 'exit',
      sideScope: 'long',
      params: expect.objectContaining({ indicator: 'ema', fastPeriod: 7, slowPeriod: 21 }),
    }),
  ]))
  expect(patch.actions).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'open_long' }),
    expect.objectContaining({ key: 'close_long' }),
  ]))
})

it('extracts MACD golden-cross buy and death-cross sell as separate events', () => {
  const patch = service.extract('OKX 上用 BTC/USDT，1 小时 K，MACD 金叉买入死叉卖出。')

  expect(patch.contextSlots).toEqual(expect.objectContaining({
    exchange: 'okx',
    symbol: 'BTCUSDT',
    timeframe: '1h',
  }))
  expect(patch.triggers).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'indicator.cross_over',
      phase: 'entry',
      sideScope: 'long',
      params: expect.objectContaining({ indicator: 'macd' }),
    }),
    expect.objectContaining({
      key: 'indicator.cross_under',
      phase: 'exit',
      sideScope: 'long',
      params: expect.objectContaining({ indicator: 'macd' }),
    }),
  ]))
  expect(patch.actions).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'open_long' }),
    expect.objectContaining({ key: 'close_long' }),
  ]))
})
```

- [ ] **Step 7: Run event and extractor tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-event-frame-parser.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-event-frame-projector.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-event-frame-projector.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-event-frame-projector.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
git commit -F - <<'MSG'
feat: project semantic frames into atom patch

Refs: #960
MSG
```

## Task 4: Add Business Clarification Question Renderer

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-clarification-question-renderer.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-clarification-question-renderer.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-shape-normalizer.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts`

- [ ] **Step 1: Write failing renderer tests**

Add:

```ts
import { SemanticClarificationQuestionRendererService } from '../semantic-clarification-question-renderer.service'

describe('SemanticClarificationQuestionRendererService', () => {
  const service = new SemanticClarificationQuestionRendererService()

  it('renders grid density slot in business language', () => {
    expect(service.render({
      slotKey: 'contract.shape.price.level_set.density',
      fallback: '请补充价格层级集合的密度或修正冲突配置。',
    })).toBe('请确认网格数量或每格间距，例如 20 格 / 每格 100 USDT / 每格 0.5%。')
  })

  it('renders grid spacing conflict in business language', () => {
    expect(service.render({
      slotKey: 'contract.shape.price.level_set.spacing_conflict',
      fallback: '请补充价格层级集合的密度或修正冲突配置。',
    })).toBe('网格数量和每格间距与当前价格区间不一致，请确认保留网格数量还是每格间距。')
  })

  it('keeps existing fallback for known non-grid slots', () => {
    expect(service.render({
      slotKey: 'position.sizing',
      fallback: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
    })).toBe('请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。')
  })
})
```

- [ ] **Step 2: Run renderer tests and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-clarification-question-renderer.service.spec.ts
```

Expected: FAIL because service does not exist.

- [ ] **Step 3: Implement renderer**

Add:

```ts
import { Injectable } from '@nestjs/common'

export interface RenderSemanticClarificationQuestionInput {
  slotKey: string
  fallback: string
}

const BUSINESS_QUESTION_BY_SLOT_KEY: Record<string, string> = {
  'contract.shape.price.level_set.density': '请确认网格数量或每格间距，例如 20 格 / 每格 100 USDT / 每格 0.5%。',
  'contract.shape.price.level_set.spacing_conflict': '网格数量和每格间距与当前价格区间不一致，请确认保留网格数量还是每格间距。',
  'contract.requirement.price.define.level_set': '请补充网格价格区间和网格数量或每格间距。',
}

@Injectable()
export class SemanticClarificationQuestionRendererService {
  render(input: RenderSemanticClarificationQuestionInput): string {
    return BUSINESS_QUESTION_BY_SLOT_KEY[input.slotKey] ?? input.fallback
  }
}
```

- [ ] **Step 4: Update shape normalizer question hints**

In `SemanticContractShapeNormalizerService.toOpenSlot`, change:

```ts
questionHint: slotKey === DENSITY_SLOT_KEY
  ? '请确认网格数量或每格间距，例如 20 格 / 每格 100 USDT / 每格 0.5%。'
  : '网格数量和每格间距与当前价格区间不一致，请确认保留网格数量还是每格间距。',
```

- [ ] **Step 5: Use renderer in clarification rules**

Inject renderer into `StrategyClarificationRulesService` constructor:

```ts
constructor(
  private readonly semanticQuestionRenderer: SemanticClarificationQuestionRendererService = new SemanticClarificationQuestionRendererService(),
) {}
```

In `fromAtomicAmbiguities`, replace `question: ambiguity.question ?? ambiguity.message` with:

```ts
question: this.semanticQuestionRenderer.render({
  slotKey,
  fallback: ambiguity.question ?? ambiguity.message,
}),
```

For `atomic_semantic_fork` paths with slotKey, wrap `ambiguity.question ?? this.renderAtomicForkQuestion(ambiguity)` the same way.

- [ ] **Step 6: Run clarification tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-clarification-question-renderer.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-shape-normalizer.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts
```

Expected: PASS. If existing readiness tests assert the old text, update only those expectations to the new business text.

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-clarification-question-renderer.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-clarification-question-renderer.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-shape-normalizer.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-shape-normalizer.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts
git commit -F - <<'MSG'
feat: render semantic slot questions in business language

Refs: #960
MSG
```

## Task 5: Resolve Open Slot Answers

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts`

- [ ] **Step 1: Write failing resolver tests**

Add:

```ts
import type { SemanticState } from '../../types/semantic-state'
import { SemanticOpenSlotAnswerResolverService } from '../semantic-open-slot-answer-resolver.service'

function createGridState(): SemanticState {
  return {
    version: 1,
    families: [],
    triggers: [{
      id: 'planner-trigger-1',
      key: 'grid.range_rebalance',
      phase: 'entry',
      sideScope: 'both',
      params: { rangeLower: 79200, rangeUpper: 80200, sideMode: 'bidirectional' },
      status: 'open',
      source: 'user_explicit',
      openSlots: [{
        slotKey: 'contract.shape.price.level_set.density',
        fieldPath: trigger.openSlots.find(slot => slot.slotKey === DENSITY_SLOT_KEY || slot.slotKey === SPACING_CONFLICT_SLOT_KEY)?.fieldPath
          ?? 'triggers[planner-trigger-1].contracts[contract-grid-fixed-levels].capabilities[price.define.level_set].shape',
        status: 'open',
        priority: 'core',
        questionHint: '请确认网格数量或每格间距，例如 20 格 / 每格 100 USDT / 每格 0.5%。',
        affectsExecution: true,
      }],
      contracts: [{
        id: 'contract-grid-fixed-levels',
        kind: 'trigger',
        capabilities: [{
          domain: 'price',
          verb: 'define',
          object: 'level_set',
          shape: { mode: 'fixed_range', lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
        }],
        requires: [],
        params: {},
      }],
    }],
    actions: [],
    risk: [],
    position: null,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-05T00:00:00.000Z',
  }
}

describe('SemanticOpenSlotAnswerResolverService', () => {
  const service = new SemanticOpenSlotAnswerResolverService()

  it('closes grid density slot from grid count answer', () => {
    const result = service.resolve({ state: createGridState(), message: '20格' })

    expect(result.resolved).toBe(true)
    const trigger = result.state.triggers[0]
    expect(trigger.openSlots).toEqual([])
    expect(trigger.contracts?.[0]?.capabilities[0]?.shape).toEqual(expect.objectContaining({
      gridCount: 20,
    }))
  })

  it('closes grid density slot from percent spacing answer', () => {
    const result = service.resolve({ state: createGridState(), message: '每格 0.5%' })

    expect(result.resolved).toBe(true)
    expect(result.state.triggers[0].contracts?.[0]?.capabilities[0]?.shape).toEqual(expect.objectContaining({
      spacingPct: 0.5,
    }))
  })

  it('keeps conflict slot when grid count and absolute spacing disagree', () => {
    const result = service.resolve({ state: createGridState(), message: '20格，每格100 USDT' })

    expect(result.resolved).toBe(true)
    expect(result.state.triggers[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'contract.shape.price.level_set.spacing_conflict',
        questionHint: '网格数量和每格间距与当前价格区间不一致，请确认保留网格数量还是每格间距。',
      }),
    ])
  })

  it('returns unresolved for unrelated short answer', () => {
    const result = service.resolve({ state: createGridState(), message: '随便吧' })

    expect(result.resolved).toBe(false)
    expect(result.state).toEqual(createGridState())
  })
})
```

- [ ] **Step 2: Run resolver tests and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts
```

Expected: FAIL because resolver service does not exist.

- [ ] **Step 3: Implement resolver**

Add:

```ts
import { Injectable } from '@nestjs/common'
import type { SemanticCapabilityShape, SemanticSlotState, SemanticState, SemanticTriggerState } from '../types/semantic-state'
import { SemanticContractShapeNormalizerService } from './semantic-contract-shape-normalizer.service'

const DENSITY_SLOT_KEY = 'contract.shape.price.level_set.density'
const SPACING_CONFLICT_SLOT_KEY = 'contract.shape.price.level_set.spacing_conflict'

export interface ResolveSemanticOpenSlotAnswerInput {
  state: SemanticState
  message: string
}

export interface ResolveSemanticOpenSlotAnswerResult {
  resolved: boolean
  state: SemanticState
}

@Injectable()
export class SemanticOpenSlotAnswerResolverService {
  constructor(
    private readonly shapeNormalizer: SemanticContractShapeNormalizerService = new SemanticContractShapeNormalizerService(),
  ) {}

  resolve(input: ResolveSemanticOpenSlotAnswerInput): ResolveSemanticOpenSlotAnswerResult {
    const density = this.parseGridDensityAnswer(input.message)
    if (!density) return { resolved: false, state: input.state }

    let changed = false
    const triggers = input.state.triggers.map((trigger) => {
      if (!this.hasOpenSlot(trigger.openSlots, DENSITY_SLOT_KEY) && !this.hasOpenSlot(trigger.openSlots, SPACING_CONFLICT_SLOT_KEY)) {
        return trigger
      }
      const next = this.applyGridDensity(trigger, density)
      changed = changed || next !== trigger
      return next
    })

    return changed
      ? { resolved: true, state: { ...input.state, triggers, updatedAt: new Date().toISOString() } }
      : { resolved: false, state: input.state }
  }

  private applyGridDensity(
    trigger: SemanticTriggerState,
    density: Partial<Record<'gridCount' | 'gridIntervals' | 'absoluteSpacing' | 'spacingPct', number>>,
  ): SemanticTriggerState {
    const contracts = trigger.contracts?.map(contract => ({
      ...contract,
      capabilities: contract.capabilities.map((capability) => {
        if (capability.domain !== 'price' || capability.verb !== 'define' || capability.object !== 'level_set') {
          return capability
        }
        return {
          ...capability,
          shape: this.normalizeDensityShape({
            ...capability.shape,
            ...density,
            ...(density.gridIntervals !== undefined ? { gridCount: density.gridIntervals + 1 } : {}),
          }),
        }
      }),
    }))
    if (!contracts) return trigger

    const shape = contracts[0]?.capabilities[0]?.shape
    const normalized = shape
      ? this.shapeNormalizer.normalizeLevelSetShape(shape, {
          requireDensity: true,
          fieldPath: 'triggers[planner-trigger-1].contracts[contract-grid-fixed-levels].capabilities[price.define.level_set].shape',
        })
      : null
    const openSlots = normalized?.status === 'conflict'
      ? [this.buildSpacingConflictSlot(
          trigger.openSlots.find(slot => slot.slotKey === DENSITY_SLOT_KEY || slot.slotKey === SPACING_CONFLICT_SLOT_KEY)?.fieldPath ?? 'shape',
        )]
      : []

    return {
      ...trigger,
      contracts,
      openSlots,
      status: openSlots.length === 0 ? 'locked' : 'open',
    }
  }

  private normalizeDensityShape(shape: SemanticCapabilityShape): SemanticCapabilityShape {
    return Object.fromEntries(
      Object.entries(shape).filter(([, value]) => value !== undefined),
    ) as SemanticCapabilityShape
  }

  private parseGridDensityAnswer(message: string): Partial<Record<'gridCount' | 'gridIntervals' | 'absoluteSpacing' | 'spacingPct', number>> | null {
    const density: Partial<Record<'gridCount' | 'gridIntervals' | 'absoluteSpacing' | 'spacingPct', number>> = {}
    const gridCount = this.matchNumber(message, [
      /网格(?:数量|数)?\s*[:：]?\s*(\d{1,4})\s*(?:格|个)?/u,
      /(\d{1,4})\s*(?:格|个网格)/u,
    ])
    const gridIntervals = this.matchNumber(message, [
      /(\d{1,4})\s*(?:个)?(?:间隔|区间|段)/u,
    ])
    const absoluteSpacing = this.matchNumber(message, [
      /每格(?:价格)?(?:间距|距离)?\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:USDT|USDC|USD|U|u)?/u,
      /间距\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:USDT|USDC|USD|U|u)?/u,
    ])
    const spacingPct = this.matchNumber(message, [
      /每格(?:间距|距离)?\s*[:：]?\s*(\d+(?:\.\d+)?)\s*%/u,
      /步长\s*[:：]?\s*(\d+(?:\.\d+)?)\s*%/u,
    ])

    if (gridCount !== null) density.gridCount = gridCount
    if (gridIntervals !== null) density.gridIntervals = gridIntervals
    if (spacingPct !== null) density.spacingPct = spacingPct
    else if (absoluteSpacing !== null && !/%/u.test(message)) density.absoluteSpacing = absoluteSpacing

    return Object.keys(density).length > 0 ? density : null
  }

  private matchNumber(message: string, patterns: RegExp[]): number | null {
    for (const pattern of patterns) {
      const match = message.match(pattern)
      if (!match?.[1]) continue
      const value = Number(match[1])
      if (Number.isFinite(value) && value > 0) return value
    }
    return null
  }

  private hasOpenSlot(slots: readonly SemanticSlotState[], slotKey: string): boolean {
    return slots.some(slot => slot.slotKey === slotKey && slot.status === 'open')
  }

  private buildSpacingConflictSlot(fieldPath: string): SemanticSlotState {
    return {
      slotKey: SPACING_CONFLICT_SLOT_KEY,
      fieldPath,
      status: 'open',
      priority: 'core',
      questionHint: '网格数量和每格间距与当前价格区间不一致，请确认保留网格数量还是每格间距。',
      affectsExecution: true,
    }
  }
}
```

- [ ] **Step 4: Run resolver tests and verify pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts
git commit -F - <<'MSG'
feat: resolve semantic open slot answers

Refs: #960
MSG
```

## Task 6: Integrate Open Slot Resolver Into Conversation Continue

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Add conversation regression test**

Add a test near existing semantic open slot tests:

```ts
it('semantic open slot answer regression: 20格 closes grid density instead of repeating the same question', async () => {
  const initialMessage = '15m 周期，价格区间 79200-80200，采用双向网格'
  mockAi.chat.mockResolvedValueOnce({
    content: JSON.stringify({
      related: true,
      logicReady: false,
      assistantPrompt: '请确认网格数量或每格间距，例如 20 格 / 每格 100 USDT / 每格 0.5%。',
      semanticPatch: new SemanticSeedExtractorService().extract(initialMessage),
    }),
  })
  mockRepo.createSession.mockResolvedValue({ id: 's-grid-density-slot' })

  await service.startSession({ userId: 'u1', initialMessage } as StartCodegenSessionDto)
  const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
  mockRepo.findById.mockResolvedValue({
    id: 's-grid-density-slot',
    userId: 'u1',
    status: 'DRAFTING',
    checklist: null,
    semanticState: createPayload.semanticState,
    clarificationState: createPayload.clarificationState,
    constraintPack: createPayload.constraintPack ?? {},
    latestDraftCode: null,
    latestSpecDesc: null,
    consistencyReport: null,
    rejectReason: null,
    strategyInstanceId: null,
    createdAt: new Date('2026-05-05T00:00:00.000Z'),
    updatedAt: new Date('2026-05-05T00:00:00.000Z'),
  })
  mockRepo.updateSession.mockResolvedValue(undefined)

  const result = await service.continueSession('s-grid-density-slot', {
    userId: 'u1',
    message: '20格',
  } as ContinueCodegenSessionDto)
  const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>

  expect(result.assistantPrompt).not.toContain('价格层级集合')
  expect(result.assistantPrompt).not.toContain('请确认网格数量或每格间距')
  expect(updatePayload.semanticState.triggers).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'grid.range_rebalance',
      openSlots: [],
      contracts: expect.arrayContaining([
        expect.objectContaining({
          capabilities: expect.arrayContaining([
            expect.objectContaining({
              domain: 'price',
              verb: 'define',
              object: 'level_set',
              shape: expect.objectContaining({ gridCount: 20 }),
            }),
          ]),
        }),
      ]),
    }),
  ]))
})
```

- [ ] **Step 2: Run conversation test and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "20格 closes grid density"
```

Expected: FAIL because continue flow does not call the resolver.

- [ ] **Step 3: Register services in module**

In `llm-strategy-codegen.module.ts`, import and add to providers:

```ts
import { SemanticClarificationQuestionRendererService } from './services/semantic-clarification-question-renderer.service'
import { SemanticEventFrameParserService } from './services/semantic-event-frame-parser.service'
import { SemanticEventFrameProjectorService } from './services/semantic-event-frame-projector.service'
import { SemanticOpenSlotAnswerResolverService } from './services/semantic-open-slot-answer-resolver.service'
```

Add providers:

```ts
SemanticClarificationQuestionRendererService,
SemanticEventFrameParserService,
SemanticEventFrameProjectorService,
SemanticOpenSlotAnswerResolverService,
```

- [ ] **Step 4: Inject resolver into conversation service**

Add constructor dependency near semantic services:

```ts
private readonly semanticOpenSlotAnswerResolver: SemanticOpenSlotAnswerResolverService = new SemanticOpenSlotAnswerResolverService(),
```

Import the resolver service.

- [ ] **Step 5: Add continue-session resolver hook**

In `continueSession`, immediately after `currentSemanticState = unsupportedFallbackOutcome.semanticState` and before `if (unsupportedFallbackOutcome.response)`, add:

```ts
const openSlotResolution = this.tryResolveSemanticOpenSlotAnswer({
  session,
  semanticState: currentSemanticState,
  message: dto.message,
  userId: sessionUserId,
})
if (openSlotResolution) {
  return openSlotResolution
}
```

Add private helper:

```ts
private async tryResolveSemanticOpenSlotAnswer(input: {
  session: PersistedConversationSessionForContinue
  semanticState: SemanticState | null
  message: string
  userId: string
}): Promise<CodegenSessionResponseDto | null> {
  if (!input.semanticState) {
    return null
  }
  const resolved = this.semanticOpenSlotAnswerResolver.resolve({
    state: input.semanticState,
    message: input.message,
  })
  if (!resolved.resolved) {
    return null
  }

  const semanticState = this.normalizeSemanticContractReadiness(resolved.state)
  const clarificationArtifacts = this.resolveSemanticClarificationArtifacts(semanticState)
  const clarificationState = clarificationArtifacts.clarificationState
  const view = this.semanticStateProjection.buildClarificationView(semanticState)
  const assistantPrompt = view.nextQuestion
    ? `我已记录：${input.message.trim()}。请继续确认：${view.nextQuestion}`
    : '我已记录这项配置，当前策略语义槽位已更新。'
  const constraintPack = this.readConstraintPack(input.session.constraintPack)
  const conversationHistory = this.appendConversationHistory(
    constraintPack.conversationHistory ?? [],
    input.message,
    assistantPrompt,
  )

  await this.sessionsRepo.updateSession(input.session.id, this.stateMachine.buildConversationUpdate({
    status: 'DRAFTING',
    semanticState,
    clarificationState,
    constraintPack: {
      ...constraintPack,
      conversationHistory,
    },
  }))

  const response = this.finalizeSessionResponse({
    id: input.session.id,
    status: 'DRAFTING',
    missingFields: [],
    assistantPrompt,
    clarificationState,
  })
  return this.returnPersistedSessionResponse(input.session.id, input.userId, response)
}
```

Do not add a new DTO for this helper. It should use the existing private `PersistedConversationSessionForContinue` interface in `codegen-conversation.service.ts`.

- [ ] **Step 6: Run targeted conversation test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "20格 closes grid density"
```

Expected: PASS.

- [ ] **Step 7: Run semantic conversation tests around open slots**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "20格 closes grid density"
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "position contract regression"
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "pending unsupported fallback"
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -F - <<'MSG'
feat: close semantic open slots from user replies

Refs: #960
MSG
```

## Task 7: Add Atom Coverage Golden Cases

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atom-coverage-golden-corpus.spec.ts`

- [ ] **Step 1: Add golden cases**

Add cases:

```ts
{
  name: 'event frame omitted ema exit',
  message: 'OKX 合约 BTCUSDT 15m，EMA7 上穿 EMA21 时开多；下穿时平多；单笔 10%。',
  expectedKeys: ['indicator.cross_over', 'indicator.cross_under', 'open_long', 'close_long', 'position.fixed_pct'],
  expectedRoute: 'projection_gate',
},
{
  name: 'event frame macd one sentence entry exit',
  message: 'OKX 合约 BTCUSDT 1h，MACD 金叉买入死叉卖出；单笔 10%。',
  expectedKeys: ['indicator.cross_over', 'indicator.cross_under', 'open_long', 'close_long', 'position.fixed_pct'],
  expectedRoute: 'projection_gate',
},
{
  name: 'grid missing density business slot',
  message: 'OKX 合约 BTCUSDT 15m，价格区间 79200-80200，采用双向网格，单笔 10%。',
  expectedKeys: ['grid.range_rebalance', 'open_long', 'close_long', 'open_short', 'close_short', 'position.fixed_pct', 'open_slot:contract.shape.price.level_set.density'],
  expectedRoute: 'open_slots',
}
```

- [ ] **Step 2: Run golden corpus**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atom-coverage-golden-corpus.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts
git commit -F - <<'MSG'
test: cover semantic event frame golden cases

Refs: #960
MSG
```

## Task 8: Verification Sweep

**Files:**
- No new files.
- Verify all touched code paths.

- [ ] **Step 1: Run focused semantic tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-event-frame-parser.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-event-frame-projector.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-clarification-question-renderer.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atom-coverage-golden-corpus.spec.ts
```

Expected: all PASS.

- [ ] **Step 2: Run conversation regression tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "20格 closes grid density"
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "position contract regression"
```

Expected: all selected tests PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
dx lint
```

Expected: PASS.

- [ ] **Step 4: Run quantify build**

Run:

```bash
dx build quantify --dev
```

Expected: PASS.

- [ ] **Step 5: Final commit if verification adjusted files**

If verification required test expectation or formatting changes:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen
git commit -F - <<'MSG'
test: verify semantic event frame mainflow

Refs: #960
MSG
```

If no files changed, do not create an empty commit.

## Self-Review

- Spec coverage: event-frame parsing is covered by Tasks 1-3; open slot answer closure is covered by Tasks 5-6; business-language questions are covered by Task 4; golden corpus and verification are covered by Tasks 7-8.
- Placeholder scan: this plan contains no TBD markers, deferred implementation notes, or unspecified test commands.
- Type consistency: `SemanticEventFrame`, `SemanticEventTrigger`, `SemanticEventAction`, parser, projector, resolver, and renderer names are consistent across tasks.
- Scope check: implementation is limited to `apps/quantify/src/modules/llm-strategy-codegen`; canonical spec, IR, AST, script generation, runtime, and trading execution stay unchanged.
