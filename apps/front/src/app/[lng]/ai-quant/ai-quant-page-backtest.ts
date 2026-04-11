import type { MutableRefObject } from 'react'

import type { BacktestCapabilities } from '@/components/ai-quant/backtest-capability-client'
import {
  createBacktestJob,
  getBacktestJob,
  getBacktestJobResult,
} from '@/components/ai-quant/backtest-job-client'
import {
  BacktestPayloadBuilderError,
  buildBacktestPayload,
  isBacktestPayloadBuilderError,
} from '@/components/ai-quant/backtest-payload-builder'
import { checkBacktestSymbolSupport } from '@/components/ai-quant/backtest-symbol-support-client'
import { ApiError } from '@/lib/errors'

import type { ConversationState } from './ai-quant-page-conversation'
import {
  buildBacktestSummaryResult,
  hasLatestPublishedCode,
  resolveBacktestExecutionConfig,
  resolveBacktestRangeInput,
} from './ai-quant-page-conversation'

export const BACKTEST_JOB_POLL_INTERVAL_MS = 1500
export const BACKTEST_JOB_TIMEOUT_MS = 60_000

type Translate = (key: string, options?: Record<string, unknown>) => string

export async function runAiQuantBacktest(args: {
  activeConversation: ConversationState
  activeConversationIdRef: MutableRefObject<string>
  backtestCapabilities: BacktestCapabilities | null
  backtestCapabilityState: 'loading' | 'ready' | 'failed'
  backtestRunMutexRef: MutableRefObject<Set<string>>
  backtestRunTokenRef: MutableRefObject<Map<string, number>>
  graphConfirmed: boolean
  isMountedRef: MutableRefObject<boolean>
  setConversationBacktestExecutionState: (
    conversationId: string,
    state: ConversationState['backtestExecutionState'],
  ) => void
  t: Translate
  updateConversationById: (
    conversationId: string,
    updater: (curr: ConversationState) => ConversationState,
  ) => void
}): Promise<void> {
  const {
    activeConversation,
    activeConversationIdRef,
    backtestCapabilities,
    backtestCapabilityState,
    backtestRunMutexRef,
    backtestRunTokenRef,
    graphConfirmed,
    isMountedRef,
    setConversationBacktestExecutionState,
    t,
    updateConversationById,
  } = args

  const conversationId = activeConversation.id
  if (backtestRunMutexRef.current.has(conversationId)) {
    return
  }
  backtestRunMutexRef.current.add(conversationId)

  const releaseMutex = () => {
    backtestRunMutexRef.current.delete(conversationId)
  }

  if (backtestCapabilityState !== 'ready' || !backtestCapabilities) {
    releaseMutex()
    updateConversationById(conversationId, curr => ({
      ...curr,
      messages: [
        ...curr.messages,
        {
          id: `capability-guard-${Date.now()}`,
          role: 'assistant',
          content: 'aiQuant.messages.backtestCapabilityLoadFailed',
        },
      ],
      updatedAt: Date.now(),
    }))
    return
  }

  if (
    activeConversation.backtestExecutionState === 'submitting'
    || activeConversation.backtestExecutionState === 'running'
  ) {
    releaseMutex()
    return
  }

  if (!graphConfirmed || !hasLatestPublishedCode(activeConversation)) {
    releaseMutex()
    updateConversationById(conversationId, curr => ({
      ...curr,
      messages: [
        ...curr.messages,
        {
          id: `backtest-guard-${Date.now()}`,
          role: 'assistant',
          content: !graphConfirmed
            ? t('aiQuant.messages.graphGuard')
            : t('aiQuant.messages.codegenGuard', {
                defaultValue: 'Please generate strategy code before running backtest.',
              }),
        },
      ],
      updatedAt: Date.now(),
    }))
    return
  }

  let payload: ReturnType<typeof buildBacktestPayload>
  try {
    const paramValues = activeConversation.paramValues
    const executionConfig = resolveBacktestExecutionConfig(paramValues)
    if (!executionConfig.allowPartialValid) {
      throw new BacktestPayloadBuilderError('invalid_execution_config')
    }
    payload = buildBacktestPayload({
      symbol: activeConversation.params.symbol,
      baseTimeframe: activeConversation.params.baseTimeframe,
      capabilities: backtestCapabilities,
      stateTimeframes: [activeConversation.params.baseTimeframe],
      initialCash: executionConfig.initialCash,
      leverage: executionConfig.leverage,
      execution: {
        slippageBps: executionConfig.slippageBps,
        feeBps: executionConfig.feeBps,
        priceSource: executionConfig.priceSource as 'open' | 'close' | 'mid',
      },
      strategy: {
        id:
          activeConversation.publishedStrategyInstanceId
          ?? activeConversation.llmCodegenSessionId
          ?? activeConversation.publishedSnapshotId
          ?? '',
        publishedSnapshotId: activeConversation.publishedSnapshotId ?? '',
      },
      range: resolveBacktestRangeInput(activeConversation.paramValues),
      allowPartial: executionConfig.allowPartial,
    })
  } catch (error) {
    releaseMutex()
    const message = (() => {
      if (!isBacktestPayloadBuilderError(error)) {
        return t('aiQuant.messages.backtestPayloadInvalid', { reason: 'unknown_error' })
      }

      switch (error.code) {
        case 'missing_range':
          return t('aiQuant.messages.backtestRangeMissing')
        case 'start_after_end':
          return t('aiQuant.messages.backtestRangeOrderInvalid')
        case 'range_too_large':
          return t('aiQuant.messages.backtestRangeTooLarge')
        case 'missing_published_snapshot':
          return t('aiQuant.messages.backtestMissingScriptCode')
        case 'invalid_execution_config':
          return t('aiQuant.messages.backtestPayloadInvalid', {
            reason: 'invalid_execution_config',
          })
        case 'missing_symbol':
        default:
          return t('aiQuant.messages.backtestPayloadInvalid', { reason: error.code })
      }
    })()
    updateConversationById(conversationId, curr => ({
      ...curr,
      messages: [
        ...curr.messages,
        {
          id: `bt-invalid-${Date.now()}`,
          role: 'assistant',
          content: message,
        },
      ],
      updatedAt: Date.now(),
    }))
    return
  }

  const runToken = (backtestRunTokenRef.current.get(conversationId) ?? 0) + 1
  backtestRunTokenRef.current.set(conversationId, runToken)
  const backtestMessageId = `bt-${Date.now()}`
  const updateBacktestMessage = (content: string) => {
    updateConversationById(conversationId, curr => {
      const hasBacktestMessage = curr.messages.some(message => message.id === backtestMessageId)
      return {
        ...curr,
        messages: hasBacktestMessage
          ? curr.messages.map(message =>
              message.id === backtestMessageId ? { ...message, content } : message,
            )
          : [
              ...curr.messages,
              {
                id: backtestMessageId,
                role: 'assistant',
                content,
              },
            ],
        updatedAt: Date.now(),
      }
    })
  }
  const toFailureMessage = (reason: string) =>
    t('aiQuant.messages.backtestPayloadInvalid', { reason })
  const canContinue = () =>
    isMountedRef.current
    && backtestRunTokenRef.current.get(conversationId) === runToken
    && activeConversationIdRef.current === conversationId

  setConversationBacktestExecutionState(conversationId, 'submitting')
  updateConversationById(conversationId, curr => ({
    ...curr,
    backtestResult: null,
    messages: [
      ...curr.messages,
      {
        id: backtestMessageId,
        role: 'assistant',
        content: t('aiQuant.messages.backtestRunning', {
          defaultValue: '正在回测中，请稍后...',
        }),
      },
    ],
    updatedAt: Date.now(),
  }))

  try {
    const support = await checkBacktestSymbolSupport({
      exchange: activeConversation.params.exchange,
      symbol: payload.symbols[0],
    })
    if (!canContinue()) {
      return
    }
    if (support.status === 'not_supported') {
      setConversationBacktestExecutionState(conversationId, 'failed')
      updateBacktestMessage(toFailureMessage('symbol_not_supported'))
      return
    }

    const createdJob = await createBacktestJob(payload)
    if (!canContinue()) {
      return
    }
    setConversationBacktestExecutionState(conversationId, 'running')

    const deadline = Date.now() + BACKTEST_JOB_TIMEOUT_MS
    let latestJob = createdJob

    while (latestJob.status === 'queued' || latestJob.status === 'running') {
      if (!canContinue()) {
        return
      }
      if (Date.now() >= deadline) {
        setConversationBacktestExecutionState(conversationId, 'timeout')
        updateBacktestMessage(toFailureMessage('timeout'))
        return
      }
      await new Promise(resolve => window.setTimeout(resolve, BACKTEST_JOB_POLL_INTERVAL_MS))
      if (!canContinue()) {
        return
      }
      latestJob = await getBacktestJob(createdJob.id)
    }

    if (!canContinue()) {
      return
    }
    if (latestJob.status === 'failed') {
      setConversationBacktestExecutionState(conversationId, 'failed')
      updateBacktestMessage(toFailureMessage(latestJob.error ?? 'job_failed'))
      return
    }

    const jobResult = await getBacktestJobResult(createdJob.id)
    if (!canContinue()) {
      return
    }
    const summary = jobResult.summary
    const result = buildBacktestSummaryResult(
      {
        id: createdJob.id,
        maxDrawdownPct: 0,
        totalReturnPct: 0,
        winRatePct: 0,
        tradeCount: 0,
        symbol: payload.symbols[0],
        startAt: new Date(payload.dataRange.fromTs).toISOString(),
        endAt: new Date(payload.dataRange.toTs).toISOString(),
      },
      summary,
    )

    setConversationBacktestExecutionState(conversationId, 'succeeded')
    updateConversationById(conversationId, curr => ({
      ...curr,
      backtestResult: result,
      messages: curr.messages.map(message =>
        message.id === backtestMessageId
          ? {
              ...message,
              content:
                result.maxDrawdownPct <= 20
                  ? t('aiQuant.messages.backtestSuccess', { drawdown: result.maxDrawdownPct })
                  : t('aiQuant.messages.backtestFail', { drawdown: result.maxDrawdownPct }),
            }
          : message,
      ),
      updatedAt: Date.now(),
    }))
  } catch (error) {
    if (!canContinue()) {
      return
    }
    setConversationBacktestExecutionState(conversationId, 'failed')
    const message =
      error instanceof ApiError
        ? error.message?.trim() || toFailureMessage('unknown_error')
        : toFailureMessage('unknown_error')
    updateBacktestMessage(message)
  } finally {
    releaseMutex()
  }
}
