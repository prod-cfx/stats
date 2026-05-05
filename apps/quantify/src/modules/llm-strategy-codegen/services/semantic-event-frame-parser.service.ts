import type { SemanticEventAction, SemanticEventFrame, SemanticEventTrigger } from '../types/semantic-event-frame'
import { Injectable } from '@nestjs/common'

type ParsedAction = {
  action: SemanticEventAction
  phase: SemanticEventFrame['phase']
  sideScope: SemanticEventFrame['sideScope']
}

type CrossContext = {
  frameId: string
  trigger: SemanticEventTrigger
}

@Injectable()
export class SemanticEventFrameParserService {
  parse(input: string): SemanticEventFrame[] {
    const frames: SemanticEventFrame[] = []
    let lastCross: CrossContext | undefined

    for (const evidenceText of this.toEventClauses(input)) {
      const action = this.parseAction(evidenceText)
      if (!action) continue

      const parsedTrigger = this.parseTrigger(evidenceText, lastCross?.trigger)
      if (!parsedTrigger) continue

      const id = `event-frame-${frames.length + 1}`
      const frame: SemanticEventFrame = {
        id,
        phase: action.phase,
        sideScope: action.sideScope,
        evidenceText,
        trigger: parsedTrigger.trigger,
        action: action.action,
      }

      if (parsedTrigger.inherited && lastCross) {
        frame.inheritedFrom = lastCross.frameId
      }

      frames.push(frame)
      lastCross = { frameId: id, trigger: parsedTrigger.trigger }
    }

    return frames
  }

  private toEventClauses(input: string): string[] {
    return input
      .split(/[；;。]/u)
      .flatMap(sentence => this.expandCompactCrosses(sentence).split(/[，,]/u))
      .map(clause => clause.trim())
      .filter(clause => clause.length > 0)
  }

  private expandCompactCrosses(sentence: string): string {
    return sentence.replace(
      /(MACD\s*)金叉(买入|买|开多|做多)死叉(卖出|卖|平多)/giu,
      '$1金叉$2，$1死叉$3',
    )
  }

  private parseAction(clause: string): ParsedAction | undefined {
    if (/(平空|空头平仓)/u.test(clause)) {
      return {
        action: { kind: 'close_short' },
        phase: 'exit',
        sideScope: 'short',
      }
    }

    if (/(平多|多头平仓|卖出)/u.test(clause)) {
      return {
        action: { kind: 'close_long' },
        phase: 'exit',
        sideScope: 'long',
      }
    }

    if (/(做空|开空|卖空)/u.test(clause)) {
      return {
        action: { kind: 'open_short' },
        phase: 'entry',
        sideScope: 'short',
      }
    }

    if (/(开多|做多|买入|买)/u.test(clause)) {
      return {
        action: { kind: 'open_long' },
        phase: 'entry',
        sideScope: 'long',
      }
    }

    return undefined
  }

  private parseTrigger(
    clause: string,
    previousTrigger?: SemanticEventTrigger,
  ): { trigger: SemanticEventTrigger, inherited: boolean } | undefined {
    const direction = this.parseDirection(clause)
    if (!direction) return undefined

    const macdTrigger = this.parseMacdTrigger(clause, direction)
    if (macdTrigger) {
      return { trigger: macdTrigger, inherited: false }
    }

    const movingAverageTrigger = this.parseMovingAverageTrigger(clause, direction)
    if (movingAverageTrigger) {
      return { trigger: movingAverageTrigger, inherited: false }
    }

    if (previousTrigger) {
      return {
        trigger: {
          ...previousTrigger,
          direction,
          semantic: direction === 'over' ? 'cross_up' : 'cross_down',
        },
        inherited: true,
      }
    }

    return undefined
  }

  private parseDirection(clause: string): SemanticEventTrigger['direction'] | undefined {
    if (/(上穿|金叉)/u.test(clause)) return 'over'
    if (/(下穿|死叉)/u.test(clause)) return 'under'

    return undefined
  }

  private parseMacdTrigger(
    clause: string,
    direction: SemanticEventTrigger['direction'],
  ): SemanticEventTrigger | undefined {
    if (!/MACD/iu.test(clause)) return undefined

    return {
      kind: 'indicator_cross',
      indicator: 'macd',
      direction,
      semantic: direction === 'over' ? 'cross_up' : 'cross_down',
    }
  }

  private parseMovingAverageTrigger(
    clause: string,
    direction: SemanticEventTrigger['direction'],
  ): SemanticEventTrigger | undefined {
    const match = /\b(EMA|MA)\s*(\d+)\s*(?:上穿|下穿)\s*(EMA|MA)\s*(\d+)/iu.exec(clause)
      ?? /\b(EMA|MA)\s*(\d+)\s*(?:和|与|及|\/|、)\s*(EMA|MA)\s*(\d+)\s*(?:金叉|死叉)/iu.exec(clause)
    if (!match) return undefined

    const indicator = match[1].toLowerCase() === 'ema' || match[3].toLowerCase() === 'ema'
      ? 'ema'
      : 'ma'

    return {
      kind: 'indicator_cross',
      indicator,
      direction,
      semantic: direction === 'over' ? 'cross_up' : 'cross_down',
      fastPeriod: Number(match[2]),
      slowPeriod: Number(match[4]),
    }
  }
}
