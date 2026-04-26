import { Injectable } from '@nestjs/common'
import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import { canonicalizeStrategySymbolInput } from './market-scope-equivalence'

type SeedTrigger = NonNullable<CodegenSemanticPatch['triggers']>[number]
type SeedAction = NonNullable<CodegenSemanticPatch['actions']>[number]

@Injectable()
export class SemanticSeedExtractorService {
  extract(message?: string): CodegenSemanticPatch {
    const text = this.normalizeText(message)
    if (!text) {
      return {}
    }

    const contextSlots = this.extractContextSlots(text)
    const triggers = this.extractTriggers(text)
    const actions = this.extractActions(text, triggers)
    const risk = this.extractRisk(text)
    const position = this.extractPosition(text, triggers)

    const patch: CodegenSemanticPatch = {}

    if (Object.keys(contextSlots).length > 0) {
      patch.contextSlots = contextSlots
    }
    if (triggers.length > 0) {
      patch.triggers = triggers
    }
    if (actions.length > 0) {
      patch.actions = actions
    }
    if (risk.length > 0) {
      patch.risk = risk
    }
    if (position) {
      patch.position = position
    }

    return patch
  }

  private extractContextSlots(text: string): NonNullable<CodegenSemanticPatch['contextSlots']> {
    const contextSlots: NonNullable<CodegenSemanticPatch['contextSlots']> = {}

    const exchange = this.extractExchange(text)
    if (exchange) {
      contextSlots.exchange = exchange
    }

    const marketType = this.extractMarketType(text)
    if (marketType) {
      contextSlots.marketType = marketType
    }

    const symbol = this.extractSymbol(text)
    if (symbol) {
      contextSlots.symbol = symbol
    }

    const timeframe = this.extractFirstTimeframe(text)
    if (timeframe) {
      contextSlots.timeframe = timeframe
    }

    return contextSlots
  }

  private extractTriggers(text: string): SeedTrigger[] {
    const triggers: SeedTrigger[] = []
    const seen = new Set<string>()
    const segments = this.splitSegments(text)

    for (const segment of segments) {
      this.pushMovingAverageCrossTrigger(segment, triggers, seen)
      this.pushMovingAverageTrigger(segment, triggers, seen)
      this.pushBollingerTriggers(segment, triggers, seen)
      this.pushRsiTriggers(segment, triggers, seen)
      this.pushMacdTriggers(segment, triggers, seen, text)
      this.pushBreakoutTriggers(segment, triggers, seen)
      this.pushRangePositionTriggers(segment, triggers, seen, text)
      this.pushGridTrigger(segment, triggers, seen)
      this.pushExecutionTrigger(segment, triggers, seen)
      this.pushPercentChangeTrigger(segment, triggers, seen, text)
    }

    return triggers
  }

  private extractActions(text: string, triggers: SeedTrigger[]): NonNullable<CodegenSemanticPatch['actions']> {
    const actions: SeedAction[] = []
    const seen = new Set<string>()
    const push = (key: string, params?: Record<string, unknown>) => {
      const action: SeedAction = params ? { key, params } : { key }
      const signature = JSON.stringify(action)
      if (seen.has(signature)) return
      seen.add(signature)
      actions.push(action)
    }
    const hasShortTrigger = triggers.some(trigger => trigger.sideScope === 'short')
    const hasLongTrigger = triggers.some(trigger => trigger.sideScope === 'long')

    for (const trigger of triggers) {
      if (trigger.key === 'grid.range_rebalance') {
        push('open_long')
        push('close_long')
        push('open_short')
        push('close_short')
        continue
      }

      if (trigger.phase === 'entry') {
        if (trigger.sideScope === 'short') {
          push('open_short')
        } else if (trigger.sideScope === 'long') {
          push('open_long')
        } else if (trigger.sideScope === 'both') {
          push('open_long')
          push('open_short')
        }
        continue
      }

      if (trigger.phase === 'exit') {
        if (trigger.sideScope === 'short') {
          push('close_short')
        } else if (trigger.sideScope === 'long') {
          push('close_long')
        } else if (trigger.sideScope === 'both') {
          push('close_long')
          push('close_short')
        }
      }
    }

    if (actions.length === 0 && (hasShortTrigger || hasLongTrigger)) {
      push('open_long')
    }

    return actions
  }

