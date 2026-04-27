import type { MutableRefObject } from 'react'

import type { ConversationState } from './ai-quant-page-conversation'
import type { BacktestCapabilities } from '@/components/ai-quant/backtest-capability-client'
import {
  buildLocalizedBacktestErrorMessage,
  parseAiQuantErrorMeta,
} from '@/components/ai-quant/ai-quant-error-stage'
import {
  createBacktestJob,
  formatBacktestJobFailure,
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
import {
  buildBacktestSummaryResult,
  buildBacktestDraftConfigFromValues,
  hasLatestPublishedCode,
  isDeployableBacktestResult,
  isOpenOnlyBacktestResult,
  requiresRepublishForPublishedSnapshot,
  resolveEffectivePublishedBacktestInputs,
  resolveBacktestExecutionConfig,
  resolvePublishedBacktestMarketType,
  resolveBacktestRangeInput,
} from './ai-quant-page-conversation'

export const BACKTEST_JOB_POLL_INTERVAL_MS = 1500
export const BACKTEST_JOB_TIMEOUT_MS = 180_000

type Translate = (key: string, options?: Record<string, unknown>) => string

function isTransientBacktestError(error: unknown): boolean {
  const candidate = error as {
    code?: unknown
    statusCode?: unknown
    status?: unknown
    details?: { error?: { code?: unknown; requestId?: unknown } }
  } | null
  const code = candidate?.code
  const nestedCode = candidate?.details?.error?.code
  const status = typeof candidate?.statusCode === 'number'
    ? candidate.statusCode
    : typeof candidate?.status === 'number'
      ? candidate.status
      : undefined

  if (
    code === 'SERVICE_TEMPORARILY_UNAVAILABLE'
    || code === 'API_TIMEOUT'
    || nestedCode === 'SERVICE_TEMPORARILY_UNAVAILABLE'
  ) {
    return true
  }

  return status === 502 || status === 503 || status === 504
}

function buildInvalidExecutionConfigMessage(args: {
  activeConversation: ConversationState
  executionConfig: ReturnType<typeof resolveBacktestExecutionConfig>
  marketType: 'spot' | 'perp' | null
  t: Translate
}): string {
  const { activeConversation, executionConfig, marketType, t } = args

  if (activeConversation.publishedSnapshotId) {
    if (
      !activeConversation.publishedSnapshotStrategyConfig ||
      activeConversation.publishedSnapshotCompatibilityMetadata?.requiresRepublishForBacktest
    ) {
      return t('aiQuant.messages.backtestPayloadInvalid', {
        reason:
          'published_snapshot_backtest_truth_missing：当前已发布快照缺少策略市场绑定真相，请重新发布后再回测。',
      })
    }
  }

  if (!marketType) {
    return '请先确认策略交易的是现货还是合约，然后再开始回测。'
  }

  if (!executionConfig.allowPartialValid) {
    return t('aiQuant.messages.backtestPayloadInvalid', {
      reason: 'invalid_allow_partial：是否允许部分成交只能是 true 或 false。',
    })
  }

  const invalidFields: string[] = []
  const leverage = executionConfig.leverage
  if (!Number.isFinite(executionConfig.initialCash) || executionConfig.initialCash <= 0) {
    invalidFields.push('初始资金')
  }
  if (marketType === 'perp' && (!Number.isFinite(leverage) || (leverage ?? 0) <= 0)) {
    invalidFields.push('杠杆')
  }
  if (!Number.isFinite(executionConfig.slippageBps) || executionConfig.slippageBps < 0) {
    invalidFields.push('滑点')
  }
  if (!Number.isFinite(executionConfig.feeBps) || executionConfig.feeBps < 0) {
    invalidFields.push('手续费')
  }
  if (
    executionConfig.priceSource !== 'open' &&
    executionConfig.priceSource !== 'close' &&
    executionConfig.priceSource !== 'mid'
  ) {
    invalidFields.push('成交价来源')
  }

  if (invalidFields.length > 0) {
    return t('aiQuant.messages.backtestPayloadInvalid', {
      reason: `invalid_execution_config：以下回测执行参数无效或缺失：${invalidFields.join('、')}。`,
    })
  }

  return t('aiQuant.messages.backtestPayloadInvalid', {
    reason: 'invalid_execution_config：回测执行参数无效，请重新检查后再试。',
  })
}

function buildBacktestTimeoutMessage(args: { createdJobId: string; t: Translate }): string {
  return args.t('aiQuant.messages.backtestTimeout', {
    jobId: args.createdJobId,
  })
}

function buildDynamicBacktestAvailabilityMessage(
  t: Translate,
  code: string | undefined,
  args?: Record<string, unknown>,
): string | null {
  if (!code) return null

  if (
    code === 'BACKTEST_SNAPSHOT_REQUIRED'
    || code === 'BACKTEST_SNAPSHOT_SYMBOL_MISSING'
    || code === 'BACKTEST_SNAPSHOT_MARKET_TYPE_MISSING'
    || code === 'BACKTEST_SNAPSHOT_TIMEFRAME_MISSING'
    || code === 'BACKTEST_SYMBOL_UNAVAILABLE'
    || code === 'BACKTEST_SYMBOL_REFRESH_FAILED'
    || code === 'BACKTEST_MARKET_DATA_UNAVAILABLE'
    || code === 'BACKTEST_SERVICE_TEMPORARILY_UNAVAILABLE'
    || code === 'SERVICE_TEMPORARILY_UNAVAILABLE'
  ) {
    return buildLocalizedBacktestErrorMessage(t, 400, {
      code,
      stage: 'backtest',
      args,
    })
  }

  return null
}

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
          content: t('aiQuant.messages.backtestCapabilityLoadFailed', {
            defaultValue: '回测能力加载失败，请稍后重试。',
          }),
        },
      ],
      updatedAt: Date.now(),
    }))
    return
  }

  if (
    activeConversation.backtestExecutionState === 'submitting' ||
    activeConversation.backtestExecutionState === 'running'
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
  let backtestExchange: ConversationState['params']['exchange'] | null = null
  let backtestMarketType: 'spot' | 'perp' | null = null
  let backtestDraftConfig: ReturnType<typeof buildBacktestDraftConfigFromValues> = null
  const serverConversationId =
    typeof activeConversation.serverConversationId === 'string'
      && activeConversation.serverConversationId.trim()
      ? activeConversation.serverConversationId.trim()
      : null
  try {
    const publishedMarketType = resolvePublishedBacktestMarketType({
      publishedSnapshotId: activeConversation.publishedSnapshotId,
      publishedSnapshotStrategyConfig: activeConversation.publishedSnapshotStrategyConfig,
    })
    if (!publishedMarketType) {
      throw new ApiError(
        '请先确认策略交易的是现货还是合约，然后再开始回测。',
        'MARKET_TYPE_UNCONFIRMED',
      )
    }

    const effectiveInputs = resolveEffectivePublishedBacktestInputs({
      publishedSnapshotId: activeConversation.publishedSnapshotId,
      publishedSnapshotStrategyConfig: activeConversation.publishedSnapshotStrategyConfig,
    })
    if (!effectiveInputs) {
      throw new ApiError(
        '当前已发布快照缺少策略市场绑定真相，请重新发布后再回测。',
        'PUBLISHED_SNAPSHOT_PARAMS_MISSING',
      )
    }
    if (
      requiresRepublishForPublishedSnapshot({
        publishedSnapshotId: activeConversation.publishedSnapshotId,
        publishedSnapshotParamValues: activeConversation.publishedSnapshotParamValues,
        publishedSnapshotCompatibilityMetadata:
          activeConversation.publishedSnapshotCompatibilityMetadata,
        editableParamValues: activeConversation.paramValues,
      })
    ) {
      throw new ApiError('当前参数已脱离已发布快照，请重新发布后再回测。', 'REPUBLISH_REQUIRED')
    }

    const executionConfig = resolveBacktestExecutionConfig(activeConversation.paramValues)
    const snapshotStateTimeframes =
      activeConversation.publishedSnapshotBacktestConfigDefaults?.stateTimeframes ?? []
    if (!executionConfig.allowPartialValid) {
      throw new BacktestPayloadBuilderError('invalid_execution_config')
    }
    backtestExchange = effectiveInputs.exchange
    backtestMarketType = effectiveInputs.marketType
    payload = buildBacktestPayload({
      symbol: effectiveInputs.symbol,
      baseTimeframe: effectiveInputs.baseTimeframe,
      marketType: effectiveInputs.marketType,
      capabilities: backtestCapabilities,
      stateTimeframes:
        snapshotStateTimeframes.length > 0
          ? snapshotStateTimeframes
          : [effectiveInputs.baseTimeframe],
      initialCash: executionConfig.initialCash,
      leverage: executionConfig.leverage,
      execution: {
        slippageBps: executionConfig.slippageBps,
        feeBps: executionConfig.feeBps,
        priceSource: executionConfig.priceSource as 'open' | 'close' | 'mid',
      },
      strategy: {
        id:
          activeConversation.publishedStrategyInstanceId ??
          activeConversation.llmCodegenSessionId ??
          activeConversation.publishedSnapshotId ??
          '',
        publishedSnapshotId: activeConversation.publishedSnapshotId ?? '',
      },
      ...(serverConversationId ? { conversationId: serverConversationId } : {}),
      sessionId: activeConversation.llmCodegenSessionId,
      range: resolveBacktestRangeInput(activeConversation.paramValues),
      allowPartial: executionConfig.allowPartial,
    })
    backtestDraftConfig = buildBacktestDraftConfigFromValues(activeConversation.paramValues)
  } catch (error) {
    releaseMutex()
    const message = (() => {
      if (error instanceof ApiError && error.message.trim()) {
        return error.message
      }
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
          return buildInvalidExecutionConfigMessage({
            activeConversation,
            executionConfig: resolveBacktestExecutionConfig(activeConversation.paramValues),
            marketType: resolvePublishedBacktestMarketType({
              publishedSnapshotId: activeConversation.publishedSnapshotId,
              publishedSnapshotStrategyConfig: activeConversation.publishedSnapshotStrategyConfig,
            }),
            t,
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
  const toFailureMessage = (reason: string, errorArgs?: Record<string, unknown>) =>
    buildDynamicBacktestAvailabilityMessage(t, reason, errorArgs)
    ?? t('aiQuant.messages.backtestPayloadInvalid', { reason })
  const canContinue = () =>
    isMountedRef.current &&
    backtestRunTokenRef.current.get(conversationId) === runToken &&
    activeConversationIdRef.current === conversationId

  setConversationBacktestExecutionState(conversationId, 'submitting')
  updateConversationById(conversationId, curr => ({
    ...curr,
    backtestDraftConfig: backtestDraftConfig ?? curr.backtestDraftConfig,
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
      exchange: backtestExchange ?? activeConversation.params.exchange,
      marketType:
        backtestMarketType
        ?? resolvePublishedBacktestMarketType({
          publishedSnapshotId: activeConversation.publishedSnapshotId,
          publishedSnapshotStrategyConfig: activeConversation.publishedSnapshotStrategyConfig,
        })
        ?? 'spot',
      symbol: payload.symbols[0],
      baseTimeframe: payload.baseTimeframe,
    })
    if (!canContinue()) {
      return
    }
    if (support.status === 'not_supported') {
      setConversationBacktestExecutionState(conversationId, 'failed')
      updateBacktestMessage(
        buildDynamicBacktestAvailabilityMessage(t, support.reasonCode, support.args)
          ?? toFailureMessage('symbol_not_supported'),
      )
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
        updateBacktestMessage(
          buildBacktestTimeoutMessage({
            createdJobId: createdJob.id,
            t,
          }),
        )
        return
      }
      await new Promise(resolve => window.setTimeout(resolve, BACKTEST_JOB_POLL_INTERVAL_MS))
      if (!canContinue()) {
        return
      }
      try {
        latestJob = await getBacktestJob(createdJob.id)
      } catch (error) {
        if (!isTransientBacktestError(error)) {
          throw error
        }
        const diagnostics = error instanceof ApiError
          ? {
              jobId: createdJob.id,
              code: error.code,
              statusCode: error.statusCode,
              requestId: (error.details as { error?: { requestId?: unknown } } | undefined)?.error?.requestId,
            }
          : {
              jobId: createdJob.id,
            }
        console.warn('[ai-quant][backtest-job-poll] transient failure, retrying', diagnostics)
        continue
      }
    }

    if (!canContinue()) {
      return
    }
    if (latestJob.status === 'failed') {
      setConversationBacktestExecutionState(conversationId, 'failed')
      updateBacktestMessage(formatBacktestJobFailure(latestJob))
      return
    }

    let jobResult
    try {
      jobResult = await getBacktestJobResult(createdJob.id)
    } catch (error) {
      if (!isTransientBacktestError(error)) {
        throw error
      }
      const diagnostics = error instanceof ApiError
        ? {
            jobId: createdJob.id,
            code: error.code,
            statusCode: error.statusCode,
            requestId: (error.details as { error?: { requestId?: unknown } } | undefined)?.error?.requestId,
          }
        : {
            jobId: createdJob.id,
          }
      console.warn('[ai-quant][backtest-job-result] transient failure, retrying', diagnostics)
      await new Promise(resolve => window.setTimeout(resolve, BACKTEST_JOB_POLL_INTERVAL_MS))
      if (!canContinue()) {
        return
      }
      jobResult = await getBacktestJobResult(createdJob.id)
    }
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
        marketType: backtestMarketType,
        symbol: payload.symbols[0],
        startAt: new Date(payload.dataRange.fromTs).toISOString(),
        endAt: new Date(payload.dataRange.toTs).toISOString(),
      },
      summary,
    )

    setConversationBacktestExecutionState(conversationId, 'succeeded')
    updateConversationById(conversationId, curr => ({
      ...curr,
      backtestDraftConfig: backtestDraftConfig ?? curr.backtestDraftConfig,
      backtestResult: result,
      messages: curr.messages.map(message =>
        message.id === backtestMessageId
          ? {
              ...message,
              content: isDeployableBacktestResult(result)
                ? t('aiQuant.messages.backtestSuccess', { drawdown: result.maxDrawdownPct })
                : result.maxDrawdownPct > 20
                  ? t('aiQuant.messages.backtestFail', { drawdown: result.maxDrawdownPct })
                  : isOpenOnlyBacktestResult(result)
                  ? t('aiQuant.messages.backtestOpenTrades', { count: result.openTradeCount ?? 0 })
                  : result.tradeCount === 0
                  ? t('aiQuant.messages.backtestNoTrades')
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
    const message = (() => {
      if (!(error instanceof ApiError)) {
        return toFailureMessage('unknown_error')
      }

      const meta = parseAiQuantErrorMeta(error.details)
      return (
        buildDynamicBacktestAvailabilityMessage(t, error.code || meta.code, meta.args)
        ?? error.message?.trim()
        ?? toFailureMessage('unknown_error')
      )
    })()
    updateBacktestMessage(message)
  } finally {
    releaseMutex()
  }
}
