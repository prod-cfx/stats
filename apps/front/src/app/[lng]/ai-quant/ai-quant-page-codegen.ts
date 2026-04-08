import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import {
  buildAiQuantStageFallbackMessage,
  parseAiQuantErrorMeta,
} from '@/components/ai-quant/ai-quant-error-stage'
import { buildLogicGraphFromCodegenSpec } from '@/components/ai-quant/llm-logic-graph'
import {
  resolveChecklistPayload,
} from '@/components/ai-quant/session-loop'
import {
  applyCapabilitiesToParamSchema,
  syncStrategyParamsFromCodegen,
} from '@/components/ai-quant/strategy-param-sync'
import type { BacktestCapabilities } from '@/components/ai-quant/backtest-capability-client'
import {
  continueLlmCodegenSession,
  getLlmCodegenSession,
  startLlmCodegenSession,
  type LlmCodegenSessionResponse,
} from '@/lib/api'
import { ApiError } from '@/lib/errors'

import type { ConversationState, QuantParams } from './ai-quant-page-conversation'
import { normalizeParamsFromValues } from './ai-quant-page-conversation'

const CODEGEN_TERMINAL_STATUSES = new Set(['PUBLISHED', 'REJECTED'])
const CODEGEN_PROCESSING_STATUSES = new Set([
  'GENERATING',
  'VALIDATING_STATIC',
  'VALIDATING_RUNTIME',
  'VALIDATING_OUTPUT',
  'VALIDATING_CONSISTENCY',
])
const CODEGEN_RECOVERABLE_STATUSES = new Set([
  ...CODEGEN_TERMINAL_STATUSES,
  ...CODEGEN_PROCESSING_STATUSES,
  'CHECKLIST_GATE',
  'CONSISTENCY_FAILED',
])

function isCodegenTerminalStatus(status: string): boolean {
  return CODEGEN_TERMINAL_STATUSES.has(status)
}

function isCodegenProcessingStatus(status: string): boolean {
  return CODEGEN_PROCESSING_STATUSES.has(status)
}

function isRecoverableCodegenStatus(status: string): boolean {
  return CODEGEN_RECOVERABLE_STATUSES.has(status)
}

export function buildCodegenReplyContent(args: {
  response: LlmCodegenSessionResponse
  confirmGenerate: boolean
  publishedReply: string
  graphGeneratedMessage: string
  graphReviseMessage: string
  checklistContinuedMessage: string
  checklistUpdatedMessage: string
  stillGeneratingPrefix: string
  rejectedPrefix: string
  rejectedWithoutReason: string
}): string {
  const {
    response,
    confirmGenerate,
    publishedReply,
    graphGeneratedMessage,
    graphReviseMessage,
    checklistContinuedMessage,
    checklistUpdatedMessage,
    stillGeneratingPrefix,
    rejectedPrefix,
    rejectedWithoutReason,
  } = args
  if (response.assistantPrompt) {
    return response.assistantPrompt
  }
  if (response.status === 'PUBLISHED') {
    if (response.rejectReason) {
      return `${rejectedPrefix}：${response.rejectReason}`
    }
    return publishedReply
  }
  if (response.status === 'CHECKLIST_GATE') {
    return confirmGenerate ? checklistContinuedMessage : checklistUpdatedMessage
  }
  if (isCodegenProcessingStatus(response.status)) {
    return `${stillGeneratingPrefix}（${response.status}）`
  }
  if (response.status === 'REJECTED') {
    return response.rejectReason
      ? `${rejectedPrefix}：${response.rejectReason}`
      : rejectedWithoutReason
  }
  if (response.status === 'CONSISTENCY_FAILED') {
    return response.rejectReason
      ? `${rejectedPrefix}：${response.rejectReason}`
      : rejectedWithoutReason
  }
  return response.scriptCode ? graphGeneratedMessage : graphReviseMessage
}

export function getSemanticGraphValidationMessage(
  validationReport: ConversationState['validationReport'],
  fallback: string,
): string {
  const message = validationReport?.errors.find(error => error.message.trim())?.message?.trim()
  return message || fallback
}

function hasSemanticGraphPayload(
  response: LlmCodegenSessionResponse,
  key: 'semanticGraph' | 'validationReport',
): boolean {
  return Object.prototype.hasOwnProperty.call(response, key)
}

