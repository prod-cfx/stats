import { Injectable } from '@nestjs/common'
import type { LlmCodegenSessionStatus } from '../types/codegen-session-status'
import type {
  PendingSemanticEdit,
  SemanticEditContextField,
  SemanticEditDecision,
  SemanticEditPatch,
} from '../types/semantic-edit'
import type { SemanticPositionState, SemanticState, SemanticTriggerState } from '../types/semantic-state'
import { isProcessingCodegenSessionStatus } from '../types/codegen-session-status'
import { readPendingSemanticEdit, withPendingSemanticEdit } from '../types/semantic-edit'
import { canonicalizeStrategySymbolInput } from './market-scope-equivalence'

export interface ConversationSemanticEditDecisionInput {
  status: LlmCodegenSessionStatus
  message: string
  semanticState: SemanticState
}

const PROCESSING_REJECTION_MESSAGE = '当前策略正在生成或校验，请等待完成后再修改。'

@Injectable()
export class ConversationSemanticEditService {
  applyPatch(state: SemanticState, patch: SemanticEditPatch): SemanticState {
    return patch.operations.reduce((next, operation) => {
      if (operation.op === 'cancel_pending_edit') {
        return withPendingSemanticEdit(next, null)
      }
      if (operation.op === 'replace_context') {
        return this.applyContextReplacement(next, operation.field, operation.value)
      }
      if (operation.op === 'replace_trigger') {
        return this.applyTriggerReplacement(next, operation.text ?? '')
      }
      if (operation.op === 'replace_position') {
        return this.applyPositionReplacement(next, operation.text ?? '')
      }
      if (operation.op === 'replace_indicator_period') {
        return this.applyIndicatorPeriodReplacement(next, operation)
      }
      return next
    }, state)
  }

  decide(input: ConversationSemanticEditDecisionInput): SemanticEditDecision {
    const message = input.message.trim()
    if (!message) return { kind: 'NO_EDIT' }

    if (isProcessingCodegenSessionStatus(input.status) && this.hasSemanticEditIntent(message, input.semanticState)) {
      return {
        kind: 'REJECT_WHILE_PROCESSING',
        message: PROCESSING_REJECTION_MESSAGE,
      }
    }

    const pendingEdit = readPendingSemanticEdit(input.semanticState)
    if (pendingEdit && /算了|保持原来|不改了|取消/u.test(message)) {
      return {
        kind: 'APPLY_TO_SEMANTIC_STATE',
        patch: { operations: [{ op: 'cancel_pending_edit' }] },
      }
    }

    if (pendingEdit && this.isStrategyReplacementSeedPendingEdit(pendingEdit)) {
      const seedText = this.extractPendingStrategyReplacementSeed(message)
      if (seedText) {
        return {
          kind: 'REPLACE_STRATEGY_DRAFT',
          seedText,
        }
      }

      return {
        kind: 'ASK_EDIT_CLARIFICATION',
        question: '请描述新的触发、行动、风控、仓位和运行 context，我会按新的语义重新整理策略。',
        pendingEdit,
      }
    }

    if (pendingEdit && this.isPendingRsiTriggerReplacement(pendingEdit)) {
      if (!pendingEdit.targetRef && input.semanticState.triggers.length > 1) {
        return {
          kind: 'ASK_EDIT_CLARIFICATION',
          question: '你正在把触发语义改成 RSI。当前有多个触发，请先说明要替换哪一个触发条件。',
          pendingEdit,
        }
      }

      if (this.extractRsiThreshold(message)) {
        return {
          kind: 'APPLY_TO_SEMANTIC_STATE',
          patch: { operations: [{ op: 'replace_trigger', targetRef: pendingEdit.targetRef, text: message }] },
        }
      }

      return {
        kind: 'ASK_EDIT_CLARIFICATION',
        question: '你正在把触发语义改成 RSI。请确认 RSI 阈值，例如低于 30 或高于 70。',
        pendingEdit,
      }
    }

    const implicitReplacementSeed = this.extractImplicitStrategyReplacementSeed(message, input.semanticState)
    if (implicitReplacementSeed) {
      return {
        kind: 'REPLACE_STRATEGY_DRAFT',
        seedText: implicitReplacementSeed,
      }
    }

    const contextOperation = this.extractReplacementContextOperation(message)
    if (contextOperation) {
      return {
        kind: 'APPLY_TO_SEMANTIC_STATE',
        patch: {
          operations: [{ op: 'replace_context', ...contextOperation }],
        },
      }
    }

    const positionPct = this.extractReplacementPositionPct(message)
    if (positionPct !== null) {
      return {
        kind: 'APPLY_TO_SEMANTIC_STATE',
        patch: {
          operations: [{ op: 'replace_position', text: message }],
        },
      }
    }

    const indicatorPeriodReplacement = this.extractIndicatorPeriodReplacement(message)
    if (indicatorPeriodReplacement) {
      return {
        kind: 'APPLY_TO_SEMANTIC_STATE',
        patch: {
          operations: [{ op: 'replace_indicator_period', ...indicatorPeriodReplacement, text: message }],
        },
      }
    }

    const seedText = this.extractStrategyReplacementSeed(message)
    if (seedText) {
      return {
        kind: 'REPLACE_STRATEGY_DRAFT',
        seedText,
      }
    }

    if (this.isStrategyRestartWithoutSeed(message)) {
      return {
        kind: 'ASK_EDIT_CLARIFICATION',
        question: '请描述新的触发、行动、风控、仓位和运行 context，我会按新的语义重新整理策略。',
        pendingEdit: this.createStrategyReplacementSeedPendingEdit(message),
      }
    }

    if (/触发.*改成\s*RSI|把触发改成\s*RSI/u.test(message)) {
      const triggerPendingEdit = this.createPendingTriggerReplacement(
        message,
        this.inferSingleTriggerTargetRef(input.semanticState),
        input.status === 'PUBLISHED' ? 'PUBLISHED' : undefined,
      )
      return {
        kind: 'ASK_EDIT_CLARIFICATION',
        question: '你正在把触发语义改成 RSI。请确认 RSI 阈值，例如低于 30 或高于 70。',
        pendingEdit: triggerPendingEdit,
      }
    }

    return { kind: 'NO_EDIT' }
  }

