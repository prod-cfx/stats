'use client'

import type { ConversationState, QuantParams } from './ai-quant-page-conversation'
import type { BacktestCapabilities } from '@/components/ai-quant/backtest-capability-client'
import type { DeployExchangeAccount } from '@/components/ai-quant/DeployDialog'
import type { QuantReturnIntentInput } from '@/components/ai-quant/intent-storage'
import type { QuantMessage } from '@/components/ai-quant/QuantChatPanel'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchBacktestCapabilities } from '@/components/ai-quant/backtest-capability-client'
import { getBacktestJobResult } from '@/components/ai-quant/backtest-job-client'
import { BacktestSummaryCard } from '@/components/ai-quant/BacktestSummaryCard'
import {
  canConfirmSemanticView,
  readCanonicalDigest,
} from '@/components/ai-quant/canonical-confirmation'
import { ConversationSidebar } from '@/components/ai-quant/ConversationSidebar'
import { DeployDialog } from '@/components/ai-quant/DeployDialog'
import { GuestAiQuantLanding } from '@/components/ai-quant/GuestAiQuantLanding'
import { clearIntent, getIntent, setIntent } from '@/components/ai-quant/intent-storage'
import { DisplayLogicGraphPreview } from '@/components/ai-quant/DisplayLogicGraphPreview'
import { LogicGraphPreview } from '@/components/ai-quant/LogicGraphPreview'
import { QuantChatPanel } from '@/components/ai-quant/QuantChatPanel'
import { SemanticGraphCard } from '@/components/ai-quant/SemanticGraphCard'
import { SemanticGraphValidationAlert } from '@/components/ai-quant/SemanticGraphValidationAlert'
import {
  buildAutoAdvanceMessage,
  isStrategyModificationIntent,
  shouldAutoAdvanceOnConfirmation,
} from '@/components/ai-quant/session-loop'
import { applyCapabilitiesToParamSchema } from '@/components/ai-quant/strategy-param-sync'
import { findPresetById } from '@/components/ai-quant/strategy-presets'
import { useAuth } from '@/hooks/use-auth'
import { deleteAiQuantConversation, fetchUserExchangeAccountStatuses, listAiQuantConversations } from '@/lib/api'
import { ApiError } from '@/lib/errors'
import { runAiQuantBacktest } from './ai-quant-page-backtest'
import {
  getSemanticGraphValidationMessage,
  reconcilePersistedActiveCodegenSession,
  requestAiQuantCodegen,
} from './ai-quant-page-codegen'
import {
  BACKTEST_EXECUTION_PARAM_KEY_SET,
  CONVERSATIONS_STORAGE_KEY,
  buildApiConfigHref,
  buildBacktestSummaryResult,
  buildParamSchemaWithCapabilities,
  createConversation,
  createConversationFromServerConversation,
  createRecoveryConversation,
  hasExplicitBacktestExecutionOverrides,
  hasLatestPublishedCode,
  isDeployableBacktestResult,
  invalidateConversationPublication,
  mapExchangeStatusesToDeployAccounts,
  normalizeParamsFromValues,
  resolveEffectivePublishedBacktestInputs,
  readPersistedConversations,
  resolvePublishedBacktestMarketType,
  serializePersistedConversations,
  shouldInvalidatePublicationForParamChange,
} from './ai-quant-page-conversation'
import {
  confirmAiQuantDeploy,
  createDeployRequestId,
} from './ai-quant-page-deploy'

export { buildCodegenReplyContent, resolvePublishedStrategyInstanceId } from './ai-quant-page-codegen'
export type { QuantParams } from './ai-quant-page-conversation'

const CAPABILITY_FAILED_MESSAGE_KEY = 'aiQuant.messages.backtestCapabilityLoadFailed'
const CAPABILITY_AUTO_CORRECTED_MESSAGE_KEY = 'aiQuant.messages.backtestCapabilityAutoCorrected'
const CAPABILITY_AUTO_RETRY_DELAY_MS = 15_000
const CAPABILITY_FAILED_MESSAGE_DEFAULT = '回测能力加载失败，请稍后重试。'

const INTENT_TTL_MS = 30 * 60 * 1000

type CapabilityState = 'loading' | 'ready' | 'failed'
type ConversationSyncState = 'idle' | 'loading' | 'ready' | 'error'

interface AiQuantPageClientProps {
  deployVersion?: string
  serverOwnedConversations?: boolean
}

function hasRenderableDisplayLogicGraph(
  graph: ConversationState['displayLogicGraph'] | null | undefined,
): graph is NonNullable<ConversationState['displayLogicGraph']> {
  if (!graph || typeof graph !== 'object') return false
  const candidate = graph as { blocks?: unknown }
  if (!Array.isArray(candidate.blocks)) return false
  return candidate.blocks.every((block) => {
    if (!block || typeof block !== 'object') return false
    return Array.isArray((block as { items?: unknown }).items)
  })
}