export function resolvePublishedStrategyInstanceId(args: {
  response: LlmCodegenSessionResponse
  isStartingNewSession: boolean
}): string | null {
  const { response, isStartingNewSession } = args
  if (response.status === 'PUBLISHED' && !response.rejectReason) {
    return response.strategyInstanceId ?? null
  }
  if (isStartingNewSession || response.status === 'REJECTED') {
    return null
  }
  return null
}

function normalizePublishedScriptCode(scriptCode: unknown): string | null {
  if (typeof scriptCode !== 'string') {
    return null
  }
  const normalized = scriptCode.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizePublishedSnapshotId(snapshotId: unknown): string | null {
  if (typeof snapshotId !== 'string') {
    return null
  }
  const normalized = snapshotId.trim()
  return normalized.length > 0 ? normalized : null
}

export function extractCodegenErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) {
    return fallback
  }

  const details = error.details
  const meta = parseAiQuantErrorMeta(details)

  if (details && typeof details === 'object') {
    const record = details as Record<string, unknown>
    const directRejectReason = record.rejectReason
    if (typeof directRejectReason === 'string' && directRejectReason.trim()) {
      return directRejectReason.trim()
    }

    const data = record.data
    if (data && typeof data === 'object') {
      const nestedRejectReason = (data as Record<string, unknown>).rejectReason
      if (typeof nestedRejectReason === 'string' && nestedRejectReason.trim()) {
        return nestedRejectReason.trim()
      }
      const nestedMessage = (data as Record<string, unknown>).message
      if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
        return nestedMessage.trim()
      }
    }
  }

  if (meta.message) {
    return meta.message
  }

  if (error.message?.trim()) {
    return error.message.trim()
  }

  return buildAiQuantStageFallbackMessage(fallback, error.statusCode ?? 500, {
    ...meta,
    code: meta.code ?? error.code,
  })
}

function isTerminalSessionConflict(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.statusCode !== 409) {
    return false
  }

  if (error.code === 'codegen.session_terminal_status') {
    return true
  }

  if (
    error.message.includes('会话已终态')
    || error.message.includes('codegen.session_terminal_status')
  ) {
    return true
  }

  const details = error.details
  if (!details || typeof details !== 'object') {
    return false
  }

  const detailRecord = details as Record<string, unknown>
  const nestedError = detailRecord.error
  if (!nestedError || typeof nestedError !== 'object') {
    return false
  }

  const nestedCode = (nestedError as Record<string, unknown>).code
  if (typeof nestedCode === 'string' && nestedCode === 'codegen.session_terminal_status') {
    return true
  }

  const nestedMessage = (nestedError as Record<string, unknown>).message
  if (typeof nestedMessage === 'string') {
    return (
      nestedMessage.includes('会话已终态')
      || nestedMessage.includes('codegen.session_terminal_status')
    )
  }

  return false
}

type Translate = (key: string, options?: Record<string, unknown>) => string

function updateConversationById(
  setConversations: Dispatch<SetStateAction<ConversationState[]>>,
  conversationId: string,
  updater: (curr: ConversationState) => ConversationState,
) {
  setConversations(prev => prev.map(conv => (conv.id === conversationId ? updater(conv) : conv)))
}