  hasEditIntent(input: ConversationSemanticEditDecisionInput): boolean {
    return this.hasSemanticEditIntent(input.message.trim(), input.semanticState)
  }

  createEmptySemanticStateForTest(): SemanticState {
    return {
      version: 1,
      families: [],
      triggers: [],
      actions: [],
      risk: [],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '1970-01-01T00:00:00.000Z',
    }
  }

  withPendingEditForTest(state: SemanticState, createdFromMessage: string): SemanticState {
    return withPendingSemanticEdit(state, this.createPendingTriggerReplacement(createdFromMessage))
  }

  withStrategyReplacementSeedPendingEditForTest(state: SemanticState, createdFromMessage: string): SemanticState {
    return withPendingSemanticEdit(state, this.createStrategyReplacementSeedPendingEdit(createdFromMessage))
  }

  readPendingEditForTest(state: SemanticState): PendingSemanticEdit | null {
    return readPendingSemanticEdit(state)
  }

  private applyTriggerReplacement(state: SemanticState, text: string): SemanticState {
    const pendingEdit = readPendingSemanticEdit(state)
    if (!pendingEdit || !this.isPendingRsiTriggerReplacement(pendingEdit)) return state
    if (!pendingEdit.targetRef && state.triggers.length > 1) return state

    const threshold = this.extractRsiThreshold(text)
    if (!threshold) return state

    const targetRef = pendingEdit.targetRef ?? (state.triggers.length === 1 ? state.triggers[0]?.id : undefined)
    const trigger: SemanticTriggerState = {
      ...pendingEdit.candidate,
      id: targetRef ?? pendingEdit.candidate.id,
      key: threshold.direction === 'gte' ? 'oscillator.rsi_gte' : 'oscillator.rsi_lte',
      phase: pendingEdit.candidate.phase === 'exit' ? 'exit' : 'entry',
      params: {
        indicator: 'rsi',
        period: 14,
        value: threshold.value,
      },
      status: 'locked',
      source: 'user_explicit',
      evidence: {
        text,
        source: 'user_explicit',
      },
      openSlots: [],
    }
    const triggers = targetRef
      ? state.triggers.map((item) => item.id === targetRef ? trigger : item)
      : [trigger, ...state.triggers.filter((item) => item.id !== trigger.id)]

    return withPendingSemanticEdit({
      ...state,
      triggers,
      updatedAt: new Date().toISOString(),
    }, null)
  }

