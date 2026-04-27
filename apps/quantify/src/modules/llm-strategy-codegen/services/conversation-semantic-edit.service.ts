import { Injectable } from '@nestjs/common'
import type { LlmCodegenSessionStatus } from '../types/codegen-session-status'
import type {
  PendingSemanticEdit,
  SemanticEditContextField,
  SemanticEditDecision,
  SemanticEditPatch,
} from '../types/semantic-edit'
import type { SemanticActionState, SemanticPositionState, SemanticState, SemanticTriggerState } from '../types/semantic-state'
import { isProcessingCodegenSessionStatus } from '../types/codegen-session-status'
import { readPendingSemanticEdit, withPendingSemanticEdit } from '../types/semantic-edit'
import { canonicalizeStrategySymbolInput } from './market-scope-equivalence'

export interface ConversationSemanticEditDecisionInput {
  status: LlmCodegenSessionStatus
  message: string
  semanticState: SemanticState
}

const PROCESSING_REJECTION_MESSAGE = '当前策略正在生成或校验，请等待完成后再修改。'
type SemanticActionKey = 'open_long' | 'open_short' | 'close_long' | 'close_short'

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
      if (operation.op === 'replace_trigger_number') {
        return this.applyTriggerNumberReplacement(next, operation)
      }
      if (operation.op === 'replace_action') {
        return this.applyActionReplacement(next, operation.text ?? '')
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

    const actionReplacement = this.extractActionReplacement(message)
    if (actionReplacement) {
      return {
        kind: 'APPLY_TO_SEMANTIC_STATE',
        patch: {
          operations: [{ op: 'replace_action', text: message }],
        },
      }
    }

    const triggerNumberReplacement = this.extractTriggerNumberReplacement(message)
    if (triggerNumberReplacement) {
      return {
        kind: 'APPLY_TO_SEMANTIC_STATE',
        patch: {
          operations: [{ op: 'replace_trigger_number', ...triggerNumberReplacement, text: message }],
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

  private applyTriggerNumberReplacement(
    state: SemanticState,
    operation: { from: number, to: number, direction?: 'up' | 'down', text?: string },
  ): SemanticState {
    let changed = false
    const triggers = state.triggers.map((trigger) => {
      if (!this.doesTriggerMatchNumberReplacementDirection(trigger, operation.direction)) {
        return trigger
      }

      const nextParams = this.replaceNumericParamValue(trigger.params, operation.from, operation.to)
      if (nextParams === trigger.params) return trigger

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

  private doesTriggerMatchNumberReplacementDirection(
    trigger: SemanticTriggerState,
    direction: 'up' | 'down' | undefined,
  ): boolean {
    if (!direction) return true
    if (direction === 'up') {
      return trigger.key.includes('cross_over')
        || trigger.key.includes('_gte')
        || trigger.key.includes('above')
        || trigger.key.includes('breakout_up')
        || trigger.params.op === 'gte'
        || trigger.params.op === '>'
    }
    return trigger.key.includes('cross_under')
      || trigger.key.includes('_lte')
      || trigger.key.includes('below')
      || trigger.key.includes('breakout_down')
      || trigger.params.op === 'lte'
      || trigger.params.op === '<'
  }

  private replaceNumericParamValue(
    params: Record<string, unknown>,
    from: number,
    to: number,
  ): Record<string, unknown> {
    let changed = false
    const nextParams: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'number' && Number.isFinite(value) && this.isSameNumericValue(value, from)) {
        nextParams[key] = to
        changed = true
        continue
      }
      nextParams[key] = value
    }
    return changed ? nextParams : params
  }

  private isSameNumericValue(left: number, right: number): boolean {
    return Math.abs(left - right) < 1e-9
  }

  private applyActionReplacement(state: SemanticState, text: string): SemanticState {
    const replacement = this.extractActionReplacement(text)
    if (!replacement) return state

    let changed = false
    const actions = state.actions.map((action) => {
      if (action.key !== replacement.from) return action
      changed = true
      return this.replaceActionState(action, replacement.to, text)
    })

    const actionKeys = new Set(actions.map(action => action.key))
    const fromSide = this.actionSide(replacement.from)
    const toSide = this.actionSide(replacement.to)

    if (fromSide && toSide && fromSide !== toSide) {
      const pairedFromAction = this.pairedActionForSide(replacement.from, fromSide)
      const pairedToAction = this.pairedActionForSide(replacement.from, toSide)
      if (pairedFromAction && pairedToAction && actionKeys.has(pairedFromAction) && !actionKeys.has(pairedToAction)) {
        changed = true
        for (let index = 0; index < actions.length; index += 1) {
          if (actions[index]?.key === pairedFromAction) {
            actions[index] = this.replaceActionState(actions[index]!, pairedToAction, text)
          }
        }
      }
    }

    const triggers = fromSide && toSide && fromSide !== toSide
      ? state.triggers.map((trigger) => {
          if (trigger.sideScope !== fromSide) return trigger
          changed = true
          return {
            ...trigger,
            sideScope: toSide,
            evidence: {
              text,
              source: 'user_explicit' as const,
            },
          }
        })
      : state.triggers

    const position = fromSide && toSide && fromSide !== toSide && state.position
      ? {
          ...state.position,
          positionMode: this.replacePositionModeSide(state.position.positionMode, fromSide, toSide),
          evidence: {
            text,
            source: 'user_explicit' as const,
          },
        }
      : state.position

    if (!changed) return state

    return {
      ...state,
      actions,
      triggers,
      position,
      updatedAt: new Date().toISOString(),
    }
  }

  private replaceActionState(action: SemanticActionState, key: SemanticActionKey, text: string): SemanticActionState {
    return {
      ...action,
      key,
      status: 'locked',
      source: 'user_explicit',
      evidence: {
        text,
        source: 'user_explicit',
      },
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
    const match = /(?:把\s*)?(sma|ema|ma)\s*(\d{1,4})\s*(?:换成|改成|改为|修改为|更改为|替换为)\s*(?:(sma|ema|ma)\s*)?(\d{1,4})/iu.exec(message)
      ?? /(?:把\s*)?(\d{1,4})\s*(?:周期)?\s*(?:均线|sma|ema|ma)\s*(?:换成|改成|改为|修改为|更改为|替换为)\s*(\d{1,4})\s*(?:周期)?\s*(?:均线|sma|ema|ma)/iu.exec(message)
    if (!match) return null

    const indicator = typeof match[1] === 'string' && /^(?:sma|ema|ma)$/iu.test(match[1])
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

  private extractActionReplacement(message: string): { from: SemanticActionKey, to: SemanticActionKey } | null {
    const phraseMatch = /(.+?)\s*(?:改为|改成|换成|替换为|修改为|更改为)\s*(.+)/iu.exec(message)
    const phraseFrom = this.normalizeActionKey(phraseMatch?.[1])
    const phraseTo = this.normalizeActionKey(phraseMatch?.[2])
    if (phraseFrom && phraseTo && phraseFrom !== phraseTo) {
      return { from: phraseFrom, to: phraseTo }
    }

    const match = /(?:把\s*)?([A-Za-z_\s-]+|开多|做多|买入|开空|做空|卖空|平多|平空|平仓)\s*(?:改为|改成|换成|替换为|修改为|更改为)\s*([A-Za-z_\s-]+|开多|做多|买入|开空|做空|卖空|平多|平空|平仓)/iu.exec(message)
    const from = this.normalizeActionKey(match?.[1])
    const to = this.normalizeActionKey(match?.[2])
    if (!from || !to || from === to) return null
    return { from, to }
  }

  private extractTriggerNumberReplacement(message: string): { from: number, to: number, direction?: 'up' | 'down' } | null {
    const match = /(?:上穿|下穿|高于|低于|大于|小于|超过|突破|跌破|>=|<=|>|<)?\s*(\d+(?:\.\d+)?)\s*(?:改为|改成|换成|替换为|修改为|更改为)\s*(\d+(?:\.\d+)?)/u.exec(message)
    if (!match) return null

    const from = Number(match[1])
    const to = Number(match[2])
    if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return null

    return {
      from,
      to,
      ...this.extractTriggerDirectionHint(message),
    }
  }

  private extractTriggerDirectionHint(message: string): { direction?: 'up' | 'down' } {
    if (/上穿|高于|大于|超过|突破|>=|>/u.test(message)) return { direction: 'up' }
    if (/下穿|低于|小于|跌破|<=|</u.test(message)) return { direction: 'down' }
    return {}
  }

  private normalizeActionKey(value: string | undefined): SemanticActionKey | null {
    const text = value?.trim().toLowerCase().replace(/[\s-]+/g, '_')
    if (!text) return null
    if (/close_?long|平多|卖出/u.test(text)) return 'close_long'
    if (/close_?short|平空/u.test(text)) return 'close_short'
    if (/open_?long|(?:^|_)long$|开多|做多|买入|买多/u.test(text)) return 'open_long'
    if (/open_?short|(?:^|_)short$|开空|做空|卖空/u.test(text)) return 'open_short'
    if (/^(开多|做多|买入|买多|open_long|long)$/iu.test(text)) return 'open_long'
    if (/^(开空|做空|卖空|open_short|short)$/iu.test(text)) return 'open_short'
    if (/^(平多|卖出|close_long)$/iu.test(text)) return 'close_long'
    if (/^(平空|close_short)$/iu.test(text)) return 'close_short'
    return null
  }

  private actionSide(action: SemanticActionKey): 'long' | 'short' {
    return action.endsWith('_short') ? 'short' : 'long'
  }

  private pairedActionForSide(action: SemanticActionKey, side: 'long' | 'short'): SemanticActionKey | null {
    if (action.startsWith('open_')) return side === 'long' ? 'close_long' : 'close_short'
    if (action.startsWith('close_')) return side === 'long' ? 'open_long' : 'open_short'
    return null
  }

  private replacePositionModeSide(
    current: string,
    fromSide: 'long' | 'short',
    toSide: 'long' | 'short',
  ): string {
    if (current === `${fromSide}_only`) return `${toSide}_only`
    return current
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
        || this.extractActionReplacement(message) !== null
        || this.extractTriggerNumberReplacement(message) !== null
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