  private extractRisk(text: string): NonNullable<CodegenSemanticPatch['risk']> {
    const risk: NonNullable<CodegenSemanticPatch['risk']> = []

    const stopLoss = this.extractPercent(text, [
      /亏损\s*(\d+(?:\.\d+)?)\s*%/u,
      /亏损\s*百分之?\s*(\d+(?:\.\d+)?)/u,
      /止损\s*(\d+(?:\.\d+)?)\s*%/u,
      /止损\s*百分之?\s*(\d+(?:\.\d+)?)/u,
      /(\d+(?:\.\d+)?)\s*%\s*(?:止损|亏损)/u,
      /百分之?\s*(\d+(?:\.\d+)?)\s*(?:止损|亏损)/u,
    ])
    if (stopLoss !== null) {
      risk.push({
        key: 'risk.stop_loss_pct',
        params: {
          valuePct: stopLoss,
          basis: this.resolveRiskBasis(text),
        },
      })
    }

    const takeProfit = this.extractPercent(text, [
      /盈利\s*(\d+(?:\.\d+)?)\s*%/u,
      /盈利(?:达到|达|到)\s*(\d+(?:\.\d+)?)\s*%/u,
      /盈利\s*百分之?\s*(\d+(?:\.\d+)?)/u,
      /止盈\s*(\d+(?:\.\d+)?)\s*%/u,
      /止盈\s*百分之?\s*(\d+(?:\.\d+)?)/u,
      /(\d+(?:\.\d+)?)\s*%\s*(?:止盈|盈利)/u,
      /百分之?\s*(\d+(?:\.\d+)?)\s*(?:止盈|盈利)/u,
    ])
    if (takeProfit !== null) {
      risk.push({
        key: 'risk.take_profit_pct',
        params: {
          valuePct: takeProfit,
          basis: this.resolveRiskBasis(text),
        },
      })
    }

    return risk
  }

  private extractPosition(
    text: string,
    triggers: SeedTrigger[],
  ): NonNullable<CodegenSemanticPatch['position']> | null {
    const percent = this.extractPercent(text, [
      /单笔\s*(\d+(?:\.\d+)?)\s*%/u,
      /单笔\s*(?:使用|用|投入)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:资金|仓位)?/u,
      /单笔\s*(?:使用|用|投入)?\s*百分之?\s*(\d+(?:\.\d+)?)\s*(?:资金|仓位)?/u,
      /仓位\s*(\d+(?:\.\d+)?)\s*%/u,
      /仓位\s*百分之?\s*(\d+(?:\.\d+)?)/u,
      /(\d+(?:\.\d+)?)\s*%\s*(?:固定)?\s*仓位/u,
      /(\d+(?:\.\d+)?)\s*%\s*仓位/u,
      /(\d+(?:\.\d+)?)\s*%\s*资金/u,
      /百分之?\s*(\d+(?:\.\d+)?)\s*(?:仓位|资金)/u,
      /每笔\s*(\d+(?:\.\d+)?)\s*%/u,
      /每笔\s*百分之?\s*(\d+(?:\.\d+)?)/u,
    ])

    if (percent === null) {
      return null
    }