  private applyContextReplacement(
    state: SemanticState,
    field: 'symbol' | 'timeframe' | 'exchange' | 'marketType',
    value: string,
  ): SemanticState {
    const questionHints = {
      exchange: '请确认交易所（binance / okx / hyperliquid）。',
      symbol: '请确认策略交易标的（例如 BTCUSDT）。',
      marketType: '请确认市场类型（现货或合约/perp）。',
      timeframe: '请确认策略主周期（例如 15m 或 1h）。',
    } as const

    return {
      ...state,
      contextSlots: {
        ...state.contextSlots,
        [field]: {
          slotKey: field,
          fieldPath: `contextSlots.${field}`,
          value,
          status: 'locked',
          priority: 'context',
          questionHint: questionHints[field],
          affectsExecution: true,
          evidence: {
            text: value,
            source: 'user_explicit',
          },
        },
      },
      updatedAt: new Date().toISOString(),
    }
  }

  private applyPositionReplacement(state: SemanticState, text: string): SemanticState {
    const positionPct = this.extractReplacementPositionPct(text)
    if (positionPct === null) return state

    const position: SemanticPositionState = {
      mode: state.position?.mode ?? 'fixed_ratio',
      value: positionPct,
      positionMode: state.position?.positionMode ?? 'long_only',
      status: 'locked',
      source: 'user_explicit',
      evidence: {
        text,
        source: 'user_explicit',
      },
      openSlots: [],
    }

    return {
      ...state,
      position,
      updatedAt: new Date().toISOString(),
    }
  }

  private applyIndicatorPeriodReplacement(
    state: SemanticState,
    operation: { indicator?: string, from: number, to: number, text?: string },
  ): SemanticState {
    const targetIndicator = operation.indicator?.trim().toLowerCase()
    let changed = false
    const periodKeys = ['fastPeriod', 'slowPeriod', 'period', 'reference.period'] as const
    const triggers = state.triggers.map((trigger) => {
      const triggerIndicator = typeof trigger.params.indicator === 'string'
        ? trigger.params.indicator.trim().toLowerCase()
        : ''
      if (
        targetIndicator
        && triggerIndicator
        && triggerIndicator !== targetIndicator
        && !(targetIndicator === 'ma' && triggerIndicator === 'sma')
        && !(targetIndicator === 'sma' && triggerIndicator === 'ma')
      ) {
        return trigger
      }

      const nextParams = { ...trigger.params }
      let triggerChanged = false
      for (const key of periodKeys) {
        if (nextParams[key] === operation.from) {
          nextParams[key] = operation.to
          triggerChanged = true
        }
      }
      if (!triggerChanged) return trigger

      changed = true
      return {
        ...trigger,
        params: nextParams,
        evidence: {
          text: operation.text ?? `${operation.from}->${operation.to}`,
          source: 'user_explicit' as const,
        },
      }
    })

    if (!changed) return state

    return {
      ...state,
      triggers,
      updatedAt: new Date().toISOString(),
    }
  }

  private extractReplacementSymbol(message: string): string | null {
    const explicitMatch = /交易标的\s*(?:改为|改成|换成)\s*([A-Za-z0-9:/-]+)/u.exec(message)
    const explicitSymbol = canonicalizeStrategySymbolInput(explicitMatch?.[1])
    if (explicitSymbol) return explicitSymbol

    const valueReplacementMatch = /(?:把\s*)?([A-Za-z0-9:/-]+)\s*(?:改为|改成|换成|替换为|修改为|更改为)\s*([A-Za-z0-9:/-]+)/iu.exec(message)
    const fromSymbol = canonicalizeStrategySymbolInput(valueReplacementMatch?.[1])
    const toSymbol = canonicalizeStrategySymbolInput(valueReplacementMatch?.[2])
    if (fromSymbol && toSymbol && fromSymbol !== toSymbol) {
      return toSymbol
    }
    return null
  }

  private extractReplacementContextOperation(
    message: string,
  ): { field: SemanticEditContextField, value: string } | null {
    const symbol = this.extractReplacementSymbol(message)
    if (symbol) return { field: 'symbol', value: symbol }

    const timeframe = /(?:主周期|周期)\s*(?:改为|改成|换成)\s*([0-9]+[mhdw])/iu.exec(message)?.[1]
    if (timeframe) return { field: 'timeframe', value: timeframe.toLowerCase() }

    const exchange = /(?:交易所|平台)\s*(?:改为|改成|换成)\s*([A-Za-z0-9_-]+)/u.exec(message)?.[1]
    if (exchange) return { field: 'exchange', value: exchange.toLowerCase() }

    const marketType = /(?:市场类型|市场)\s*(?:改为|改成|换成)\s*(现货|合约|永续|spot|perp|swap)/iu.exec(message)?.[1]
    if (!marketType) return null

    return {
      field: 'marketType',
      value: this.normalizeMarketType(marketType),
    }
  }