export async function requestAiQuantCodegen(args: {
  backtestCapabilities: BacktestCapabilities | null
  callingMessage: (elapsedSec: number) => string
  codegenRequestMutexRef: MutableRefObject<Set<string>>
  confirmGenerate?: boolean
  conversationId: string
  conversations: ConversationState[]
  message: string
  params: QuantParams
  sessionId: string | null
  sessionUserId: string | null | undefined
  setCodegenBusyConversationIds: Dispatch<SetStateAction<string[]>>
  setConversations: Dispatch<SetStateAction<ConversationState[]>>
  t: Translate
  usePresetRules?: boolean
}): Promise<void> {
  const {
    backtestCapabilities,
    callingMessage,
    codegenRequestMutexRef,
    confirmGenerate = false,
    conversationId,
    conversations,
    message,
    params: targetParams,
    sessionId,
    sessionUserId,
    setCodegenBusyConversationIds,
    setConversations,
    t,
    usePresetRules = false,
  } = args

  if (!sessionUserId) return
  if (codegenRequestMutexRef.current.has(conversationId)) return
  codegenRequestMutexRef.current.add(conversationId)
  setCodegenBusyConversationIds(prev =>
    prev.includes(conversationId) ? prev : [...prev, conversationId],
  )

  let activeSessionId = sessionId
  const trimmedMessage = message.trim()
  if (!trimmedMessage) {
    codegenRequestMutexRef.current.delete(conversationId)
    setCodegenBusyConversationIds(prev => prev.filter(id => id !== conversationId))
    return
  }

  const loadingMessageId = `a-loading-${Date.now()}`
  const startedAt = Date.now()

  setConversations(prev =>
    prev.map(conv => {
      if (conv.id !== conversationId) return conv
      return {
        ...conv,
        publishedStrategyInstanceId: activeSessionId ? conv.publishedStrategyInstanceId : null,
        messages: [
          ...conv.messages,
          {
            id: loadingMessageId,
            role: 'assistant',
            content: callingMessage(0),
          },
        ],
        updatedAt: Date.now(),
      }
    }),
  )

  const loadingTimer = window.setInterval(() => {
    const elapsedSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
    setConversations(prev =>
      prev.map(conv => {
        if (conv.id !== conversationId) return conv
        return {
          ...conv,
          messages: conv.messages.map(msg =>
            msg.id === loadingMessageId ? { ...msg, content: callingMessage(elapsedSec) } : msg,
          ),
        }
      }),
    )
  }, 1000)

  const resolveProcessingSession = async (
    id: string,
    initial: LlmCodegenSessionResponse,
  ): Promise<LlmCodegenSessionResponse> => {
    if (!isCodegenProcessingStatus(initial.status)) {
      return initial
    }

    let current = initial
    const deadline = Date.now() + 120_000
    while (isCodegenProcessingStatus(current.status) && Date.now() < deadline) {
      await new Promise(resolve => window.setTimeout(resolve, 1500))
      current = await getLlmCodegenSession(id)
      if (isCodegenTerminalStatus(current.status) || current.status === 'CHECKLIST_GATE') {
        return current
      }
    }

    return current
  }

  const applyCodegenResponseToConversation = (
    response: Awaited<ReturnType<typeof continueLlmCodegenSession>>,
  ) => {
    setConversations(prev =>
      prev.map(conv => {
        if (conv.id !== conversationId) return conv
        const nextVersion = (conv.logicGraph?.version || 0) + 1
        const shouldReuseCodegenSession = !isCodegenTerminalStatus(response.status)
        const shouldUpdateGraph =
          (response.status === 'CHECKLIST_GATE' || response.status === 'PUBLISHED')
          && Boolean(response.specDesc)
        const syncResult = shouldUpdateGraph
          ? syncStrategyParamsFromCodegen({
              spec: response.specDesc,
              fallback: {
                exchange: targetParams.exchange,
                symbol: targetParams.symbol,
                baseTimeframe: targetParams.baseTimeframe,
                positionPct: targetParams.positionPct,
              },
              currentValues: conv.paramValues,
              capabilities: backtestCapabilities,
              contextText: trimmedMessage,
            })
          : null
        const nextParamValues = syncResult?.paramValues ?? conv.paramValues
        const nextParamSchema = shouldUpdateGraph
          ? applyCapabilitiesToParamSchema(syncResult?.paramSchema, backtestCapabilities)
          : conv.paramSchema
        const nextParams = syncResult
          ? normalizeParamsFromValues(nextParamValues, conv.params)
          : conv.params
        const nextGraphStatus =
          response.status === 'PUBLISHED' || confirmGenerate ? 'confirmed' : 'draft'
        const nextGraph = shouldUpdateGraph
          ? buildLogicGraphFromCodegenSpec(
              response.specDesc,
              {
                exchange: syncResult?.normalized.exchange ?? targetParams.exchange,
                symbol: syncResult?.normalized.symbol ?? targetParams.symbol,
                baseTimeframe: syncResult?.normalized.baseTimeframe ?? targetParams.baseTimeframe,
                positionPct: syncResult?.normalized.positionPct ?? targetParams.positionPct,
                executionTags: syncResult?.executionTags ?? [],
              },
              nextVersion,
              nextGraphStatus,
            )
          : conv.logicGraph
        const nextPublishedScriptCode = (() => {
          if (response.status === 'PUBLISHED' && !response.rejectReason) {
            const responseScriptCode = normalizePublishedScriptCode(response.scriptCode)
            if (responseScriptCode) {
              return responseScriptCode
            }
            if (!shouldUpdateGraph) {
              return conv.publishedScriptCode
            }
            return null
          }
          if (shouldUpdateGraph) {
            return null
          }
          return conv.publishedScriptCode
        })()
        const nextPublishedSnapshotId = (() => {
          if (response.status === 'PUBLISHED' && !response.rejectReason) {
            const snapshotId = normalizePublishedSnapshotId(response.publishedSnapshotId)
            if (snapshotId) {
              return snapshotId
            }
            if (!shouldUpdateGraph) {
              return conv.publishedSnapshotId
            }
            return null
          }
          if (shouldUpdateGraph) {
            return null
          }
          return conv.publishedSnapshotId
        })()
        const nextPublishedScriptGraphVersion = nextPublishedScriptCode
          ? (nextGraph?.version ?? conv.publishedScriptGraphVersion)
          : null
        const nextSemanticGraph = hasSemanticGraphPayload(response, 'semanticGraph')
          ? (response.semanticGraph ?? null)
          : conv.semanticGraph
        const nextValidationReport = hasSemanticGraphPayload(response, 'validationReport')
          ? (response.validationReport ?? null)
          : conv.validationReport
        const publishedReply = response.scriptCode
          ? `${
              confirmGenerate
                ? t('aiQuant.messages.codeGeneratedBacktest', {
                    defaultValue: 'Strategy code generated, ready to backtest.',
                  })
                : t('aiQuant.messages.graphGenerated')
            }\n\n${t('aiQuant.messages.generatedCodeTitle', { defaultValue: 'Generated strategy code:' })}\n\`\`\`javascript\n${response.scriptCode}\n\`\`\``
          : confirmGenerate
            ? t('aiQuant.messages.codeGeneratedBacktest', {
                defaultValue: 'Strategy code generated, ready to backtest.',
              })
            : t('aiQuant.messages.graphGenerated')
        const replyContent = buildCodegenReplyContent({
          response,
          confirmGenerate,
          publishedReply,
          graphGeneratedMessage: t('aiQuant.messages.graphGenerated'),
          graphReviseMessage: t('aiQuant.messages.graphRevise'),
          checklistContinuedMessage: t('aiQuant.messages.checklistContinued', {
            defaultValue:
              'Continued generation based on current logic graph. Please review the latest result.',
          }),
          checklistUpdatedMessage: t('aiQuant.messages.checklistUpdated', {
            defaultValue:
              'Logic graph updated. Please confirm it before I generate strategy code.',
          }),
          stillGeneratingPrefix: t('aiQuant.messages.stillGenerating', {
            defaultValue: 'Strategy code is still generating, please wait',
          }),
          rejectedPrefix: t('aiQuant.messages.generationFailedPrefix', {
            defaultValue: 'Failed to generate strategy from current logic graph',
          }),
          rejectedWithoutReason: t('aiQuant.messages.generationFailedNoReason', {
            defaultValue:
              'Failed to generate strategy from current logic graph: backend did not return a detailed reason. Please check service logs.',
          }),
        })
        return {
          ...conv,
          llmCodegenSessionId: shouldReuseCodegenSession ? activeSessionId : null,
          publishedStrategyInstanceId: resolvePublishedStrategyInstanceId({
            response,
            isStartingNewSession: !activeSessionId,
          }),
          publishedSnapshotId: nextPublishedSnapshotId,
          publishedScriptCode: nextPublishedScriptCode,
          publishedScriptGraphVersion: nextPublishedScriptGraphVersion,
          params: nextParams,
          paramSchema: nextParamSchema,
          paramValues: nextParamValues,
          logicGraph: nextGraph,
          semanticGraph: nextSemanticGraph,
          validationReport: nextValidationReport,
          backtestResult: null,
          latestSignalMessage: null,
          messages: [
            ...conv.messages.map(msg =>
              msg.id === loadingMessageId ? { ...msg, content: replyContent } : msg,
            ),
          ],
          updatedAt: Date.now(),
        }
      }),
    )
  }

  try {
    const currentConversation = conversations.find(conv => conv.id === conversationId)
    const checklistResult = resolveChecklistPayload({
      usePresetRules,
      confirmGenerate,
      message: trimmedMessage,
      sessionId,
      graph: currentConversation?.logicGraph,
      params: targetParams,
      paramSchema: currentConversation?.paramSchema ?? null,
      paramValues: currentConversation?.paramValues ?? null,
    })
    if ('error' in checklistResult) {
      const errorMessage =
        checklistResult.error.code === 'MISSING_REQUIRED_PARAMS'
          ? t('aiQuant.messages.missingRequiredParams', {
              keys: checklistResult.error.missingKeys.join(', '),
              defaultValue: `Missing required parameters: ${checklistResult.error.missingKeys.join(', ')}`,
            })
          : t('aiQuant.messages.invalidParams', {
              details: Object.entries(checklistResult.error.fieldErrors ?? {})
                .map(([key, reason]) => `${key}(${reason})`)
                .join(', '),
              defaultValue: `Parameter validation failed: ${Object.entries(
                checklistResult.error.fieldErrors ?? {},
              )
                .map(([key, reason]) => `${key}(${reason})`)
                .join(', ')}`,
            })
      updateConversationById(setConversations, conversationId, curr => ({
        ...curr,
        latestSignalMessage: null,
        messages: [
          ...curr.messages.map(msg =>
            msg.id === loadingMessageId ? { ...msg, content: errorMessage } : msg,
          ),
        ],
        updatedAt: Date.now(),
      }))
      return
    }
    const checklistPayload = checklistResult

    const startNewSession = async () =>
      startLlmCodegenSession({
        initialMessage: trimmedMessage,
        ...checklistPayload,
      })

    const continueSession = async (id: string) =>
      continueLlmCodegenSession(id, {
        message: trimmedMessage,
        confirmGenerate,
        ...checklistPayload,
      })

    const advanceConfirmGenerate = async (
      id: string,
      initial: Awaited<ReturnType<typeof continueSession>>,
    ) => {
      if (!confirmGenerate) {
        return initial
      }
      let current = initial
      let attempts = 0
      while (current.status === 'CHECKLIST_GATE' && attempts < 2) {
        current = await continueSession(id)
        attempts += 1
      }
      return current
    }

    let continued
    if (!activeSessionId) {
      const created = await startNewSession()
      activeSessionId = created.id
      if (confirmGenerate) {
        continued = await continueSession(activeSessionId)
        continued = await advanceConfirmGenerate(activeSessionId, continued)
        continued = await resolveProcessingSession(activeSessionId, continued)
      } else {
        continued = created
      }
    } else {
      try {
        continued = await continueSession(activeSessionId)
        continued = await advanceConfirmGenerate(activeSessionId, continued)
        continued = await resolveProcessingSession(activeSessionId, continued)
      } catch (error) {
        const isTerminalSessionError = isTerminalSessionConflict(error)
        if (!isTerminalSessionError) {
          throw error
        }

        let recovered: Awaited<ReturnType<typeof continueSession>> | null = null
        try {
          recovered = await getLlmCodegenSession(activeSessionId)
        } catch {
          recovered = null
        }

        if (recovered && (recovered.status === 'PUBLISHED' || recovered.status === 'REJECTED')) {
          continued = recovered
        } else {
          const recreated = await startNewSession()
          activeSessionId = recreated.id
          if (confirmGenerate) {
            continued = await continueSession(activeSessionId)
            continued = await advanceConfirmGenerate(activeSessionId, continued)
            continued = await resolveProcessingSession(activeSessionId, continued)
          } else {
            continued = recreated
          }
        }
      }
    }

    applyCodegenResponseToConversation(continued)
  } catch (error) {
    if (activeSessionId) {
      try {
        let recovered = await getLlmCodegenSession(activeSessionId)
        recovered = await resolveProcessingSession(activeSessionId, recovered)
        if (isRecoverableCodegenStatus(recovered.status)) {
          applyCodegenResponseToConversation(recovered)
          return
        }
      } catch {
        // keep original error branch
      }
    }
    const message = extractCodegenErrorMessage(error, t('common.error'))
    updateConversationById(setConversations, conversationId, curr => ({
      ...curr,
      latestSignalMessage: null,
      messages: [
        ...curr.messages.map(msg =>
          msg.id === loadingMessageId ? { ...msg, content: message } : msg,
        ),
      ],
      updatedAt: Date.now(),
    }))
  } finally {
    codegenRequestMutexRef.current.delete(conversationId)
    setCodegenBusyConversationIds(prev => prev.filter(id => id !== conversationId))
    window.clearInterval(loadingTimer)
  }
}