export function AiQuantPageClient({
  deployVersion = 'local-dev',
  serverOwnedConversations = false,
}: AiQuantPageClientProps = {}) {
  const { t } = useTranslation()
  const capabilityFailedMessage = t(CAPABILITY_FAILED_MESSAGE_KEY, {
    defaultValue: CAPABILITY_FAILED_MESSAGE_DEFAULT,
  })
  const params = useParams<{ lng: string }>()
  const lng = params?.lng === 'en' ? 'en' : 'zh'
  const router = useRouter()
  const { session, isLoading } = useAuth()
  const apiConfigHref = buildApiConfigHref(lng)

  // Initialize state lazily to avoid hydration mismatch if possible,
  // but here we need to read from localStorage which is a side effect.
  // We'll start with a default and update in useEffect.
  const [conversations, setConversations] = useState<ConversationState[]>(() => [
    createConversation(t),
  ])
  const [activeConversationId, setActiveConversationId] = useState<string>('')
  const [deployOpen, setDeployOpen] = useState(false)
  const [deployRequestId, setDeployRequestId] = useState<string | null>(null)
  const [deploySubmitting, setDeploySubmitting] = useState(false)
  const [selectedDeployExchange, setSelectedDeployExchange] =
    useState<QuantParams['exchange']>('binance')
  const [selectedDeployAccountId, setSelectedDeployAccountId] = useState('')
  const [selectedDeployLeverage, setSelectedDeployLeverage] = useState<number | null>(null)
  const [exchangeAccounts, setExchangeAccounts] = useState<DeployExchangeAccount[]>([])
  const [backtestCapabilityState, setBacktestCapabilityState] = useState<CapabilityState>('loading')
  const [backtestCapabilities, setBacktestCapabilities] = useState<BacktestCapabilities | null>(
    null,
  )
  const [conversationStorageReady, setConversationStorageReady] = useState(false)
  const [conversationSyncState, setConversationSyncState] = useState<ConversationSyncState>('idle')
  const [backtestCapabilityRetryNonce, setBacktestCapabilityRetryNonce] = useState(0)
  const [codegenBusyConversationIds, setCodegenBusyConversationIds] = useState<string[]>([])
  const isMountedRef = useRef(true)
  const activeConversationIdRef = useRef('')
  const previousActiveConversationIdRef = useRef<string>('')
  const backtestRunTokenRef = useRef(new Map<string, number>())
  const backtestRunMutexRef = useRef(new Set<string>())
  const backtestSummarySyncRef = useRef(new Set<string>())
  const codegenRequestMutexRef = useRef(new Set<string>())
  const restoredSessionReconciliationRef = useRef(new Set<string>())

  const activeConversation = useMemo(() => {
    if (!activeConversationId) return conversations[0]
    return conversations.find(x => x.id === activeConversationId) || conversations[0]
  }, [activeConversationId, conversations])

  useEffect(() => {
    if (!activeConversationId && conversations.length) {
      setActiveConversationId(conversations[0].id)
    }
  }, [activeConversationId, conversations])

  useEffect(() => {
    if (serverOwnedConversations) {
      let cancelled = false
      setConversationSyncState('loading')
      localStorage.removeItem(CONVERSATIONS_STORAGE_KEY)
      void listAiQuantConversations()
        .then((serverConversations) => {
          if (cancelled) return
          const restored = serverConversations.length > 0
            ? serverConversations.map(conversation => createConversationFromServerConversation(conversation, t))
            : [createConversation(t)]
          setConversations(restored)
          setActiveConversationId(restored[0].id)
          setConversationSyncState('ready')
          setConversationStorageReady(true)
        })
        .catch(() => {
          if (cancelled) return
          const fallback = [createConversation(t)]
          setConversations(fallback)
          setActiveConversationId(fallback[0].id)
          setConversationSyncState('error')
          setConversationStorageReady(true)
        })
      return () => {
        cancelled = true
      }
    }

    const raw = localStorage.getItem(CONVERSATIONS_STORAGE_KEY)
    const result = readPersistedConversations({
      raw,
      translate: t,
      version: deployVersion,
    })

    setConversations(result.conversations)
    setActiveConversationId(result.conversations[0].id)
    setConversationSyncState('ready')

    if (result.shouldPersist) {
      localStorage.setItem(
        CONVERSATIONS_STORAGE_KEY,
        serializePersistedConversations(result.conversations, deployVersion),
      )
    }
    setConversationStorageReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployVersion, serverOwnedConversations])

  useEffect(() => {
    if (serverOwnedConversations) return
    if (!conversationStorageReady || !conversations.length) return
    localStorage.setItem(
      CONVERSATIONS_STORAGE_KEY,
      serializePersistedConversations(conversations, deployVersion),
    )
  }, [conversationStorageReady, conversations, deployVersion, serverOwnedConversations])

  useEffect(() => {
    if (!session?.userId) return

    const controller = new AbortController()
    setBacktestCapabilityState('loading')

    let retryTimer: ReturnType<typeof setTimeout> | null = null
    void fetchBacktestCapabilities({ signal: controller.signal })
      .then(capabilities => {
        if (controller.signal.aborted) return
        const allowedBaseTimeframes = capabilities.allowedBaseTimeframes

        setBacktestCapabilities(capabilities)
        setBacktestCapabilityState('ready')
        setConversations(prev =>
          prev.map(conv => {
            const currentSymbol =
              typeof conv.paramValues.symbol === 'string'
                ? conv.paramValues.symbol
                : conv.params.symbol
            const currentBaseTimeframe =
              typeof conv.paramValues.baseTimeframe === 'string'
                ? conv.paramValues.baseTimeframe
                : conv.params.baseTimeframe
            const nextBaseTimeframe = allowedBaseTimeframes.includes(currentBaseTimeframe)
              ? currentBaseTimeframe
              : allowedBaseTimeframes[0]
            const corrected = nextBaseTimeframe !== currentBaseTimeframe
            const nextValues = {
              ...conv.paramValues,
              symbol: currentSymbol,
              baseTimeframe: nextBaseTimeframe,
            }
            const nextMessages = corrected
              ? [
                  ...conv.messages,
                  {
                    id: `capability-correct-${Date.now()}-${conv.id}`,
                    role: 'assistant' as const,
                    content: CAPABILITY_AUTO_CORRECTED_MESSAGE_KEY,
                  },
                ]
              : conv.messages
            return {
              ...conv,
              paramSchema:
                applyCapabilitiesToParamSchema(conv.paramSchema, capabilities) ??
                buildParamSchemaWithCapabilities(capabilities, currentSymbol),
              paramValues: nextValues,
              params: normalizeParamsFromValues(nextValues, conv.params),
              messages: nextMessages,
              updatedAt: Date.now(),
            }
          }),
        )
      })
      .catch(error => {
        if (controller.signal.aborted) return
        setBacktestCapabilities(null)
        setBacktestCapabilityState('failed')
        setConversations(prev =>
          prev.map(conv => {
            const alreadyAppended = conv.messages.some(
              msg => msg.content === CAPABILITY_FAILED_MESSAGE_KEY || msg.content === capabilityFailedMessage,
            )
            if (alreadyAppended) return conv
            return {
              ...conv,
              paramSchema:
                applyCapabilitiesToParamSchema(conv.paramSchema, null) ??
                buildParamSchemaWithCapabilities(
                  null,
                  typeof conv.paramValues.symbol === 'string'
                    ? conv.paramValues.symbol
                    : conv.params.symbol,
                ),
              messages: [
                ...conv.messages,
                {
                  id: `capability-failed-${Date.now()}-${conv.id}`,
                  role: 'assistant',
                  content: capabilityFailedMessage,
                },
              ],
              updatedAt: Date.now(),
            }
          }),
        )

        if (
          error instanceof ApiError &&
          (error.statusCode === 502 ||
            error.statusCode === 503 ||
            error.statusCode === 504 ||
            error.code === 'API_TIMEOUT')
        ) {
          retryTimer = globalThis.setTimeout(() => {
            if (!controller.signal.aborted) {
              setBacktestCapabilityRetryNonce(prev => prev + 1)
            }
          }, CAPABILITY_AUTO_RETRY_DELAY_MS)
        }
      })

    return () => {
      controller.abort()
      if (retryTimer) {
        globalThis.clearTimeout(retryTimer)
      }
    }
  }, [session?.userId, backtestCapabilityRetryNonce, capabilityFailedMessage])

  useEffect(() => {
    if (!session?.userId || !activeConversation?.llmCodegenSessionId) {
      return
    }

    const reconciliationKey = `${activeConversation.id}:${activeConversation.llmCodegenSessionId}`
    if (restoredSessionReconciliationRef.current.has(reconciliationKey)) {
      return
    }
    restoredSessionReconciliationRef.current.add(reconciliationKey)

    void reconcilePersistedActiveCodegenSession({
      conversation: activeConversation,
      backtestCapabilities,
      setConversations,
      t,
    }).then((result) => {
      if (result !== 'restarted') {
        return
      }
      setConversations(prev =>
        prev.map(conv => {
          if (conv.id !== activeConversation.id) {
            return conv
          }
          const recovered = createRecoveryConversation(t)
          return {
            ...recovered,
            id: conv.id,
            updatedAt: Date.now(),
          }
        }),
      )
    })
  }, [
    activeConversation,
    backtestCapabilities,
    setConversations,
    session?.userId,
    t,
  ])

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
    const previousId = previousActiveConversationIdRef.current
    if (
      previousId &&
      previousId !== activeConversationId &&
      backtestRunMutexRef.current.has(previousId)
    ) {
      backtestRunTokenRef.current.set(
        previousId,
        (backtestRunTokenRef.current.get(previousId) ?? 0) + 1,
      )
      backtestRunMutexRef.current.delete(previousId)
      setConversations(prev =>
        prev.map(conv =>
          conv.id === previousId
            ? { ...conv, backtestExecutionState: 'idle', updatedAt: Date.now() }
            : conv,
        ),
      )
    }
    previousActiveConversationIdRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      backtestRunTokenRef.current.clear()
      backtestRunMutexRef.current.clear()
      backtestSummarySyncRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const cachedBacktest = activeConversation?.backtestResult
    if (!activeConversation || !cachedBacktest?.id) {
      return
    }

    const syncKey = `${activeConversation.id}:${cachedBacktest.id}`
    if (backtestSummarySyncRef.current.has(syncKey)) {
      return
    }
    backtestSummarySyncRef.current.add(syncKey)

    void (async () => {
      try {
        const report = await getBacktestJobResult(cachedBacktest.id)
        const summary = report?.summary
        if (!summary || !isMountedRef.current) {
          return
        }

        updateConversationById(activeConversation.id, curr => {
          if (curr.backtestResult?.id !== cachedBacktest.id) {
            return curr
          }
          return {
            ...curr,
            backtestResult: buildBacktestSummaryResult(curr.backtestResult, summary),
            updatedAt: Date.now(),
          }
        })
      } catch {
        backtestSummarySyncRef.current.delete(syncKey)
      }
    })()
  }, [activeConversation])

  const apiConfigured = useMemo(
    () =>
      exchangeAccounts.some(
        item => item.exchange === selectedDeployExchange && item.status === 'available',
      ),
    [exchangeAccounts, selectedDeployExchange],
  )
  const deployAccounts = useMemo(() => exchangeAccounts, [exchangeAccounts])
  const deployLeverageOptions = useMemo(() => {
    const range = activeConversation?.publishedSnapshotDeploymentExecutionConstraints?.effectiveAllowedLeverageRange
    if (!range) return []
    return Array.from({ length: range.max - range.min + 1 }).map((_, index) => range.min + index)
  }, [activeConversation?.publishedSnapshotDeploymentExecutionConstraints?.effectiveAllowedLeverageRange])

  const canDeploy = useMemo(() => {
    return isDeployableBacktestResult(activeConversation?.backtestResult)
  }, [activeConversation?.backtestResult])
  const activePublishedDeployTruth = useMemo(() => resolveEffectivePublishedBacktestInputs({
    publishedSnapshotId: activeConversation?.publishedSnapshotId ?? null,
    publishedSnapshotStrategyConfig: activeConversation?.publishedSnapshotStrategyConfig ?? null,
  }), [
    activeConversation?.publishedSnapshotId,
    activeConversation?.publishedSnapshotStrategyConfig,
  ])
  const activeBacktestMarketType = useMemo(() => {
    const resultMarketType = activeConversation?.backtestResult?.marketType
    if (resultMarketType === 'spot' || resultMarketType === 'perp') {
      return resultMarketType
    }

    const publishedMarketType = resolvePublishedBacktestMarketType({
      publishedSnapshotId: activeConversation?.publishedSnapshotId ?? null,
      publishedSnapshotStrategyConfig: activeConversation?.publishedSnapshotStrategyConfig ?? null,
    })
    if (publishedMarketType) {
      return publishedMarketType
    }

    const paramMarketType = activeConversation?.paramValues.marketType
    return paramMarketType === 'spot' || paramMarketType === 'perp' ? paramMarketType : null
  }, [
    activeConversation?.backtestResult?.marketType,
    activeConversation?.paramValues.marketType,
    activeConversation?.publishedSnapshotId,
    activeConversation?.publishedSnapshotStrategyConfig,
  ])
  const graphConfirmed = activeConversation?.logicGraph?.status === 'confirmed'
  const clarificationBlocked = activeConversation?.clarificationGate?.blocked === true
  const semanticViewConfirmable = canConfirmSemanticView({
    logicGraph: activeConversation?.logicGraph,
    pendingCanonicalDigest: activeConversation?.pendingCanonicalDigest,
  }) && !clarificationBlocked
  const codegenBusy = activeConversation
    ? codegenBusyConversationIds.includes(activeConversation.id)
    : false
  const canRunBacktest = useMemo(() => {
    if (!activeConversation) return false
    if (backtestCapabilityState !== 'ready') return false
    if (!graphConfirmed) return false
    if (codegenBusy) return false
    if (!hasLatestPublishedCode(activeConversation)) return false
    return (
      activeConversation.backtestExecutionState !== 'submitting' &&
      activeConversation.backtestExecutionState !== 'running'
    )
  }, [activeConversation, backtestCapabilityState, codegenBusy, graphConfirmed])

  const compactMode = useMemo(() => {
    if (!activeConversation) return true
    return !activeConversation.messages.some(x => x.role === 'user')
  }, [activeConversation])
  const currentPendingClarification = useMemo(() => {
    const gate = activeConversation?.clarificationGate
    if (!gate) return null
    const prioritizedItems = gate.pendingItems?.length ? gate.pendingItems : gate.items
    return prioritizedItems.find(item => item.status === 'pending') ?? null
  }, [activeConversation?.clarificationGate])
  const displayLogicGraph = hasRenderableDisplayLogicGraph(activeConversation?.displayLogicGraph)
    ? activeConversation.displayLogicGraph
    : null

  const callingMessage = (elapsedSec: number) =>
    t('aiQuant.messages.calling', {
      seconds: elapsedSec,
      defaultValue: `Calling... (${elapsedSec}s)`,
    })

  function updateActiveConversation(updater: (curr: ConversationState) => ConversationState) {
    if (!activeConversation) return
    setConversations(prev =>
      prev.map(conv => (conv.id === activeConversation.id ? updater(conv) : conv)),
    )
  }
  function updateConversationById(
    conversationId: string,
    updater: (curr: ConversationState) => ConversationState,
  ) {
    setConversations(prev => prev.map(conv => (conv.id === conversationId ? updater(conv) : conv)))
  }
  function setConversationBacktestExecutionState(
    conversationId: string,
    state: ConversationState['backtestExecutionState'],
  ) {
    updateConversationById(conversationId, curr => ({
      ...curr,
      backtestExecutionState: state,
      updatedAt: Date.now(),
    }))
  }

  function appendSemanticGraphGuardMessage(conversationId: string) {
    updateConversationById(conversationId, curr => ({
      ...curr,
      messages: [
        ...curr.messages,
        {
          id: `semantic-graph-guard-${Date.now()}`,
          role: 'assistant',
          content: getSemanticGraphValidationMessage(
            curr.validationReport,
            t('aiQuant.messages.semanticGraphInvalid', {
              defaultValue: 'The current strategy graph is not yet executable.',
            }),
          ),
        },
      ],
      updatedAt: Date.now(),
    }))
  }

  const confirmCurrentLogicGraph = (args: {
    conversationId: string
    params: QuantParams
    sessionId: string | null
    message: string
  }) => {
    if (!semanticViewConfirmable) {
      appendSemanticGraphGuardMessage(args.conversationId)
      return false
    }

    updateActiveConversation(curr => ({
      ...curr,
      logicGraph: curr.logicGraph ? { ...curr.logicGraph, status: 'confirmed' } : null,
      messages: [
        ...curr.messages,
        {
          id: `graph-confirm-${Date.now()}`,
          role: 'assistant',
          content: t('aiQuant.messages.graphConfirmed'),
        },
      ],
      updatedAt: Date.now(),
    }))
    void requestBackendGraphGeneration({
      conversationId: args.conversationId,
      message: args.message,
      params: args.params,
      sessionId: args.sessionId,
      usePresetRules: false,
      confirmGenerate: true,
      confirmedCanonicalDigest: activeConversation.pendingCanonicalDigest ?? undefined,
    })
    return true
  }

  const requestBackendGraphGeneration = async (args: {
    conversationId: string
    message: string
    params: QuantParams
    sessionId: string | null
    usePresetRules?: boolean
    confirmGenerate?: boolean
    confirmedCanonicalDigest?: string
    clarificationAnswers?: Record<string, string>
  }) => {
    await requestAiQuantCodegen({
      ...args,
      backtestCapabilities,
      callingMessage,
      codegenRequestMutexRef,
      conversations,
      sessionUserId: session?.userId,
      setCodegenBusyConversationIds,
      setConversations,
      t,
    })
  }

  const onSend = async (input: string) => {
    if (!input.trim()) return
    const trimmedInput = input.trim()
    const isRevisionMessage = isStrategyModificationIntent(trimmedInput)
    const currentConversationId = activeConversation.id
    const currentParams = activeConversation.params
    const currentSessionId = activeConversation.llmCodegenSessionId
    const currentGraphStatus = activeConversation.logicGraph?.status
    const lastAssistantMessage = [...activeConversation.messages]
      .reverse()
      .find(msg => msg.role === 'assistant')?.content
    const autoAdvance = shouldAutoAdvanceOnConfirmation({
      userMessage: trimmedInput,
      lastAssistantMessage,
      hasLogicGraph: Boolean(activeConversation.logicGraph),
    })

    updateActiveConversation(curr => {
      const nextMessages: QuantMessage[] = [
        ...curr.messages,
        { id: `u-${Date.now()}`, role: 'user', content: trimmedInput },
      ]

      const derivedTitle =
        curr.title === t('aiQuant.newChat')
          ? trimmedInput.slice(0, 16) || t('aiQuant.newChat')
          : curr.title
      const nextConversation = {
        ...curr,
        title: derivedTitle,
        messages: nextMessages,
        backtestResult: null,
        latestSignalMessage: null,
        updatedAt: Date.now(),
      }

      return isRevisionMessage
        ? invalidateConversationPublication(nextConversation, { markGraphDraft: true })
        : nextConversation
    })

    if (activeConversation.clarificationGate?.blocked && currentPendingClarification) {
      await requestBackendGraphGeneration({
        conversationId: currentConversationId,
        message: trimmedInput,
        params: currentParams,
        sessionId: currentSessionId,
        usePresetRules: false,
        confirmGenerate: false,
        clarificationAnswers: {
          [currentPendingClarification.key]: trimmedInput,
        },
      })
      return
    }

    const confirmPattern =
      /^(?:确认逻辑图|\/confirm|确认|可以|好的?|行|ok|okay|yes|同意|没问题)[。.!！?？\s]*$/i
    if (currentGraphStatus === 'draft' && confirmPattern.test(trimmedInput)) {
      if (!confirmCurrentLogicGraph({
        conversationId: currentConversationId,
        params: currentParams,
        sessionId: currentSessionId,
        message: trimmedInput,
      })) {
        return
      }
      return
    }

    if (autoAdvance) {
      if (!semanticViewConfirmable) {
        appendSemanticGraphGuardMessage(currentConversationId)
        return
      }
      await requestBackendGraphGeneration({
        conversationId: currentConversationId,
        message: buildAutoAdvanceMessage(lastAssistantMessage),
        params: currentParams,
        sessionId: currentSessionId,
        usePresetRules: false,
        confirmGenerate: true,
        confirmedCanonicalDigest: activeConversation.pendingCanonicalDigest ?? undefined,
      })
      return
    }

    await requestBackendGraphGeneration({
      conversationId: currentConversationId,
      message: trimmedInput,
      params: currentParams,
      sessionId: currentSessionId,
      usePresetRules: false,
      confirmGenerate: false,
    })
  }

  const onClarificationAnswer = async (itemKey: string, value: string) => {
    if (!activeConversation) return
    await requestBackendGraphGeneration({
      conversationId: activeConversation.id,
      message: value,
      params: activeConversation.params,
      sessionId: activeConversation.llmCodegenSessionId,
      usePresetRules: false,
      confirmGenerate: false,
      clarificationAnswers: {
        [itemKey]: value,
      },
    })
  }

  const onEditStrategy = (
    _strategyId: string,
    preset: Partial<QuantParams>,
    presetName: string,
    fromLoginIntent = false,
  ) => {
    if (!activeConversation) return
    const nextParams = { ...activeConversation.params, ...preset }
    const currentConversationId = activeConversation.id
    const currentSessionId = activeConversation.llmCodegenSessionId
    const prompt = `${presetName}：${nextParams.buyWindowMin}m drop ${nextParams.buyDropPct}% buy`

    updateActiveConversation(curr => ({
      ...invalidateConversationPublication({
        ...curr,
        params: nextParams,
        paramValues: { ...curr.paramValues, ...nextParams },
        messages: [
          ...curr.messages,
          {
            id: `pick-${Date.now()}`,
            role: 'assistant',
            content: fromLoginIntent
              ? t('aiQuant.messages.restorePreset', { name: presetName })
              : t('aiQuant.messages.applyPreset', { name: presetName }),
          },
        ],
        updatedAt: Date.now(),
      }, { markGraphDraft: true }),
    }))

    void requestBackendGraphGeneration({
      conversationId: currentConversationId,
      message: prompt,
      params: nextParams,
      sessionId: currentSessionId,
      usePresetRules: true,
    })
  }

  const onRunStrategy = (
    _strategyId: string,
    preset: Partial<QuantParams>,
    presetName: string,
    fromLoginIntent = false,
  ) => {
    if (!activeConversation) return
    const nextParams = { ...activeConversation.params, ...preset }
    const currentConversationId = activeConversation.id
    const currentSessionId = activeConversation.llmCodegenSessionId
    const prompt = `${presetName}, generate logic graph`

    updateActiveConversation(curr => ({
      ...invalidateConversationPublication({
        ...curr,
        params: nextParams,
        paramValues: { ...curr.paramValues, ...nextParams },
        messages: [
          ...curr.messages,
          {
            id: `run-pick-${Date.now()}`,
            role: 'assistant',
            content: fromLoginIntent
              ? t('aiQuant.messages.restoreRun', { name: presetName })
              : t('aiQuant.messages.applyRun', { name: presetName }),
          },
        ],
        updatedAt: Date.now(),
      }, { markGraphDraft: true }),
    }))

    void requestBackendGraphGeneration({
      conversationId: currentConversationId,
      message: prompt,
      params: nextParams,
      sessionId: currentSessionId,
      usePresetRules: true,
    })
  }

  const onRunBacktest = () => {
    void runAiQuantBacktest({
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
    })
  }

  const goLoginWithIntent = (intent: QuantReturnIntentInput) => {
    setIntent(intent)
    router.push(`/${lng}/auth/login?redirect=${encodeURIComponent(`/${lng}/ai-quant`)}`)
  }

  useEffect(() => {
    if (!session || !activeConversation) return
    const intent = getIntent(INTENT_TTL_MS)
    if (!intent) return

    if (intent.type === 'plaza-run' || intent.type === 'plaza-edit') {
      return
    }

    if (intent.type === 'chat') {
      clearIntent()
      onSend(intent.draft)
      return
    }

    clearIntent()
    const preset = findPresetById(intent.strategyId)
    if (!preset) {
      updateActiveConversation(curr => ({
        ...curr,
        messages: [
          ...curr.messages,
          {
            id: `intent-miss-${Date.now()}`,
            role: 'assistant',
            content: t('aiQuant.messages.intentMiss'),
          },
        ],
      }))
      return
    }

    if (intent.type === 'edit') {
      onEditStrategy(
        preset.id,
        preset.params,
        t(`aiQuant.strategies.${preset.id}.name`, { defaultValue: preset.name }),
        true,
      )
      return
    }

    onRunStrategy(
      preset.id,
      preset.params,
      t(`aiQuant.strategies.${preset.id}.name`, { defaultValue: preset.name }),
      true,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation, session])

  useEffect(() => {
    if (!session?.userId) {
      setExchangeAccounts([])
      return
    }

    let cancelled = false
    const syncAccounts = async () => {
      try {
        const items = await fetchUserExchangeAccountStatuses()
        if (cancelled) return
        setExchangeAccounts(mapExchangeStatusesToDeployAccounts(items))
      } catch {
        if (!cancelled) {
          setExchangeAccounts([])
        }
      }
    }

    const handleFocus = () => {
      void syncAccounts()
    }
    const handleStorage = () => {
      void syncAccounts()
    }

    void syncAccounts()
    window.addEventListener('focus', handleFocus)
    window.addEventListener('storage', handleStorage)
    return () => {
      cancelled = true
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('storage', handleStorage)
    }
  }, [session?.userId])

  useEffect(() => {
    if (activePublishedDeployTruth?.exchange) {
      setSelectedDeployExchange(activePublishedDeployTruth.exchange)
      return
    }
    setSelectedDeployExchange(activeConversation.params.exchange)
  }, [activeConversation.params.exchange, activePublishedDeployTruth?.exchange])

  useEffect(() => {
    if (!deployOpen) return
    const availableAccounts = deployAccounts.filter(
      item => item.exchange === selectedDeployExchange && item.status === 'available',
    )
    const stillValid = availableAccounts.some(item => item.accountId === selectedDeployAccountId)
    if (stillValid) return
    setSelectedDeployAccountId(availableAccounts[0]?.accountId ?? '')
  }, [deployAccounts, deployOpen, selectedDeployAccountId, selectedDeployExchange])

  if (isLoading) {
    return <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-8 md:px-8" />
  }

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 px-4 py-8 md:px-8">
        <GuestAiQuantLanding onRequireLogin={goLoginWithIntent} />
      </main>
    )
  }

  if (serverOwnedConversations && conversationSyncState === 'loading') {
    return (
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 items-center px-4 py-8 md:px-8">
        <div
          data-testid="conversation-sync-loading"
          className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-3 text-sm text-[color:var(--cf-muted)]"
        >
          {t('aiQuant.messages.loadingConversations', {
            defaultValue: 'Syncing your AI Quant conversations…',
          })}
        </div>
      </main>
    )
  }

  if (!activeConversation) return null

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">
            {t('aiQuant.title')}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--cf-muted)]">{t('aiQuant.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${lng}/ai-quant/plaza`}
            className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
          >
            {t('aiQuant.plaza')}
          </Link>
          <Link
            href={`/${lng}/account?tab=ai-quant#exchange-api`}
            className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
          >
            {t('aiQuant.configApi')}
          </Link>
        </div>
      </div>

      {serverOwnedConversations && conversationSyncState === 'error' && (
        <div
          data-testid="conversation-sync-error"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {t('aiQuant.messages.conversationSyncFailed', {
            defaultValue: 'Unable to load saved AI Quant conversations. A fresh chat has been opened.',
          })}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <ConversationSidebar
          items={conversations.map(x => ({ id: x.id, title: x.title, updatedAt: x.updatedAt }))}
          activeId={activeConversation.id}
          onCreate={() => {
            const next = createConversation(t)
            setConversations(prev => [next, ...prev])
            setActiveConversationId(next.id)
          }}
          onSwitch={setActiveConversationId}
          onRename={(id, title) => {
            setConversations(prev =>
              prev.map(conv => (conv.id === id ? { ...conv, title, updatedAt: Date.now() } : conv)),
            )
          }}
          onDelete={id => {
            if (serverOwnedConversations) {
              const targetConversation = conversations.find(conv => conv.id === id)
              const serverConversationId = targetConversation?.serverConversationId ?? id
              void deleteAiQuantConversation(serverConversationId)
                .then(() => {
                  setConversations(prev => {
                    const next = prev.filter(conv => conv.id !== id)
                    if (next.length === 0) {
                      const seed = createConversation(t)
                      setActiveConversationId(seed.id)
                      return [seed]
                    }
                    if (id === activeConversation.id) setActiveConversationId(next[0].id)
                    return next
                  })
                })
                .catch(() => {})
              return
            }
            setConversations(prev => {
              const next = prev.filter(conv => conv.id !== id)
              if (next.length === 0) {
                const seed = createConversation(t)
                setActiveConversationId(seed.id)
                return [seed]
              }
              if (id === activeConversation.id) setActiveConversationId(next[0].id)
              return next
            })
          }}
        />

        <div className="min-w-0 space-y-4">
          <QuantChatPanel
            key={activeConversation.id}
            messages={activeConversation.messages}
            paramSchema={activeConversation.paramSchema}
            paramValues={activeConversation.paramValues}
            backtestMarketType={resolvePublishedBacktestMarketType({
              publishedSnapshotId: activeConversation.publishedSnapshotId,
              publishedSnapshotStrategyConfig: activeConversation.publishedSnapshotStrategyConfig,
            })}
            clarificationGate={activeConversation.clarificationGate}
            publicationGate={activeConversation.publicationGate}
            compactMode={compactMode}
            onClarificationAnswer={onClarificationAnswer}
            onParamChange={(key, value) =>
              updateActiveConversation(curr => {
                const nextValues = { ...curr.paramValues, [key]: value }
                const nextConversation = {
                  ...curr,
                  paramValues: nextValues,
                  params: normalizeParamsFromValues(nextValues, curr.params),
                  backtestExecutionConfigExplicit:
                    BACKTEST_EXECUTION_PARAM_KEY_SET.has(key)
                      ? hasExplicitBacktestExecutionOverrides(nextValues)
                      : curr.backtestExecutionConfigExplicit,
                  updatedAt: Date.now(),
                }
                return shouldInvalidatePublicationForParamChange(key)
                  ? invalidateConversationPublication(nextConversation, { markGraphDraft: true })
                  : nextConversation
              })
            }
            onSend={onSend}
            onRunBacktest={onRunBacktest}
            canRunBacktest={canRunBacktest}
          />

          {activeConversation.semanticGraph && (
            <SemanticGraphCard semanticGraph={activeConversation.semanticGraph} />
          )}
          {activeConversation.validationReport && !activeConversation.validationReport.ok && (
            <SemanticGraphValidationAlert validationReport={activeConversation.validationReport} />
          )}
          {activeConversation.logicGraph && displayLogicGraph ? (
            <DisplayLogicGraphPreview
              graph={displayLogicGraph}
              confirmDisabled={
                codegenBusy ||
                activeConversation.logicGraph.status === 'confirmed' ||
                !semanticViewConfirmable
              }
              confirmed={activeConversation.logicGraph.status === 'confirmed'}
              onConfirm={() => {
                confirmCurrentLogicGraph({
                  conversationId: activeConversation.id,
                  params: activeConversation.params,
                  sessionId: activeConversation.llmCodegenSessionId,
                  message: t('aiQuant.messages.confirmGenerate', {
                    defaultValue: 'Confirm code generation',
                  }),
                })
              }}
              onRevise={() => {
                updateActiveConversation(curr => ({
                  ...invalidateConversationPublication(curr, { markGraphDraft: true }),
                  messages: [
                    ...curr.messages,
                    {
                      id: `graph-revise-${Date.now()}`,
                      role: 'assistant',
                      content: t('aiQuant.messages.graphRevise'),
                    },
                  ],
                  updatedAt: Date.now(),
                }))
              }}
            />
          ) : activeConversation.logicGraph ? (
            <LogicGraphPreview
              graph={activeConversation.logicGraph}
              confirmDisabled={
                codegenBusy ||
                activeConversation.logicGraph.status === 'confirmed' ||
                !semanticViewConfirmable
              }
              onConfirm={() => {
                confirmCurrentLogicGraph({
                  conversationId: activeConversation.id,
                  params: activeConversation.params,
                  sessionId: activeConversation.llmCodegenSessionId,
                  message: t('aiQuant.messages.confirmGenerate', {
                    defaultValue: 'Confirm code generation',
                  }),
                })
              }}
              onRevise={() => {
                updateActiveConversation(curr => ({
                  ...invalidateConversationPublication(curr, { markGraphDraft: true }),
                  messages: [
                    ...curr.messages,
                    {
                      id: `graph-revise-${Date.now()}`,
                      role: 'assistant',
                      content: t('aiQuant.messages.graphRevise'),
                    },
                  ],
                  updatedAt: Date.now(),
                }))
              }}
            />
          ) : null}

          {activeConversation.backtestResult && (
            <BacktestSummaryCard
              result={activeConversation.backtestResult}
              marketType={activeBacktestMarketType}
              canDeploy={canDeploy}
              drawdownLimited
              onOpenFullScreen={() => {
                const currentBacktest = activeConversation.backtestResult
                if (!currentBacktest) {
                  return
                }
                const search = new URLSearchParams()
                search.set('symbol', currentBacktest.symbol ?? activeConversation.params.symbol)
                if (currentBacktest.startAt) {
                  search.set('startAt', currentBacktest.startAt)
                }
                if (currentBacktest.endAt) {
                  search.set('endAt', currentBacktest.endAt)
                }
                router.push(`/${lng}/ai-quant/backtest/${currentBacktest.id}?${search.toString()}`)
              }}
              onOptimize={() => {
                const optimizeMessage: QuantMessage = {
                  id: `opt-${Date.now()}`,
                  role: 'assistant',
                  content: t('aiQuant.messages.optimizeHint'),
                }
                updateActiveConversation(curr => ({
                  ...invalidateConversationPublication(curr, { markGraphDraft: true }),
                  messages: [...curr.messages, optimizeMessage],
                  updatedAt: Date.now(),
                }))
              }}
              onDeploy={() => {
                setDeployRequestId(createDeployRequestId())
                const baselineLeverage = activeConversation.publishedSnapshotDeploymentExecutionDefaults?.leverage
                setSelectedDeployLeverage(
                  activePublishedDeployTruth?.marketType === 'perp'
                    && typeof baselineLeverage === 'number'
                    && Number.isFinite(baselineLeverage)
                    ? baselineLeverage
                    : null,
                )
                setDeployOpen(true)
              }}
            />
          )}
        </div>
      </div>

      <DeployDialog
        open={deployOpen}
        onClose={() => {
          if (deploySubmitting) {
            return
          }
          setDeployOpen(false)
          setDeployRequestId(null)
          setSelectedDeployLeverage(null)
        }}
        canDeploy={canDeploy}
        deploySubmitting={deploySubmitting}
        apiConfigured={apiConfigured}
        exchange={activePublishedDeployTruth?.exchange ?? selectedDeployExchange}
        marketType={activePublishedDeployTruth?.marketType ?? null}
        accounts={deployAccounts}
        selectedAccountId={selectedDeployAccountId}
        leverageOptions={activePublishedDeployTruth?.marketType === 'perp' ? deployLeverageOptions : []}
        selectedLeverage={selectedDeployLeverage ?? undefined}
        onSelectLeverage={setSelectedDeployLeverage}
        leverageExplanation={activeConversation.publishedSnapshotDeploymentExecutionConstraints?.constraintExplanation ?? null}
        deploymentBaseline={activeConversation.publishedSnapshotDeploymentExecutionDefaults ?? null}
        driftReasons={[]}
        onSelectAccount={setSelectedDeployAccountId}
        onConfirmDeploy={async () => {
          if (deploySubmitting) {
            return
          }
          if (!activeConversation.backtestResult || !session?.userId) return
          await confirmAiQuantDeploy({
            activeConversation,
            apiConfigHref,
            deployRequestId,
            selectedDeployAccountId,
            selectedDeployExchange: activePublishedDeployTruth?.exchange ?? selectedDeployExchange,
            selectedDeployMarketType: activePublishedDeployTruth?.marketType ?? null,
            selectedDeployLeverage,
            sessionUserId: session.userId,
            setDeployOpen,
            setDeployRequestId,
            setDeploySubmitting,
            setExchangeAccounts,
            setSelectedDeployAccountId,
            t,
            updateActiveConversation,
            push: router.push,
          })
        }}
        lng={lng}
      />
    </main>
  )
}