  private normalizeMarketType(value: string): string {
    if (/现货|spot/iu.test(value)) return 'spot'
    return 'perp'
  }

  private extractReplacementPositionPct(message: string): number | null {
    const match = /仓位\s*(?:从\s*)?(?:\d+(?:\.\d+)?\s*%)?\s*(?:换成|改成|改为|修改为|更改为)\s*(\d+(?:\.\d+)?)\s*%/u.exec(message)
      ?? /(?:换成|改成|改为|修改为|更改为)\s*(\d+(?:\.\d+)?)\s*%\s*仓位/u.exec(message)
    const valuePct = Number(match?.[1])
    if (!Number.isFinite(valuePct) || valuePct <= 0 || valuePct > 100) return null
    return valuePct / 100
  }

  private extractIndicatorPeriodReplacement(message: string): {
    indicator?: string
    from: number
    to: number
  } | null {
    const match = /(?:把\s*)?(ma|sma|ema)\s*(\d{1,4})\s*(?:换成|改成|改为|修改为|更改为|替换为)\s*(?:(ma|sma|ema)\s*)?(\d{1,4})/iu.exec(message)
      ?? /(?:把\s*)?(\d{1,4})\s*(?:周期)?\s*(?:均线|ma|sma|ema)\s*(?:换成|改成|改为|修改为|更改为|替换为)\s*(\d{1,4})\s*(?:周期)?\s*(?:均线|ma|sma|ema)/iu.exec(message)
    if (!match) return null

    const indicator = typeof match[1] === 'string' && /ma|sma|ema/iu.test(match[1])
      ? match[1].toLowerCase()
      : undefined
    const from = Number(indicator ? match[2] : match[1])
    const to = Number(indicator ? match[4] : match[2])
    if (!Number.isInteger(from) || !Number.isInteger(to) || from <= 0 || to <= 0 || from === to) {
      return null
    }

    return {
      ...(indicator ? { indicator } : {}),
      from,
      to,
    }
  }

  private extractPendingStrategyReplacementSeed(message: string): string | null {
    if (/^(继续|确认|好的|好|嗯|是|对|可以)$/u.test(message)) return null
    return message
  }

  private isStrategyReplacementSeedPendingEdit(pendingEdit: PendingSemanticEdit): boolean {
    return pendingEdit.op === 'replace_trigger'
      && pendingEdit.candidate.key === 'pending.strategy_replacement_seed'
  }

  private isPendingRsiTriggerReplacement(
    pendingEdit: PendingSemanticEdit,
  ): pendingEdit is Extract<PendingSemanticEdit, { op: 'replace_trigger' }> {
    return pendingEdit.op === 'replace_trigger'
      && pendingEdit.candidate.key === 'indicator.rsi_threshold'
  }

  private extractRsiThreshold(message: string): { direction: 'lte' | 'gte', value: number } | null {
    const gteMatch = /(?:高于|大于|超过|>=|>)\s*(\d+(?:\.\d+)?)/u.exec(message)
      ?? /(\d+(?:\.\d+)?)\s*(?:以上|及以上)/u.exec(message)
    const lteMatch = /(?:低于|小于|<=|<)\s*(\d+(?:\.\d+)?)/u.exec(message)
      ?? /(\d+(?:\.\d+)?)\s*(?:以下|及以下)/u.exec(message)
    const match = gteMatch ?? lteMatch ?? /(\d+(?:\.\d+)?)/u.exec(message)
    const value = Number(match?.[1])
    if (!Number.isFinite(value)) return null

    const direction = gteMatch ? 'gte' : 'lte'
    return { direction, value }
  }

  private hasSemanticEditIntent(message: string, state: SemanticState): boolean {
    return Boolean(
      this.extractReplacementContextOperation(message)
        || this.extractReplacementPositionPct(message) !== null
        || this.extractIndicatorPeriodReplacement(message) !== null
        || this.extractImplicitStrategyReplacementSeed(message, state)
        || this.extractStrategyReplacementSeed(message)
        || this.isStrategyRestartWithoutSeed(message)
        || (readPendingSemanticEdit(state) && /算了|保持原来|不改了|取消/u.test(message))
        || /触发.*改成\s*RSI|把触发改成\s*RSI/u.test(message)
        || /(?:改|修改|更改|替换|删除|取消|换成|改成|改为).*(?:触发|行动|风控|仓位|止损|止盈|交易标的|周期|交易所|市场类型)/u.test(message)
        || /(?:触发|行动|风控|仓位|止损|止盈|交易标的|周期|交易所|市场类型).*(?:改|修改|更改|替换|删除|取消|换成|改成|改为)/u.test(message),
    )
  }

