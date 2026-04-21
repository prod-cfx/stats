import { Injectable } from '@nestjs/common'
import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'

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
      this.pushGridTrigger(segment, triggers, seen)
      this.pushExecutionTrigger(segment, triggers, seen)
      this.pushPercentChangeTrigger(segment, triggers, seen)
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
      /(\d+(?:\.\d+)?)\s*%\s*(?:止损|亏损)/u,
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
      /(\d+(?:\.\d+)?)\s*%\s*(?:止盈|盈利)/u,
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
      /仓位\s*(\d+(?:\.\d+)?)\s*%/u,
      /(\d+(?:\.\d+)?)\s*%\s*仓位/u,
      /每笔\s*(\d+(?:\.\d+)?)\s*%/u,
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
      if (!/(?:MA|EMA)\s*\d+|均线/u.test(clause)) continue
      if (this.isTrueMovingAverageCrossClause(clause)) continue
      const referencePeriod = this.extractNumber(clause, [/(?:MA|EMA)\s*(\d{1,4})/iu, /均线\s*(\d{1,4})/u])
      if (referencePeriod === null) continue

      const intent = this.resolveTradeIntent(clause)
      if (!intent) continue

      const confirmationMode = this.extractConfirmationMode(clause)
      const indicator = /\bEMA\s*\d+/iu.test(clause) ? 'ema' : 'ma'
      const key = /突破|上穿|站上|高于/u.test(clause)
        ? 'indicator.above'
        : (/跌破|下穿|失守|低于/u.test(clause) ? 'indicator.below' : null)
      if (!key) continue

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

  private pushBollingerTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/布林带/u.test(segment)) return

    const bandParams = this.extractBollingerBandParams(segment)
    const confirmationMode = this.extractConfirmationMode(segment)

    if (/上轨/u.test(segment)) {
      this.pushTrigger(triggers, seen, {
        key: 'bollinger.touch_upper',
        phase: 'entry',
        sideScope: 'short',
        params: {
          band: 'upper',
          ...(bandParams?.period !== undefined ? { period: bandParams.period } : {}),
          ...(bandParams?.stdDev !== undefined ? { stdDev: bandParams.stdDev } : {}),
          ...(confirmationMode ? { confirmationMode } : {}),
        },
      })
    }

    if (/下轨/u.test(segment)) {
      this.pushTrigger(triggers, seen, {
        key: 'bollinger.touch_lower',
        phase: 'entry',
        sideScope: 'long',
        params: {
          band: 'lower',
          ...(bandParams?.period !== undefined ? { period: bandParams.period } : {}),
          ...(bandParams?.stdDev !== undefined ? { stdDev: bandParams.stdDev } : {}),
          ...(confirmationMode ? { confirmationMode } : {}),
        },
      })
    }

    if (/中轨/u.test(segment)) {
      this.pushTrigger(triggers, seen, {
        key: 'bollinger.touch_middle',
        phase: 'exit',
        sideScope: 'both',
        params: {
          band: 'middle',
          ...(bandParams?.period !== undefined ? { period: bandParams.period } : {}),
          ...(bandParams?.stdDev !== undefined ? { stdDev: bandParams.stdDev } : {}),
          ...(confirmationMode ? { confirmationMode } : {}),
        },
      })
    }
  }

  private pushMovingAverageCrossTrigger(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    const clauses = segment.includes('，') || segment.includes(',')
      ? segment.split(/[，,]/u).map(clause => clause.trim()).filter(Boolean)
      : [segment]

    for (const clause of clauses) {
      if (!this.isTrueMovingAverageCrossClause(clause)) continue

      const periods = Array.from(clause.matchAll(/\b(?:EMA|MA)\s*(\d{1,4})/giu))
        .map(match => Number(match[1]))
        .filter(value => Number.isFinite(value))
      if (periods.length < 2 && !/金叉|死叉/iu.test(clause)) continue

      const indicator = /\bEMA\s*\d+/iu.test(clause) ? 'ema' : 'ma'
      const intent = this.resolveTradeIntent(clause)
      if (!intent) continue

      if (/上穿|cross over|金叉/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'indicator.cross_over',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            indicator,
            ...(periods[0] !== undefined ? { fastPeriod: periods[0] } : {}),
            ...(periods[1] !== undefined ? { slowPeriod: periods[1] } : {}),
          },
        })
      }

      if (/下穿|cross under|死叉/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'indicator.cross_under',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            indicator,
            ...(periods[0] !== undefined ? { fastPeriod: periods[0] } : {}),
            ...(periods[1] !== undefined ? { slowPeriod: periods[1] } : {}),
          },
        })
      }
    }
  }

  private pushGridTrigger(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/网格/u.test(segment)) return

    const range = segment.match(/(\d+(?:\.\d+)?)\s*[-~到至]\s*(\d+(?:\.\d+)?)/u)
    const stepPct = this.extractPercent(segment, [/步长\s*(\d+(?:\.\d+)?)\s*%/u, /每一格\s*(\d+(?:\.\d+)?)\s*%/u, /每格\s*(\d+(?:\.\d+)?)\s*%/u, /千分之\s*(\d+(?:\.\d+)?)/u])

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

  private pushPercentChangeTrigger(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/%/.test(segment)) return
    if (!this.hasExplicitPriceChangeContext(segment)) return
    if (!this.hasExplicitPriceChangeDirection(segment)) return

    const intent = this.resolveTradeIntent(segment)
    if (!intent) return

    const valuePct = this.extractPercent(segment, [/(\d+(?:\.\d+)?)\s*%/u])
    if (valuePct === null) return

    const direction = /下跌|跌|回落|回调/u.test(segment) ? -Math.abs(valuePct) : Math.abs(valuePct)
    const basis = this.resolvePercentBasis(segment)
    const window = this.extractFirstTimeframe(segment)

    this.pushTrigger(triggers, seen, {
      key: 'price.percent_change',
      phase: intent.phase,
      sideScope: intent.sideScope,
      params: {
        valuePct: direction,
        basis,
        ...(window ? { window } : {}),
      },
    })
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
    if (/做空|开空|空单|short/u.test(segment)) {
      return { phase: 'entry', sideScope: 'short' }
    }
    if (/做多|开多|买入|long/u.test(segment)) {
      return { phase: 'entry', sideScope: 'long' }
    }
    if (/平仓/u.test(segment)) {
      return { phase: 'exit', sideScope: /做空|开空|空单|short/u.test(segment) ? 'short' : 'long' }
    }
    if (/卖出/u.test(segment)) {
      return { phase: 'exit', sideScope: /做空|开空|空单|short/u.test(segment) ? 'short' : 'long' }
    }

    return null
  }

  private isTrueMovingAverageCrossClause(clause: string): boolean {
    const normalized = clause.replace(/\s+/gu, '')
    return /(?:EMA|MA)\d{1,4}.*?(?:上穿|下穿|crossover|crossunder|金叉|死叉).*(?:EMA|MA)\d{1,4}/iu.test(normalized)
  }

  private hasExplicitPriceChangeContext(segment: string): boolean {
    return /(相对|上一根|前一根|前收盘|收盘价|开仓均价|入场价|成本价|持仓盈亏|盈亏|pnl|收益率)/iu.test(segment)
  }

  private hasExplicitPriceChangeDirection(segment: string): boolean {
    return /(上涨|下跌|涨|跌|回落|回调|反弹)/u.test(segment)
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
    const match = text.match(/\b(OKX|BINANCE|BYBIT|GATE|HUOBI)\b/iu)
    if (!match?.[1]) return null

    return match[1].toLowerCase()
  }

  private extractMarketType(text: string): string | null {
    if (/现货|spot/u.test(text)) return 'spot'
    if (/合约|永续|perp|swap/u.test(text)) return 'perp'
    return null
  }

  private extractSymbol(text: string): string | null {
    const match = text.match(/\b([A-Z0-9]{2,20}(?:USDT|USDC|USD))\b/u)
    return match?.[1] ?? null
  }

  private extractFirstTimeframe(text: string): string | null {
    const match = text.match(/\b(\d{1,2})(m|h|d)\b/iu)
    if (!match?.[1] || !match[2]) return null
    return `${match[1]}${match[2].toLowerCase()}`
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