    return {
      mode: 'fixed_ratio',
      value: percent / 100,
      positionMode: this.resolvePositionMode(text, triggers),
    }
  }

  private pushMovingAverageTrigger(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    const clauses = segment.includes('，') || segment.includes(',')
      ? segment.split(/[，,]/u).map(clause => clause.trim()).filter(Boolean)
      : [segment]

    for (const clause of clauses) {
      const subClauses = clause.includes('且') || clause.includes('并且') || clause.includes('同时') || clause.includes('并')
        ? clause.split(/(?:且|并且|同时|并)/u).map(part => part.trim()).filter(Boolean)
        : [clause]

      for (const subClause of subClauses) {
        if (/布林|bollinger|上轨|下轨|中轨/iu.test(subClause)) continue
        if (!/(?:MA|EMA)\s*\d+|均线/u.test(subClause)) continue
        if (this.isTrueMovingAverageCrossClause(subClause)?.isCross) continue
        const referencePeriods = Array.from(subClause.matchAll(/(?:MA|EMA)\s*(\d{1,4})/giu))
          .map(match => Number(match[1]))
          .filter(value => Number.isFinite(value))
        if (referencePeriods.length === 0) {
          const fallbackPeriod = this.extractNumber(subClause, [/均线\s*(\d{1,4})/u])
          if (fallbackPeriod === null) continue
          referencePeriods.push(fallbackPeriod)
        }

        const intent = this.resolveTradeIntent(subClause) ?? this.resolveTradeIntent(clause)
        if (!intent) continue

        const confirmationMode = this.extractConfirmationMode(subClause)
        const indicator = /\bEMA\s*\d+/iu.test(subClause) ? 'ema' : 'ma'
        const key = /突破|上穿|站上|高于/u.test(subClause)
          ? 'indicator.above'
          : (/跌破|下穿|失守|低于/u.test(subClause) ? 'indicator.below' : null)
        if (!key) continue

        for (const referencePeriod of referencePeriods) {
          this.pushTrigger(triggers, seen, {
            key,
            phase: intent.phase,
            sideScope: intent.sideScope,
            params: {
              indicator,
              referenceRole: referencePeriod >= 20 ? 'long_term' : 'short_term',
              'reference.period': referencePeriod,
              ...(confirmationMode ? { confirmationMode } : {}),
            },
          })
        }
      }
    }
  }

  private pushBollingerTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/布林带/u.test(segment)) return

    const clauses = segment.includes('，') || segment.includes(',')
      ? segment.split(/[，,]/u).map(clause => clause.trim()).filter(Boolean)
      : [segment]
    const segmentBandParams = this.extractBollingerBandParams(segment)

    for (const clause of clauses) {
      const bandParams = this.extractBollingerBandParams(clause) ?? segmentBandParams
      const confirmationMode = this.extractConfirmationMode(clause) ?? this.extractConfirmationMode(segment)
      const intent = this.resolveTradeIntent(clause)

      if (/上轨/u.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'bollinger.touch_upper',
          phase: intent?.phase ?? 'entry',
          sideScope: intent?.sideScope ?? 'short',
          params: {
            band: 'upper',
            ...(bandParams?.period !== undefined ? { period: bandParams.period } : {}),
            ...(bandParams?.stdDev !== undefined ? { stdDev: bandParams.stdDev } : {}),
            ...(confirmationMode ? { confirmationMode } : {}),
          },
        })
      }

      if (/下轨/u.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'bollinger.touch_lower',
          phase: intent?.phase ?? 'entry',
          sideScope: intent?.sideScope ?? 'long',
          params: {
            band: 'lower',
            ...(bandParams?.period !== undefined ? { period: bandParams.period } : {}),
            ...(bandParams?.stdDev !== undefined ? { stdDev: bandParams.stdDev } : {}),
            ...(confirmationMode ? { confirmationMode } : {}),
          },
        })
      }

      if (/中轨/u.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'bollinger.touch_middle',
          phase: 'exit',
          sideScope: this.resolveBollingerMiddleSideScope(clause),
          params: {
            band: 'middle',
            ...(bandParams?.period !== undefined ? { period: bandParams.period } : {}),
            ...(bandParams?.stdDev !== undefined ? { stdDev: bandParams.stdDev } : {}),
            ...(confirmationMode ? { confirmationMode } : {}),
          },
        })
      }
    }
  }

  private resolveBollingerMiddleSideScope(clause: string): 'long' | 'short' | 'both' {
    if (/平空|买回空单|买回平空|做空.*平仓|空单.*平仓/u.test(clause)) return 'short'
    if (/平多|卖出多单|卖出平多|做多.*平仓|多单.*平仓/u.test(clause)) return 'long'
    return 'both'
  }

  private pushMovingAverageCrossTrigger(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    const clauses = segment.includes('，') || segment.includes(',')
      ? segment.split(/[，,]/u).map(clause => clause.trim()).filter(Boolean)
      : [segment]

    for (const clause of clauses) {
      const cross = this.parseMovingAverageCrossClause(clause)
      if (!cross) continue

      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      if (cross.direction === 'up') {
        this.pushTrigger(triggers, seen, {
          key: 'indicator.cross_over',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            indicator: cross.indicator,
            ...(cross.fastPeriod !== undefined ? { fastPeriod: cross.fastPeriod } : {}),
            ...(cross.slowPeriod !== undefined ? { slowPeriod: cross.slowPeriod } : {}),
          },
        })
      }

      if (cross.direction === 'down') {
        this.pushTrigger(triggers, seen, {
          key: 'indicator.cross_under',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            indicator: cross.indicator,
            ...(cross.fastPeriod !== undefined ? { fastPeriod: cross.fastPeriod } : {}),
            ...(cross.slowPeriod !== undefined ? { slowPeriod: cross.slowPeriod } : {}),
          },
        })
      }
    }
  }

  private pushGridTrigger(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/网格/u.test(segment)) return

    const range = segment.match(/(\d+(?:\.\d+)?)\s*[-~到至]\s*(\d+(?:\.\d+)?)/u)
    const stepPct = this.extractPercent(segment, [
      /步长\s*(\d+(?:\.\d+)?)\s*%/u,
      /间距\s*(\d+(?:\.\d+)?)\s*%/u,
      /每一格\s*(?:间距|距离)?\s*(\d+(?:\.\d+)?)\s*%/u,
      /每格\s*(?:间距|距离)?\s*(\d+(?:\.\d+)?)\s*%/u,
      /千分之\s*(\d+(?:\.\d+)?)/u,
    ])

    if (!range?.[1] || !range[2] || stepPct === null) return

    this.pushTrigger(triggers, seen, {
      key: 'grid.range_rebalance',
      phase: 'entry',
      sideScope: /做空/u.test(segment) ? 'short' : (/做多/u.test(segment) ? 'long' : 'both'),
      params: {
        rangeLower: Number(range[1]),
        rangeUpper: Number(range[2]),
        stepPct,
        sideMode: /做空/u.test(segment)
          ? 'short_only'
          : (/做多/u.test(segment) ? 'long_only' : 'bidirectional'),
        recycle: true,
        breakoutAction: /停|暂停|停止/u.test(segment) ? 'pause' : 'continue',
      },
    })
  }

  private pushRsiTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/RSI/iu.test(segment)) return

    const clauses = this.splitLogicClauses(segment)
    const segmentPeriod = this.extractNumber(segment, [/RSI\s*(\d{1,3})/iu]) ?? 14

    for (const clause of clauses) {
      if (!/RSI/iu.test(clause)) continue
      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      const period = this.extractNumber(clause, [/RSI\s*(\d{1,3})/iu]) ?? segmentPeriod
      const threshold = this.extractRsiThreshold(clause, period)
      if (threshold === null) continue

      if (/上穿|穿回|向上/u.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'indicator.cross_over',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            indicator: 'rsi',
            period,
            value: threshold,
          },
        })
        continue
      }

      if (/下穿|跌破|向下/u.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'indicator.cross_under',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            indicator: 'rsi',
            period,
            value: threshold,
          },
        })
        continue
      }

      if (/高于|大于|超过|上方/u.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'oscillator.rsi_gte',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            period,
            value: threshold,
          },
        })
        continue
      }

      if (/低于|小于|下方/u.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'oscillator.rsi_lte',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            period,
            value: threshold,
          },
        })
      }
    }
  }

  private pushMacdTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    contextText: string,
  ): void {
    if (!/MACD|DIF|DEA/iu.test(segment)) return

    const clauses = this.splitLogicClauses(segment)
    const params = this.extractMacdParams(segment) ?? this.extractMacdParams(contextText)

    for (const clause of clauses) {
      if (!/MACD|DIF|DEA/iu.test(clause)) continue
      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      const direction = /上穿|金叉/iu.test(clause)
        ? 'over'
        : (/下穿|死叉/iu.test(clause) ? 'under' : null)
      if (!direction) continue

      this.pushTrigger(triggers, seen, {
        key: direction === 'over' ? 'indicator.cross_over' : 'indicator.cross_under',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: {
          indicator: 'macd',
          ...(params ? {
            fastPeriod: params.fastPeriod,
            slowPeriod: params.slowPeriod,
            signalPeriod: params.signalPeriod,
          } : {}),
        },
      })
    }
  }

  private pushBreakoutTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/最近\s*\d{1,4}\s*根\s*K\s*线/u.test(segment)) return
    if (!/突破|跌回|跌破|高点|低点/u.test(segment)) return

    for (const clause of this.splitLogicClauses(segment)) {
      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      const highPeriod = this.extractNumber(clause, [
        /(?:突破|升破|上破)\s*最近\s*(\d{1,4})\s*根\s*K\s*线(?:高点|最高|高位)/u,
        /最近\s*(\d{1,4})\s*根\s*K\s*线(?:高点|最高|高位).*?(?:突破|升破|上破)/u,
      ])
      if (highPeriod !== null) {
        const bufferPct = this.extractPercent(clause, [/突破缓冲\s*(\d+(?:\.\d+)?)\s*%/u])
          ?? this.extractPercent(segment, [/突破缓冲\s*(\d+(?:\.\d+)?)\s*%/u])
        this.pushTrigger(triggers, seen, {
          key: 'price.breakout_up',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            period: highPeriod,
            reference: 'channel_high',
            ...(bufferPct !== null ? { bufferPct } : {}),
          },
        })
        continue
      }

      const lowPeriod = this.extractNumber(clause, [
        /(?:跌回|跌破|下破|跌穿)\s*最近\s*(\d{1,4})\s*根\s*K\s*线(?:低点|最低|低位)/u,
        /最近\s*(\d{1,4})\s*根\s*K\s*线(?:低点|最低|低位).*?(?:跌回|跌破|下破|跌穿)/u,
      ])
      if (lowPeriod !== null) {
        this.pushTrigger(triggers, seen, {
          key: 'price.breakout_down',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            period: lowPeriod,
            reference: 'channel_low',
          },
        })
      }
    }
  }

  private pushRangePositionTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    contextText: string,
  ): void {
    if (!/区间/u.test(segment) || !/%/u.test(segment)) return

    const lookbackBars = this.extractNumber(segment, [/最近\s*(\d{1,4})\s*根\s*K\s*线区间/u])
      ?? this.extractNumber(contextText, [/最近\s*(\d{1,4})\s*根\s*K\s*线区间/u])
      ?? 20
    const intent = this.resolveTradeIntent(segment)
    if (!intent) return

    const lowerThreshold = this.extractPercent(segment, [
      /区间\s*下\s*(\d+(?:\.\d+)?)\s*%/u,
      /区间(?:低位|底部)\s*(\d+(?:\.\d+)?)\s*%/u,
    ])
    if (lowerThreshold !== null) {
      this.pushTrigger(triggers, seen, {
        key: 'price.range_position_lte',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: {
          lookbackBars,
          thresholdPct: lowerThreshold,
        },
      })
      return
    }

    const upperThreshold = this.extractPercent(segment, [
      /区间\s*上\s*(\d+(?:\.\d+)?)\s*%/u,
      /区间(?:高位|顶部)\s*(\d+(?:\.\d+)?)\s*%/u,
    ])
    if (upperThreshold !== null) {
      this.pushTrigger(triggers, seen, {
        key: 'price.range_position_gte',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: {
          lookbackBars,
          thresholdPct: upperThreshold,
        },
      })
    }
  }

  private pushExecutionTrigger(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/立即|立刻|马上|开始时|启动时|一开始/u.test(segment)) return
    if (!/市价|当前价/u.test(segment) || !/买入|卖出|开仓|平仓|做多|做空/u.test(segment)) return

    const intent = this.resolveTradeIntent(segment)
    if (!intent) return

    this.pushTrigger(triggers, seen, {
      key: 'execution.on_start',
      phase: intent.phase,
      sideScope: intent.sideScope,
      params: {
        timing: 'on_start',
        orderType: 'market',
        occurrence: 'once',
      },
    })
  }

  private pushPercentChangeTrigger(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    contextText: string = segment,
  ): void {
    const clauses = this.splitPercentChangeClauses(segment)
    if (clauses.length > 0 && (clauses.length > 1 || clauses[0] !== segment)) {
      for (const clause of clauses) {
        this.pushPercentChangeTrigger(clause, triggers, seen, contextText)
      }
      return
    }

    if (!/%|百分/u.test(segment)) return
    if (!this.hasExplicitPriceChangeContext(segment)) return
    const direction = this.resolvePercentDirection(segment)
    if (!direction) return

    const intent = this.resolveTradeIntent(segment)
    if (!intent) return

    const valuePct = this.extractPercent(segment, [/(\d+(?:\.\d+)?)\s*%/u, /百分之?\s*(\d+(?:\.\d+)?)/u])
    if (valuePct === null) return

    const basis = this.resolvePercentBasis(segment)
    const window = this.extractFirstTimeframe(segment) ?? this.extractFirstTimeframe(contextText)

    this.pushTrigger(triggers, seen, {
      key: 'price.percent_change',
      phase: intent.phase,
      sideScope: intent.sideScope,
      params: {
        direction,
        valuePct: direction === 'down' ? -Math.abs(valuePct) : Math.abs(valuePct),
        basis,
        ...(window ? { window } : {}),
      },
    })
  }

  private splitPercentChangeClauses(segment: string): string[] {
    const rawClauses = segment
      .split(/[，,、；;。]|(?:另有|另外|同时|并且|以及)/u)
      .map(clause => clause.trim())

    const clauses = rawClauses
      .filter(Boolean)
      .filter(clause => /%|百分/u.test(clause))
      .filter(clause => /(上涨|下跌|涨|跌|回落|回调|反弹)/u.test(clause))
      .filter(clause => /(买入|卖出|入场|出场|离场|开仓|平仓|平多|平空|做多|做空|开多|开空)/u.test(clause))
      .filter(clause => !/(止损|止盈|亏损|盈利)/u.test(clause))

    if (rawClauses.filter(Boolean).length > 1) {
      return clauses
    }

    const clausePattern = /\d{1,2}\s*(?:m|h|d|分钟|分|小时|时|天|日)[^；;。,，]*?(?:上涨|下跌|涨|跌)[^；;。,，]*?(?:\d+(?:\.\d+)?\s*%|百分之?\s*\d+(?:\.\d+)?)[^；;。,，]*?(?:买入|卖出|入场|出场|离场|开仓|平仓|平多|平空|做多|做空|开多|开空)/giu
    const matches = Array.from(segment.matchAll(clausePattern))
      .map(match => match[0].trim())
      .filter(Boolean)
    return matches.length > 0 ? matches : [segment]
  }

  private pushTrigger(triggers: SeedTrigger[], seen: Set<string>, trigger: SeedTrigger): void {
    const signature = JSON.stringify([trigger.key, trigger.phase, trigger.sideScope ?? null, trigger.params])
    if (seen.has(signature)) return
    seen.add(signature)
    triggers.push(trigger)
  }

  private resolvePositionMode(text: string, triggers: SeedTrigger[]): 'long_only' | 'short_only' | 'long_short' {
    const sideScopes = new Set(triggers.map(trigger => trigger.sideScope).filter(Boolean))

    if (sideScopes.has('long') && sideScopes.has('short')) {
      return 'long_short'
    }
    if (/双向网格/u.test(text) || /bidirectional/u.test(text)) {
      return 'long_short'
    }
    if (/做空|开空|卖空/u.test(text) && !/做多|开多|买入/u.test(text)) {
      return 'short_only'
    }
    return 'long_only'
  }

  private resolveRiskBasis(text: string): 'entry_avg_price' | 'position_pnl' {
    if (/持仓盈亏|持仓.*盈亏|浮盈|pnl/u.test(text)) {
      return 'position_pnl'
    }
    return 'entry_avg_price'
  }

  private resolveTradeIntent(segment: string): { phase: 'entry' | 'exit'; sideScope: 'long' | 'short' } | null {
    if (/买回平空|平空|买回空单/u.test(segment)) {
      return { phase: 'exit', sideScope: 'short' }
    }
    if (/卖出平多|平多|卖出多单/u.test(segment)) {
      return { phase: 'exit', sideScope: 'long' }
    }
    if (/出场|离场/u.test(segment)) {
      return { phase: 'exit', sideScope: /做空|开空|空单|short/u.test(segment) ? 'short' : 'long' }
    }
    if (/做空|开空|空单|short/u.test(segment)) {
      return { phase: 'entry', sideScope: 'short' }
    }
    if (/卖出/u.test(segment)) {
      return { phase: 'exit', sideScope: /做空|开空|空单|short/u.test(segment) ? 'short' : 'long' }
    }
    if (/做多|开多|买入|入场|开仓|long/u.test(segment)) {
      return { phase: 'entry', sideScope: 'long' }
    }
    if (/平仓/u.test(segment)) {
      return { phase: 'exit', sideScope: /做空|开空|空单|short/u.test(segment) ? 'short' : 'long' }
    }
    return null
  }

  private isTrueMovingAverageCrossClause(clause: string): { isCross: boolean } | null {
    return this.parseMovingAverageCrossClause(clause)
      ? { isCross: true }
      : null
  }

  private parseMovingAverageCrossClause(clause: string): {
    indicator: 'ma' | 'ema'
    direction: 'up' | 'down'
    fastPeriod?: number
    slowPeriod?: number
  } | null {
    const normalized = clause.replace(/\s+/gu, '')
    const indicator: 'ma' | 'ema' = /\bEMA\s*\d+/iu.test(clause) ? 'ema' : 'ma'
    const refs = Array.from(normalized.matchAll(/(?:EMA|MA)(\d{1,4})/giu))
      .map(match => Number(match[1]))
      .filter(value => Number.isFinite(value))
    const barePairMatch = normalized.match(/(\d{1,4})[\/和与、](\d{1,4})均线/)
      ?? normalized.match(/(\d{1,4})均线.*?(\d{1,4})均线/)
    const barePairRefs = barePairMatch
      ? [Number(barePairMatch[1]), Number(barePairMatch[2])].filter(value => Number.isFinite(value))
      : []
    const resolvedRefs = refs.length > 0 ? refs : barePairRefs

    const hasUpWord = /上穿|crossover|金叉/iu.test(normalized)
    const hasDownWord = /下穿|crossunder|死叉/iu.test(normalized)
    if (!hasUpWord && !hasDownWord) {
      return null
    }

    const hasPairMarkers = /[\/和与、]/u.test(normalized) || /均线/iu.test(normalized) || resolvedRefs.length >= 2
    if (!hasPairMarkers) {
      return null
    }

    const isExplicitPairCross = /(?:EMA|MA)\d{1,4}.*?(?:上穿|下穿|crossover|crossunder).*(?:EMA|MA)\d{1,4}/iu.test(normalized)
      || /(\d{1,4})[\/和与、](\d{1,4})均线.*?(?:上穿|下穿|crossover|crossunder)/iu.test(normalized)
    const isGoldenCrossPair = /(?:EMA|MA)\d{1,4}.*?(?:和|\/|与|、)?(?:EMA|MA)\d{1,4}.*?(?:金叉|死叉)/iu.test(normalized)
      || /(?:\d{1,4})\s*[\/和与、]\s*(?:\d{1,4})\s*均线.*?(?:金叉|死叉)/iu.test(normalized)

    if (!isExplicitPairCross && !isGoldenCrossPair) {
      return null
    }

    const direction: 'up' | 'down' = hasUpWord ? 'up' : 'down'
    const fastPeriod = resolvedRefs[0]
    const slowPeriod = resolvedRefs[1]

    return {
      indicator,
      direction,
      ...(fastPeriod !== undefined ? { fastPeriod } : {}),
      ...(slowPeriod !== undefined ? { slowPeriod } : {}),
    }
  }

  private extractRsiThreshold(clause: string, period: number): number | null {
    const compact = clause.replace(/\s+/gu, '')
    const numbers = Array.from(compact.matchAll(/\d+(?:\.\d+)?/gu))
      .map(match => Number(match[0]))
      .filter(value => Number.isFinite(value))
    const withoutPeriod = numbers.filter(value => value !== period)
    return withoutPeriod[0] ?? numbers[0] ?? null
  }

  private extractMacdParams(text: string): { fastPeriod: number; slowPeriod: number; signalPeriod: number } | null {
    const match = text.match(/MACD\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*\/\s*(\d{1,3})/iu)
    if (!match?.[1] || !match[2] || !match[3]) return null
    const fastPeriod = Number(match[1])
    const slowPeriod = Number(match[2])
    const signalPeriod = Number(match[3])
    if (!Number.isFinite(fastPeriod) || !Number.isFinite(slowPeriod) || !Number.isFinite(signalPeriod)) {
      return null
    }
    return { fastPeriod, slowPeriod, signalPeriod }
  }

  private splitLogicClauses(segment: string): string[] {
    return segment
      .split(/[，,、]|(?:且|并且|同时|以及)/u)
      .map(clause => clause.trim())
      .filter(Boolean)
  }

  private hasExplicitPriceChangeContext(segment: string): boolean {
    return /(相对|上一根|前一根|前收盘|收盘价|开仓均价|入场价|成本价|持仓盈亏|盈亏|pnl|收益率)/iu.test(segment)
      || /(?:\d{1,2}\s*(?:m|h|d|分钟|分|小时|时|天|日)).*(?:上涨|下跌|涨|跌).*(?:%|百分)/iu.test(segment)
  }

  private hasExplicitPriceChangeDirection(segment: string): boolean {
    return /(上涨|下跌|涨|跌|回落|回调|反弹)/u.test(segment)
  }

  private resolvePercentDirection(segment: string): 'up' | 'down' | null {
    if (/(下跌|跌|回落|回调)/u.test(segment)) {
      return 'down'
    }
    if (/(上涨|涨|反弹)/u.test(segment)) {
      return 'up'
    }
    return null
  }

  private extractBollingerBandParams(segment: string): { period?: number; stdDev?: number } | null {
    const match = segment.match(/布林带\s*[（(]\s*(\d{1,4})\s*[，,]\s*(\d+(?:\.\d+)?)\s*[)）]/u)
    if (!match?.[1] || !match[2]) return null

    const period = Number(match[1])
    const stdDev = Number(match[2])
    if (!Number.isFinite(period) || !Number.isFinite(stdDev)) return null

    return { period, stdDev }
  }

  private resolvePercentBasis(segment: string): 'prev_close' | 'entry_avg_price' | 'position_pnl' {
    if (/开仓均价|入场价|成本价/u.test(segment)) {
      return 'entry_avg_price'
    }
    if (/持仓盈亏|持仓.*盈亏|浮盈|pnl/u.test(segment)) {
      return 'position_pnl'
    }
    return 'prev_close'
  }

  private extractConfirmationMode(segment: string): 'close_confirm' | null {
    if (/收盘|确认|close/u.test(segment)) {
      return 'close_confirm'
    }
    return null
  }

  private extractExchange(text: string): string | null {
    const match = text.match(/\b(OKX|BINANCE|HYPERLIQUID)\b/iu)
    if (!match?.[1]) return null

    return match[1].toLowerCase()
  }

  private extractMarketType(text: string): string | null {
    if (/现货|spot/u.test(text)) return 'spot'
    if (/合约|永续|perp|swap/u.test(text)) return 'perp'
    return null
  }

  private extractSymbol(text: string): string | null {
    const match = text.match(/\b([A-Z0-9]{2,20}(?:[-/]?(?:USDT|USDC|USD))(?:-SWAP|:PERP|:SPOT)?)\b/iu)
    return canonicalizeStrategySymbolInput(match?.[1])
  }

  private extractFirstTimeframe(text: string): string | null {
    const compactMatch = text.match(/\b(\d{1,2})(m|h|d)\b/iu)
    if (compactMatch?.[1] && compactMatch[2]) {
      return `${compactMatch[1]}${compactMatch[2].toLowerCase()}`
    }

    const chineseMatch = text.match(/(\d{1,2})\s*(分钟|分|小时|时|天|日)/u)
    if (!chineseMatch?.[1] || !chineseMatch[2]) return null
    const unit = chineseMatch[2]
    const suffix = unit === '分钟' || unit === '分'
      ? 'm'
      : unit === '小时' || unit === '时'
        ? 'h'
        : 'd'
    return `${chineseMatch[1]}${suffix}`
  }

  private extractNumber(text: string, patterns: RegExp[]): number | null {
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match?.[1] === undefined) continue
      const value = Number(match[1])
      if (Number.isFinite(value)) {
        return value
      }
    }
    return null
  }

  private extractPercent(text: string, patterns: RegExp[]): number | null {
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match?.[1] === undefined) continue
      const value = Number(match[1])
      if (Number.isFinite(value)) {
        return value
      }
    }
    return null
  }

  private splitSegments(text: string): string[] {
    return text
      .split(/[；;。]/u)
      .map(segment => segment.trim())
      .filter(Boolean)
  }

  private normalizeText(message?: string): string {
    return message?.trim().replace(/\s+/gu, ' ') ?? ''
  }
}