  private extractStrategyReplacementSeed(message: string): string | null {
    const match = /(?:之前策略不对|之前不对)[，,\s]*(重新做一个.+)$/u.exec(message)
    return match?.[1]?.trim() || null
  }

  private extractImplicitStrategyReplacementSeed(message: string, state: SemanticState): string | null {
    if (!this.hasActiveStrategySemantics(state)) return null
    if (!this.looksLikeCompleteStrategySeed(message)) return null
    return message.trim()
  }

  private hasActiveStrategySemantics(state: SemanticState): boolean {
    return state.triggers.length > 0
      || state.actions.length > 0
      || state.risk.length > 0
      || state.position !== null
      || Object.values(state.contextSlots).some((slot) => Boolean(slot?.value))
  }

  private looksLikeCompleteStrategySeed(message: string): boolean {
    const hasContext = /(?:OKX|BINANCE|Hyperliquid|交易所|交易|现货|永续|合约|perp|swap|spot|[A-Z]{2,}[-/]?[A-Z0-9]{2,}(?:-SWAP)?|\b\d+\s*[mhdw]\b)/iu.test(message)
    const hasCoreBehavior = /(?:策略|网格|入场|出场|开仓|平仓|买入|卖出|触发|行动|价格区间|区间\s*\d|每格|均线|MA|SMA|EMA|RSI|MACD)/iu.test(message)
    const hasRisk = /(?:止损|止盈|亏损|盈利|回撤|风控)/u.test(message)
    const hasPosition = /(?:仓位|单笔|资金|杠杆|倍杠杆|不使用杠杆)/u.test(message)
    const hasGridStructure = /(?:价格区间\s*\d+(?:\.\d+)?\s*[-~到至]\s*\d+(?:\.\d+)?|双向网格|每格间距|网格)/u.test(message)

    const semanticAreaCount = [hasContext, hasCoreBehavior, hasRisk, hasPosition].filter(Boolean).length
    return semanticAreaCount >= 3 && (semanticAreaCount >= 4 || hasGridStructure)
  }

  private isStrategyRestartWithoutSeed(message: string): boolean {
    return /(?:之前策略不对|之前不对)[，,\s]*重新来$/u.test(message)
  }

  private createStrategyReplacementSeedPendingEdit(text: string): PendingSemanticEdit {
    return {
      id: `pending-strategy-replacement-seed-${Date.now()}`,
      op: 'replace_trigger',
      candidate: {
        id: `candidate-strategy-replacement-seed-${Date.now()}`,
        key: 'pending.strategy_replacement_seed',
        phase: 'gate',
        params: {},
        status: 'open',
        source: 'user_explicit',
        evidence: {
          text,
          source: 'user_explicit',
        },
        openSlots: [],
      },
      status: 'needs_clarification',
      createdFromMessage: text,
    }
  }

  private inferSingleTriggerTargetRef(state: SemanticState): string | undefined {
    return state.triggers.length === 1 ? state.triggers[0]?.id : undefined
  }

  private createPendingTriggerReplacement(
    text: string,
    targetRef?: string,
    resumeStatusOnCancel?: 'PUBLISHED',
  ): PendingSemanticEdit {
    return {
      id: `pending-trigger-${Date.now()}`,
      op: 'replace_trigger',
      targetRef,
      resumeStatusOnCancel,
      candidate: {
        id: `candidate-trigger-${Date.now()}`,
        key: 'indicator.rsi_threshold',
        phase: 'gate',
        params: { indicator: 'rsi' },
        status: 'open',
        source: 'user_explicit',
        evidence: {
          text,
          source: 'user_explicit',
        },
        openSlots: [{
          slotKey: 'trigger.rsi.threshold',
          fieldPath: 'triggers[].params.threshold',
          status: 'open',
          priority: 'behavior',
          questionHint: '请确认 RSI 阈值，例如低于 30 或高于 70。',
          affectsExecution: true,
        }],
      },
      status: 'needs_clarification',
      createdFromMessage: text,
    }
  }
}
