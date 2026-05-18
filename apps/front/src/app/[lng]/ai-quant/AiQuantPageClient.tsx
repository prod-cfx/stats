'use client'

import type { ConversationState, QuantParams } from './ai-quant-page-conversation'
import type {AiQuantDeletionDialogKind} from '@/components/ai-quant/AiQuantDeletionDialog';
import type { BacktestCapabilities } from '@/components/ai-quant/backtest-capability-client'
import type { DeployExchangeAccount } from '@/components/ai-quant/DeployDialog'
import type { QuantReturnIntentInput } from '@/components/ai-quant/intent-storage'
import type { QuantMessage } from '@/components/ai-quant/QuantChatPanel'
import type { AccountAiQuantStrategyDetail } from '@/lib/api'
import { Bot, ChevronLeft, KeyRound, MessageSquarePlus, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AiQuantDeletionDialog  } from '@/components/ai-quant/AiQuantDeletionDialog'
import { fetchBacktestCapabilities } from '@/components/ai-quant/backtest-capability-client'
import { getBacktestJobResult } from '@/components/ai-quant/backtest-job-client'
import { BacktestSummaryCard } from '@/components/ai-quant/BacktestSummaryCard'
import {
  canConfirmSemanticView,
  readCanonicalDigest,
} from '@/components/ai-quant/canonical-confirmation'
import { ConversationSidebar } from '@/components/ai-quant/ConversationSidebar'
import { DeployDialog } from '@/components/ai-quant/DeployDialog'
import { DisplayLogicGraphPreview } from '@/components/ai-quant/DisplayLogicGraphPreview'
import { GuestAiQuantLanding } from '@/components/ai-quant/GuestAiQuantLanding'
import { clearIntent, getIntent, setIntent } from '@/components/ai-quant/intent-storage'
import { LogicGraphPreview } from '@/components/ai-quant/LogicGraphPreview'
import { QuantChatPanel } from '@/components/ai-quant/QuantChatPanel'
import { RunningStrategyEditGuardDialog } from '@/components/ai-quant/RunningStrategyEditGuardDialog'
import { SemanticGraphValidationAlert } from '@/components/ai-quant/SemanticGraphValidationAlert'
import {
  buildAutoAdvanceMessage,
  isStrategyModificationIntent,
  shouldAutoAdvanceOnConfirmation,
} from '@/components/ai-quant/session-loop'
import { StopRunningStrategyDialog } from '@/components/ai-quant/StopRunningStrategyDialog'
import { applyCapabilitiesToParamSchema } from '@/components/ai-quant/strategy-param-sync'
import { findPresetById } from '@/components/ai-quant/strategy-presets'
import { getSameOriginReturnHref } from '@/components/navigation/return-href'
import { useAuth } from '@/hooks/use-auth'
import {
  deleteAiQuantConversation,
  fetchAccountAiQuantStrategyDetail,
  fetchUserExchangeAccountStatuses,
  listAiQuantConversations,
  performAccountAiQuantStrategyAction,
  recoverAiQuantEditConversation,
  updateAiQuantConversationBacktestDraft,
} from '@/lib/api'
import { ApiError } from '@/lib/errors'
import { toast } from '@/lib/toast'
import { runAiQuantBacktest } from './ai-quant-page-backtest'
import {
  getSemanticGraphValidationMessage,
  reconcilePersistedActiveCodegenSession,
  requestAiQuantCodegen,
} from './ai-quant-page-codegen'
import {
  BACKTEST_EXECUTION_PARAM_KEY_SET,
  BACKTEST_RANGE_PARAM_KEY_SET,
  applyBacktestDraftConfigToValues,
  CONVERSATIONS_STORAGE_KEY,
  buildApiConfigHref,
  buildBacktestDraftConfigFromValues,
  buildBacktestSummaryResult,
  buildParamSchemaWithCapabilities,
  buildStrategyRevisionPromptMessage,
  createConversation,
  createConversationFromServerConversation,
  createRecoveryConversation,
  findConversationForEditIntent,
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
const ACCOUNT_STRATEGY_NOT_FOUND_CODE = 'ACCOUNT_STRATEGY_NOT_FOUND'

function readPositiveFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function resolvePreferredDeployLeverage(conversation: ConversationState | null | undefined): number | null {
  return readPositiveFiniteNumber(conversation?.backtestDraftConfig?.execution.leverage)
    ?? readPositiveFiniteNumber(conversation?.paramValues.backtestLeverage)
    ?? readPositiveFiniteNumber(conversation?.publishedSnapshotDeploymentExecutionDefaults?.leverage)
}

function resolveLocalizedRuntimeErrorMessage(
  error: unknown,
  fallback: string,
  lng: 'zh' | 'en',
): string {
  const message = error instanceof Error && error.message.trim() ? error.message.trim() : ''
  if (!message) return fallback
  if (lng === 'en' && /[\u4E00-\u9FFF]/.test(message)) return fallback
  return message
}

type CapabilityState = 'loading' | 'ready' | 'failed'
type ConversationSyncState = 'idle' | 'loading' | 'ready' | 'error'
type DeploymentDetailStatus = 'idle' | 'loading' | 'ready' | 'not_found' | 'error'
type StrategyEditIntent = Extract<ReturnType<typeof getIntent>, { type: 'strategy-edit-session' }>

type ConversationDeleteDialogState = {
  conversation: ConversationState
  serverConversationId: string
  strategyInstanceId: string
  strategy: AccountAiQuantStrategyDetail | null
  status: 'loading' | 'running' | 'stopped' | 'draft' | 'unknown' | 'conversation-only'
  deleteStoppedStrategy: boolean
  pending: boolean
  errorMessage: string | null
} | null

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

function isSameStrategyEditIntent(
  current: ReturnType<typeof getIntent>,
  expected: StrategyEditIntent,
): boolean {
  return current?.type === 'strategy-edit-session'
    && current.strategyInstanceId === expected.strategyInstanceId
    && current.publishedSnapshotId === expected.publishedSnapshotId
    && current.conversationId === expected.conversationId
    && current.sessionId === expected.sessionId
    && current.source === expected.source
    && current.ts === expected.ts
}

function isAccountStrategyNotFoundError(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.code === ACCOUNT_STRATEGY_NOT_FOUND_CODE) return true
    const details = error.details as { error?: { code?: unknown }; code?: unknown } | null | undefined
    return details?.error?.code === ACCOUNT_STRATEGY_NOT_FOUND_CODE
      || details?.code === ACCOUNT_STRATEGY_NOT_FOUND_CODE
  }

  if (!error || typeof error !== 'object') return false
  const candidate = error as {
    code?: unknown
    statusCode?: unknown
    details?: { error?: { code?: unknown }; code?: unknown }
  }
  return candidate.code === ACCOUNT_STRATEGY_NOT_FOUND_CODE
    || candidate.details?.error?.code === ACCOUNT_STRATEGY_NOT_FOUND_CODE
    || candidate.details?.code === ACCOUNT_STRATEGY_NOT_FOUND_CODE
}

function isDeploymentDetailForPublishedSnapshot(
  detail: AccountAiQuantStrategyDetail | null,
  publishedSnapshotId: string | null | undefined,
): boolean {
  const currentPublishedSnapshotId = typeof publishedSnapshotId === 'string'
    ? publishedSnapshotId.trim()
    : ''
  if (!currentPublishedSnapshotId) return true

  const deployedPublishedSnapshotId = typeof detail?.snapshot?.publishedSnapshotId === 'string'
    ? detail.snapshot.publishedSnapshotId.trim()
    : ''
  return deployedPublishedSnapshotId === currentPublishedSnapshotId
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
  const defaultReturnHref = `/${lng}/account?tab=ai-quant`
  const [returnHref, setReturnHref] = useState(defaultReturnHref)

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
  const [deploymentDetail, setDeploymentDetail] = useState<AccountAiQuantStrategyDetail | null>(null)
  const [deploymentDetailStatus, setDeploymentDetailStatus] =
    useState<DeploymentDetailStatus>('idle')
  const [deploymentActionPending, setDeploymentActionPending] = useState(false)
  const [editGuardOpen, setEditGuardOpen] = useState(false)
  const [stopDialogOpen, setStopDialogOpen] = useState(false)
  const [deploymentGuardErrorMessage, setDeploymentGuardErrorMessage] = useState<string | null>(
    null,
  )
  const [conversationDeleteDialog, setConversationDeleteDialog] =
    useState<ConversationDeleteDialogState>(null)
  const [backtestCapabilityRetryNonce, setBacktestCapabilityRetryNonce] = useState(0)
  const [codegenBusyConversationIds, setCodegenBusyConversationIds] = useState<string[]>([])
  const [rightPanelTab, setRightPanelTab] = useState<'logic' | 'backtest'>('logic')
  const [mobileConversationSheetOpen, setMobileConversationSheetOpen] = useState(false)
  const [mobilePanelSheetOpen, setMobilePanelSheetOpen] = useState(false)
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
    setReturnHref(getSameOriginReturnHref(defaultReturnHref))
  }, [defaultReturnHref])

  useEffect(() => {
    if (!activeConversationId && conversations.length) {
      setActiveConversationId(conversations[0].id)
    }
  }, [activeConversationId, conversations])

  useEffect(() => {
    const publishedStrategyInstanceId = activeConversation?.publishedStrategyInstanceId?.trim()
    if (!session?.userId || !publishedStrategyInstanceId) {
      setDeploymentDetail(null)
      setDeploymentDetailStatus('idle')
      setDeploymentActionPending(false)
      setEditGuardOpen(false)
      setStopDialogOpen(false)
      setDeploymentGuardErrorMessage(null)
      return
    }

    let cancelled = false
    setDeploymentDetail(null)
    setDeploymentDetailStatus('loading')
    setDeploymentGuardErrorMessage(null)

    void fetchAccountAiQuantStrategyDetail(publishedStrategyInstanceId, session.userId)
      .then((detail) => {
        if (cancelled) return
        setDeploymentDetail(detail)
        setDeploymentDetailStatus('ready')
      })
      .catch((error) => {
        if (cancelled) return
        setDeploymentDetail(null)
        setDeploymentDetailStatus(isAccountStrategyNotFoundError(error) ? 'not_found' : 'error')
      })

    return () => {
      cancelled = true
    }
  }, [activeConversation?.id, activeConversation?.publishedStrategyInstanceId, session?.userId])

  useEffect(() => {
    if (serverOwnedConversations) {
      let cancelled = false
      setConversationSyncState('loading')
      localStorage.removeItem(CONVERSATIONS_STORAGE_KEY)

      void (async () => {
        try {
          const serverConversations = await listAiQuantConversations()
          if (cancelled) return
          const restored = serverConversations.map(conversation => createConversationFromServerConversation(conversation, t))
          const intent = getIntent(INTENT_TTL_MS)

          if (intent?.type === 'strategy-edit-session') {
            const matched = findConversationForEditIntent(restored, intent)

            if (matched) {
              clearIntent()
              setConversations(restored)
              setActiveConversationId(matched.id)
              setConversationSyncState('ready')
              setConversationStorageReady(true)
              return
            }

            try {
              const recoveredConversation = await recoverAiQuantEditConversation({
                strategyInstanceId: intent.strategyInstanceId,
                publishedSnapshotId: intent.publishedSnapshotId,
                conversationId: intent.conversationId,
                sessionId: intent.sessionId,
                source: intent.source,
                locale: lng,
              })
              if (cancelled) return

              const recovered = createConversationFromServerConversation(recoveredConversation, t)
              if (isSameStrategyEditIntent(getIntent(INTENT_TTL_MS), intent)) {
                clearIntent()
              }
              setConversations([recovered, ...restored])
              setActiveConversationId(recovered.id)
              setConversationSyncState('ready')
              setConversationStorageReady(true)
              return
            } catch {
              if (cancelled) return
              const fallback = restored.length > 0 ? restored : [createConversation(t)]
              setConversations(fallback)
              setActiveConversationId(fallback[0].id)
              setConversationSyncState('ready')
              setConversationStorageReady(true)
              return
            }
          }

          const fallback = restored.length > 0 ? restored : [createConversation(t)]
          setConversations(fallback)
          setActiveConversationId(fallback[0].id)
          setConversationSyncState('ready')
          setConversationStorageReady(true)
        } catch {
          if (cancelled) return
          const fallback = [createConversation(t)]
          setConversations(fallback)
          setActiveConversationId(fallback[0].id)
          setConversationSyncState('error')
          setConversationStorageReady(true)
        }
      })()
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
    const options = range
      ? Array.from({ length: range.max - range.min + 1 }).map((_, index) => range.min + index)
      : []
    const preferredLeverage = resolvePreferredDeployLeverage(activeConversation)
    if (
      preferredLeverage !== null
      && Number.isInteger(preferredLeverage)
      && !options.includes(preferredLeverage)
    ) {
      options.push(preferredLeverage)
      options.sort((a, b) => a - b)
    }
    return options
  }, [
    activeConversation?.backtestDraftConfig?.execution.leverage,
    activeConversation?.paramValues.backtestLeverage,
    activeConversation?.publishedSnapshotDeploymentExecutionConstraints?.effectiveAllowedLeverageRange,
    activeConversation?.publishedSnapshotDeploymentExecutionDefaults?.leverage,
  ])

  const canDeploy = useMemo(() => {
    return isDeployableBacktestResult(activeConversation?.backtestResult)
  }, [activeConversation?.backtestResult])
  const deploymentState = useMemo(() => {
    const publishedStrategyInstanceId = activeConversation?.publishedStrategyInstanceId?.trim()
    if (!publishedStrategyInstanceId) {
      return 'not_deployed' as const
    }
    if (deploymentDetailStatus === 'idle' || deploymentDetailStatus === 'not_found') {
      return 'not_deployed' as const
    }
    if (deploymentDetailStatus !== 'ready') {
      return 'unknown' as const
    }
    if (!isDeploymentDetailForPublishedSnapshot(deploymentDetail, activeConversation?.publishedSnapshotId)) {
      return 'not_deployed' as const
    }
    return deploymentDetail?.status === 'running' ? 'running' as const : 'stopped' as const
  }, [
    activeConversation?.publishedStrategyInstanceId,
    activeConversation?.publishedSnapshotId,
    deploymentDetail?.status,
    deploymentDetail?.snapshot?.publishedSnapshotId,
    deploymentDetailStatus,
  ])
  const deployLabel = useMemo(() => {
    if (deploymentState === 'running') {
      return t('aiQuant.deployRunning', { defaultValue: 'Running' })
    }
    if (deploymentState === 'stopped') {
      return t('aiQuant.deployRedeploy', { defaultValue: 'Redeploy' })
    }
    if (deploymentState === 'unknown') {
      return deploymentDetailStatus === 'loading'
        ? t('aiQuant.deployLoading', { defaultValue: 'Checking deployment status' })
        : t('aiQuant.deployPending', { defaultValue: 'Deployment status pending' })
    }
    return t('aiQuant.deploy')
  }, [deploymentDetailStatus, deploymentState, t])
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
  const activePublishedSnapshotId =
    activeConversation && hasLatestPublishedCode(activeConversation)
      ? activeConversation.publishedSnapshotId
      : null
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

  useEffect(() => {
    setRightPanelTab('logic')
  }, [activeConversationId])

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

  function persistConversationBacktestDraft(
    conversationId: string,
    nextValues: Record<string, unknown>,
  ) {
    const targetConversation = conversations.find(conv => conv.id === conversationId)
    const serverConversationId = targetConversation?.serverConversationId
    const backtestDraftConfig = buildBacktestDraftConfigFromValues(nextValues)

    if (!backtestDraftConfig) {
      return
    }

    if (serverOwnedConversations && serverConversationId) {
      void updateAiQuantConversationBacktestDraft(serverConversationId, backtestDraftConfig).catch(() => {})
    }
  }

  function invalidateActiveConversationBacktestRecovery() {
    if (!activeConversation) {
      return
    }
    const conversationId = activeConversation.id
    backtestRunTokenRef.current.set(
      conversationId,
      (backtestRunTokenRef.current.get(conversationId) ?? 0) + 1,
    )
    backtestRunMutexRef.current.delete(conversationId)
  }

  function requestLogicGraphRevision() {
    if (deploymentState === 'running' || deploymentState === 'unknown') {
      setDeploymentGuardErrorMessage(null)
      setEditGuardOpen(true)
      return
    }

    updateActiveConversation(curr => ({
      ...invalidateConversationPublication(curr, { markGraphDraft: true }),
      messages: [
        ...curr.messages,
        {
          id: `graph-revise-${Date.now()}`,
          role: 'assistant',
          content: buildStrategyRevisionPromptMessage(
            curr,
            t('aiQuant.messages.graphRevise'),
          ),
        },
      ],
      updatedAt: Date.now(),
    }))
  }

  function viewRunningStrategy() {
    const strategyInstanceId = activeConversation?.publishedStrategyInstanceId
    if (!strategyInstanceId) return
    router.push(`/${lng}/account/ai-quant/strategy/${strategyInstanceId}`)
  }

  async function openStopDialogWithLatestDeploymentDetail() {
    const strategyInstanceId = activeConversation?.publishedStrategyInstanceId
    if (!strategyInstanceId || !session?.userId || deploymentActionPending) {
      return
    }

    setDeploymentActionPending(true)
    setDeploymentGuardErrorMessage(null)

    try {
      const latestDetail = await fetchAccountAiQuantStrategyDetail(strategyInstanceId, session.userId)
      if (!isMountedRef.current) return
      setDeploymentDetail(latestDetail)
      setDeploymentDetailStatus('ready')
      setStopDialogOpen(true)
    } catch (error) {
      if (!isMountedRef.current) return
      setDeploymentGuardErrorMessage(
        resolveLocalizedRuntimeErrorMessage(
          error,
          lng === 'en'
            ? 'Unable to confirm the latest strategy status. Please try again later.'
            : '无法确认策略最新状态，请稍后重试。',
          lng,
        ),
      )
    } finally {
      if (isMountedRef.current) {
        setDeploymentActionPending(false)
      }
    }
  }

  async function performPublishedStrategyRuntimeAction(action: 'stop' | 'liquidate_and_stop') {
    const strategyInstanceId = activeConversation?.publishedStrategyInstanceId
    if (!strategyInstanceId || !session?.userId || deploymentActionPending) {
      return
    }

    setDeploymentActionPending(true)
    setDeploymentGuardErrorMessage(null)

    try {
      const nextDetail = await performAccountAiQuantStrategyAction(strategyInstanceId, {
        userId: session.userId,
        action,
      })
      if (!isMountedRef.current) return
      setDeploymentDetail(nextDetail)
      setDeploymentDetailStatus('ready')
      setEditGuardOpen(false)
      setStopDialogOpen(false)
    } catch (error) {
      if (!isMountedRef.current) return
      setDeploymentGuardErrorMessage(
        resolveLocalizedRuntimeErrorMessage(
          error,
          action === 'liquidate_and_stop'
            ? lng === 'en'
              ? 'Liquidate and stop failed. Check the paper trading account status and try again.'
              : '平仓并停止失败，请检查模拟盘账户状态后重试。'
            : lng === 'en'
              ? 'Failed to stop the strategy. Please try again later.'
              : '停止策略失败，请稍后重试。',
          lng,
        ),
      )
    } finally {
      if (isMountedRef.current) {
        setDeploymentActionPending(false)
      }
    }
  }

  function removeDeletedConversation(conversationId: string) {
    setConversations(prev => {
      const next = prev.filter(conv => conv.id !== conversationId)
      if (next.length === 0) {
        const seed = createConversation(t)
        setActiveConversationId(seed.id)
        return [seed]
      }
      if (conversationId === activeConversation.id) {
        setActiveConversationId(next[0].id)
      }
      return next
    })
  }

  async function deleteConversationByMode(args: {
    conversation: ConversationState
    serverConversationId: string
    deleteStoppedStrategy?: boolean
  }) {
    if (serverOwnedConversations) {
      if (args.deleteStoppedStrategy) {
        await deleteAiQuantConversation(args.serverConversationId, { deleteStoppedStrategy: true })
      } else {
        await deleteAiQuantConversation(args.serverConversationId)
      }
    }
    removeDeletedConversation(args.conversation.id)
  }

  async function requestDeleteConversation(conversationId: string) {
    const targetConversation = conversations.find(conv => conv.id === conversationId)
    if (!targetConversation) return
    const serverConversationId = targetConversation.serverConversationId ?? conversationId
    const strategyInstanceId = targetConversation.publishedStrategyInstanceId?.trim() ?? ''

    if (!serverOwnedConversations) {
      setConversationDeleteDialog({
        conversation: targetConversation,
        serverConversationId,
        strategyInstanceId: '',
        strategy: null,
        status: 'conversation-only',
        deleteStoppedStrategy: false,
        pending: false,
        errorMessage: null,
      })
      return
    }

    if (!strategyInstanceId) {
      setConversationDeleteDialog({
        conversation: targetConversation,
        serverConversationId,
        strategyInstanceId: '',
        strategy: null,
        status: 'conversation-only',
        deleteStoppedStrategy: false,
        pending: false,
        errorMessage: null,
      })
      return
    }

    if (!session?.userId) {
      setConversationDeleteDialog({
        conversation: targetConversation,
        serverConversationId,
        strategyInstanceId,
        strategy: null,
        status: 'unknown',
        deleteStoppedStrategy: false,
        pending: false,
        errorMessage: t('aiQuant.deleteDialog.unknownDescription'),
      })
      return
    }

    setConversationDeleteDialog({
      conversation: targetConversation,
      serverConversationId,
      strategyInstanceId,
      strategy: null,
      status: 'loading',
      deleteStoppedStrategy: false,
      pending: false,
      errorMessage: null,
    })

    try {
      const detail = activeConversation.id === targetConversation.id
        && deploymentDetail?.id === strategyInstanceId
        && deploymentDetailStatus === 'ready'
        ? deploymentDetail
        : await fetchAccountAiQuantStrategyDetail(strategyInstanceId, session.userId)
      const status = detail.status === 'running' || detail.status === 'stopped' || detail.status === 'draft'
        ? detail.status
        : 'unknown'
      setConversationDeleteDialog(curr => curr && curr.conversation.id === conversationId
        ? {
            ...curr,
            strategy: detail,
            status,
          }
        : curr)
    } catch (error) {
      if (isAccountStrategyNotFoundError(error)) {
        setConversationDeleteDialog(curr => curr && curr.conversation.id === conversationId
          ? {
              ...curr,
              strategyInstanceId: '',
              strategy: null,
              status: 'conversation-only',
              pending: false,
              errorMessage: null,
            }
          : curr)
        return
      }

      setConversationDeleteDialog(curr => curr && curr.conversation.id === conversationId
        ? {
            ...curr,
            status: 'unknown',
            errorMessage: error instanceof Error && error.message.trim()
              ? error.message
              : t('aiQuant.deleteDialog.unknownDescription'),
          }
        : curr)
    }
  }

  async function confirmDeleteConversation() {
    if (!conversationDeleteDialog || conversationDeleteDialog.pending) return
    if (conversationDeleteDialog.status === 'running' || conversationDeleteDialog.status === 'unknown') return

    setConversationDeleteDialog(curr => curr ? { ...curr, pending: true, errorMessage: null } : curr)
    try {
      await deleteConversationByMode({
        conversation: conversationDeleteDialog.conversation,
        serverConversationId: conversationDeleteDialog.serverConversationId,
        deleteStoppedStrategy: conversationDeleteDialog.deleteStoppedStrategy,
      })
      toast.success({
        title: t(conversationDeleteDialog.deleteStoppedStrategy
          ? 'aiQuant.deleteDialog.conversationAndStrategyDeleted'
          : 'aiQuant.deleteDialog.conversationDeleted'),
      })
      setConversationDeleteDialog(null)
    } catch (error) {
      setConversationDeleteDialog(curr => curr
        ? {
            ...curr,
            pending: false,
            errorMessage: error instanceof Error && error.message.trim()
              ? error.message
              : t('aiQuant.deleteDialog.deleteFailed'),
          }
        : curr)
    }
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

  async function requestBackendGraphGeneration(args: {
    conversationId: string
    message: string
    params: QuantParams
    sessionId: string | null
    usePresetRules?: boolean
    confirmGenerate?: boolean
    confirmedCanonicalDigest?: string
    clarificationAnswers?: Record<string, string>
  }) {
    await requestAiQuantCodegen({
      ...args,
      backtestCapabilities,
      callingMessage,
      codegenRequestMutexRef,
      conversations,
      locale: lng,
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

  const onParamChange = (key: string, value: unknown) => {
    const shouldInvalidateBacktest =
      BACKTEST_RANGE_PARAM_KEY_SET.has(key) || BACKTEST_EXECUTION_PARAM_KEY_SET.has(key)
    if (shouldInvalidateBacktest) {
      invalidateActiveConversationBacktestRecovery()
    }
    updateActiveConversation(curr => {
      const nextValues = { ...curr.paramValues, [key]: value }
      const nextConversation = {
        ...curr,
        paramValues: nextValues,
        params: normalizeParamsFromValues(nextValues, curr.params),
        backtestDraftConfig:
          shouldInvalidateBacktest
            ? buildBacktestDraftConfigFromValues(nextValues)
            : curr.backtestDraftConfig,
        backtestResult: shouldInvalidateBacktest ? null : curr.backtestResult,
        backtestExecutionState: shouldInvalidateBacktest ? 'idle' : curr.backtestExecutionState,
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
      lng,
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

    if (intent.type === 'plaza-chat-session') {
      const targetConversation = conversations.find(conversation =>
        conversation.llmCodegenSessionId === intent.sessionId || conversation.id === intent.sessionId,
      )
      if (!targetConversation) return
      clearIntent()
      setActiveConversationId(targetConversation.id)
      return
    }

    if (intent.type === 'chat') {
      clearIntent()
      onSend(intent.draft)
      return
    }

    if (intent.type === 'strategy-edit-session') {
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
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-4 py-8 md:px-8">
        <Link
          href={returnHref}
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3.5 py-1.5 text-xs font-semibold leading-5 text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{lng === 'en' ? 'Back' : '返回'}</span>
        </Link>
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

  const createNewConversation = () => {
    const next = createConversation(t)
    setConversations(prev => [next, ...prev])
    setActiveConversationId(next.id)
  }
  const openMobilePanelTab = (tab: 'logic' | 'backtest') => {
    setRightPanelTab(tab)
    setMobilePanelSheetOpen(true)
  }

  return (
    <main className="mx-auto flex w-full flex-1 flex-col bg-[color:var(--cf-bg)] md:max-w-[1120px] md:gap-6 md:bg-transparent md:px-8 md:py-8">
      <section className="sticky top-0 z-30 flex h-16 items-center justify-center border-b border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-12 md:hidden">
        <Link
          href={returnHref}
          aria-label={lng === 'en' ? 'Back' : '返回'}
          className="absolute left-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)] text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 text-center leading-none">
          <div className="flex items-center justify-center gap-1.5">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot className="h-3.5 w-3.5" />
            </span>
            <span className="text-[13px] font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.chatTitle')}</span>
          </div>
          <div className="mt-1 truncate text-[11px] font-medium leading-none text-[color:var(--cf-muted)]">
            {activeConversation.title}
          </div>
        </div>
        <button
          type="button"
          data-testid="mobile-create-conversation-header"
          onClick={() => setMobileConversationSheetOpen(true)}
          aria-label={t('aiQuant.conversationSelector', { defaultValue: '选择会话' })}
          className="absolute right-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)] text-primary shadow-sm"
        >
          <MessageSquarePlus className="h-5 w-5" />
        </button>
      </section>

      <section className="hidden items-center justify-between gap-3 md:flex">
        <Link
          href={returnHref}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{lng === 'en' ? 'Back' : '返回'}</span>
        </Link>
        <div className="flex items-center justify-end gap-2 sm:hidden">
          <Link
            href={`/${lng}/ai-quant/plaza`}
            data-testid="ai-quant-header-plaza-link"
            className="cf-ai-action-button cf-ai-action-neutral inline-flex items-center justify-center gap-1.5 rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3.5 py-1.5 text-xs font-semibold leading-5 text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
          >
            <Sparkles className="h-4 w-4" />
            <span>{t('aiQuant.plazaShort')}</span>
          </Link>
          <Link
            href={`/${lng}/account?tab=settings#exchange-api`}
            data-testid="ai-quant-header-api-link"
            className="cf-ai-action-button cf-ai-action-neutral inline-flex items-center justify-center gap-1.5 rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3.5 py-1.5 text-xs font-semibold leading-5 text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
          >
            <KeyRound className="h-4 w-4" />
            <span>{t('aiQuant.configApiShort')}</span>
          </Link>
        </div>
      </section>

      <div className="hidden flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:flex">
        <div className="min-w-0">
          <h1 className="!text-base !font-semibold !leading-6 text-[color:var(--cf-text-strong)]">
            {t('aiQuant.title')}
          </h1>
          <p className="mt-1 text-sm leading-[22px] text-[color:var(--cf-muted)]">{t('aiQuant.subtitle')}</p>
        </div>
        <div className="hidden items-center justify-end gap-2 sm:flex sm:shrink-0">
          <Link
            href={`/${lng}/ai-quant/plaza`}
            className="cf-ai-action-button cf-ai-action-neutral inline-flex items-center justify-center gap-1.5 rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3.5 py-1.5 text-xs font-semibold leading-5 text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
          >
            <Sparkles className="h-4 w-4" />
            <span className="sm:hidden">{t('aiQuant.plazaShort')}</span>
            <span className="hidden sm:inline">{t('aiQuant.plaza')}</span>
          </Link>
          <Link
            href={`/${lng}/account?tab=settings#exchange-api`}
            className="cf-ai-action-button cf-ai-action-neutral inline-flex items-center justify-center gap-1.5 rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3.5 py-1.5 text-xs font-semibold leading-5 text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
          >
            <KeyRound className="h-4 w-4" />
            <span className="sm:hidden">{t('aiQuant.configApiShort')}</span>
            <span className="hidden sm:inline">{t('aiQuant.configApi')}</span>
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

      <div className="grid min-h-0 gap-0 md:gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <ConversationSidebar
          items={conversations.map(x => ({ id: x.id, title: x.title, updatedAt: x.updatedAt }))}
          activeId={activeConversation.id}
          mobileTrigger="external"
          mobileSheetOpen={mobileConversationSheetOpen}
          onMobileSheetOpenChange={setMobileConversationSheetOpen}
          onCreate={createNewConversation}
          onSwitch={setActiveConversationId}
          onRename={(id, title) => {
            setConversations(prev =>
              prev.map(conv => (conv.id === id ? { ...conv, title, updatedAt: Date.now() } : conv)),
            )
          }}
          onDelete={id => {
            void requestDeleteConversation(id)
          }}
        />

        <div className="min-w-0 space-y-0 md:space-y-4">
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
            onParamChange={onParamChange}
            onConfirmBacktestParams={(nextDraftValues) => {
              invalidateActiveConversationBacktestRecovery()
              updateActiveConversation(curr => {
                const requestedValues = { ...curr.paramValues, ...nextDraftValues }
                const normalizedDraftConfig = buildBacktestDraftConfigFromValues(requestedValues)
                const nextValues = normalizedDraftConfig
                  ? applyBacktestDraftConfigToValues({
                      currentValues: requestedValues,
                      backtestDraftConfig: normalizedDraftConfig,
                    })
                  : requestedValues
                return {
                  ...curr,
                  paramValues: nextValues,
                  params: normalizeParamsFromValues(nextValues, curr.params),
                  backtestDraftConfig: normalizedDraftConfig,
                  backtestResult: null,
                  backtestExecutionState: 'idle',
                  backtestExecutionConfigExplicit:
                    hasExplicitBacktestExecutionOverrides(nextValues),
                  updatedAt: Date.now(),
                }
              })
              persistConversationBacktestDraft(activeConversation.id, {
                ...activeConversation.paramValues,
                ...nextDraftValues,
              })
            }}
            onSend={onSend}
            onRunBacktest={onRunBacktest}
            canRunBacktest={canRunBacktest}
            locale={lng}
            mobileMode
            mobileApiConfigHref={apiConfigHref}
            mobilePlazaHref={`/${lng}/ai-quant/plaza`}
            mobilePanelTab={rightPanelTab}
            onMobilePanelTabChange={openMobilePanelTab}
          />

          {activeConversation.validationReport && !activeConversation.validationReport.ok && (
            <SemanticGraphValidationAlert validationReport={activeConversation.validationReport} />
          )}

          <div data-testid="ai-quant-right-panel" className="hidden space-y-3 md:block">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'logic' as const, label: t('aiQuant.messages.graphTitle') },
                { key: 'backtest' as const, label: t('aiQuant.backtestResult') },
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setRightPanelTab(tab.key)}
                  className={`rounded-full border px-3.5 py-1.5 !text-xs !font-semibold !leading-5 transition ${
                    rightPanelTab === tab.key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] text-[color:var(--cf-muted)] hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {rightPanelTab === 'logic' && activeConversation.backtestResult && (
              <div data-testid="deployment-state" className="sr-only">
                {deploymentState}
              </div>
            )}

            {rightPanelTab === 'logic'
              ? activeConversation.logicGraph && displayLogicGraph
                ? (
                    <DisplayLogicGraphPreview
                      graph={displayLogicGraph}
                      confirmDisabled={
                        codegenBusy ||
                        activeConversation.logicGraph.status === 'confirmed' ||
                        !semanticViewConfirmable
                      }
                      confirmed={activeConversation.logicGraph.status === 'confirmed'}
                      publishedSnapshotId={activePublishedSnapshotId}
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
                      onRevise={requestLogicGraphRevision}
                    />
                  )
                : activeConversation.logicGraph
                  ? (
                      <LogicGraphPreview
                        graph={activeConversation.logicGraph}
                        confirmDisabled={
                          codegenBusy ||
                          activeConversation.logicGraph.status === 'confirmed' ||
                          !semanticViewConfirmable
                        }
                        publishedSnapshotId={activePublishedSnapshotId}
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
                        onRevise={requestLogicGraphRevision}
                      />
                    )
                  : (
                      <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 py-4 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">
                        {t('aiQuant.messages.logicGraphEmpty', {
                          defaultValue: '描述策略想法后，逻辑图会显示在这里。',
                        })}
                      </section>
                    )
              : activeConversation.backtestResult
                ? (
                    <BacktestSummaryCard
                      result={activeConversation.backtestResult}
                      marketType={activeBacktestMarketType}
                      canDeploy={canDeploy}
                      deploymentState={deploymentState}
                      deployLabel={deployLabel}
                      drawdownLimited
                      onViewRunningStrategy={deploymentState === 'running' ? viewRunningStrategy : undefined}
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
                      onDeploy={() => {
                        if (deploymentState === 'running' || deploymentState === 'unknown') {
                          return
                        }
                        setDeployRequestId(createDeployRequestId())
                        const preferredLeverage = resolvePreferredDeployLeverage(activeConversation)
                        setSelectedDeployLeverage(
                          activePublishedDeployTruth?.marketType === 'perp'
                            && preferredLeverage !== null
                            ? preferredLeverage
                            : null,
                        )
                        setDeployOpen(true)
                      }}
                    />
                  )
                : (
                    <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 py-4 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">
                      {t('aiQuant.messages.backtestResultEmpty', {
                        defaultValue: '暂无回测结果。确认逻辑图并开始回测后，结果会显示在这里。',
                      })}
                    </section>
                  )}
          </div>
        </div>
      </div>

      {mobilePanelSheetOpen && (
        <div
          className="cf-ios-sheet-backdrop fixed inset-0 z-[80] flex items-end md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={
            rightPanelTab === 'logic'
              ? t('aiQuant.strategyConfirmation', { defaultValue: '策略确认' })
              : t('aiQuant.backtestResult')
          }
          onClick={() => setMobilePanelSheetOpen(false)}
        >
          <div
            className="cf-ios-sheet-panel max-h-[82dvh] w-full overflow-hidden p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-2 flex items-start gap-2">
              <div className="grid flex-1 grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRightPanelTab('logic')}
                  className={`rounded-full border px-3.5 py-1.5 !text-xs !font-semibold !leading-5 ${
                    rightPanelTab === 'logic'
                      ? 'border-primary bg-primary text-white'
                      : 'border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)] text-[color:var(--cf-text-strong)]'
                  }`}
                >
                  {t('aiQuant.strategyConfirmation', { defaultValue: '策略确认' })}
                </button>
                <button
                  type="button"
                  onClick={() => setRightPanelTab('backtest')}
                  className={`rounded-full border px-3.5 py-1.5 !text-xs !font-semibold !leading-5 ${
                    rightPanelTab === 'backtest'
                      ? 'border-primary bg-primary text-white'
                      : 'border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)] text-[color:var(--cf-text-strong)]'
                  }`}
                >
                  {t('aiQuant.backtestResult')}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMobilePanelSheetOpen(false)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)] text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]"
                aria-label={t('common.close', { defaultValue: 'Close' })}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[calc(82dvh-4.75rem)] overflow-y-auto">
              {rightPanelTab === 'logic'
                ? activeConversation.logicGraph && displayLogicGraph
                  ? (
                      <DisplayLogicGraphPreview
                        graph={displayLogicGraph}
                        confirmDisabled={
                          codegenBusy ||
                          activeConversation.logicGraph.status === 'confirmed' ||
                          !semanticViewConfirmable
                        }
                        confirmed={activeConversation.logicGraph.status === 'confirmed'}
                        publishedSnapshotId={activePublishedSnapshotId}
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
                        onRevise={requestLogicGraphRevision}
                      />
                    )
                  : activeConversation.logicGraph
                    ? (
                        <LogicGraphPreview
                          graph={activeConversation.logicGraph}
                          confirmDisabled={
                            codegenBusy ||
                            activeConversation.logicGraph.status === 'confirmed' ||
                            !semanticViewConfirmable
                          }
                          publishedSnapshotId={activePublishedSnapshotId}
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
                          onRevise={requestLogicGraphRevision}
                        />
                      )
                    : (
                        <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 py-4 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">
                          {t('aiQuant.messages.logicGraphEmpty', {
                            defaultValue: '描述策略想法后，逻辑图会显示在这里。',
                          })}
                        </section>
                      )
                : activeConversation.backtestResult
                  ? (
                      <BacktestSummaryCard
                        result={activeConversation.backtestResult}
                        marketType={activeBacktestMarketType}
                        canDeploy={canDeploy}
                        deploymentState={deploymentState}
                        deployLabel={deployLabel}
                        fullScreenButtonClassName="mr-5"
                        drawdownLimited
                        onViewRunningStrategy={deploymentState === 'running' ? viewRunningStrategy : undefined}
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
                        onDeploy={() => {
                          if (deploymentState === 'running' || deploymentState === 'unknown') {
                            return
                          }
                          setMobilePanelSheetOpen(false)
                          setDeployRequestId(createDeployRequestId())
                          const preferredLeverage = resolvePreferredDeployLeverage(activeConversation)
                          setSelectedDeployLeverage(
                            activePublishedDeployTruth?.marketType === 'perp'
                              && preferredLeverage !== null
                              ? preferredLeverage
                              : null,
                          )
                          setDeployOpen(true)
                        }}
                      />
                    )
                  : (
                      <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 py-4 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">
                        {t('aiQuant.messages.backtestResultEmpty', {
                          defaultValue: '暂无回测结果。确认逻辑图并开始回测后，结果会显示在这里。',
                        })}
                      </section>
                    )}
            </div>
          </div>
        </div>
      )}

      <RunningStrategyEditGuardDialog
        open={editGuardOpen}
        mode={deploymentState === 'running' ? 'running' : 'unknown'}
        stopPending={deploymentActionPending}
        errorMessage={deploymentGuardErrorMessage}
        onViewRunningStrategy={viewRunningStrategy}
        onStopStrategy={() => {
          setDeploymentGuardErrorMessage(null)
          void openStopDialogWithLatestDeploymentDetail()
        }}
        onClose={() => {
          if (deploymentActionPending) {
            return
          }
          setEditGuardOpen(false)
          setStopDialogOpen(false)
          setDeploymentGuardErrorMessage(null)
        }}
      />

      <StopRunningStrategyDialog
        open={stopDialogOpen}
        strategy={deploymentDetail}
        pending={deploymentActionPending}
        errorMessage={deploymentGuardErrorMessage}
        onStopOnly={() => {
          void performPublishedStrategyRuntimeAction('stop')
        }}
        onLiquidateAndStop={() => {
          void performPublishedStrategyRuntimeAction('liquidate_and_stop')
        }}
        onCancel={() => {
          if (deploymentActionPending) {
            return
          }
          setStopDialogOpen(false)
          setDeploymentGuardErrorMessage(null)
        }}
      />

      <AiQuantDeletionDialog
        open={conversationDeleteDialog !== null}
        kind={((): AiQuantDeletionDialogKind => {
          const status = conversationDeleteDialog?.status
          if (status === 'loading') return 'loading'
          if (status === 'running') return 'running'
          if (status === 'unknown') return 'unknown'
          if (status === 'conversation-only') return 'conversation-only'
          return 'with-conversation'
        })()}
        pending={conversationDeleteDialog?.pending ?? false}
        errorMessage={conversationDeleteDialog?.errorMessage ?? null}
        conversation={conversationDeleteDialog
          ? { title: conversationDeleteDialog.conversation.title }
          : null}
        strategy={conversationDeleteDialog && conversationDeleteDialog.strategyInstanceId
          ? {
              name: conversationDeleteDialog.strategy?.name ?? null,
              id: conversationDeleteDialog.strategyInstanceId,
            }
          : undefined}
        deleteStoppedStrategy={conversationDeleteDialog?.deleteStoppedStrategy ?? false}
        onToggleDeleteStoppedStrategy={(next) => {
          setConversationDeleteDialog(curr => curr
            ? { ...curr, deleteStoppedStrategy: next }
            : curr)
        }}
        onConfirm={() => {
          if (!conversationDeleteDialog) return
          // 复选框 + dialog 内 inline 警告（destructive-warning）已经构成
          // 充分的破坏性意图标识；不再使用 window.confirm 二次拦截。
          void confirmDeleteConversation()
        }}
        onGoToRunningStrategy={() => {
          if (!conversationDeleteDialog) return
          const strategyInstanceId = conversationDeleteDialog.strategyInstanceId
          setConversationDeleteDialog(null)
          router.push(`/${lng}/account/ai-quant/strategy/${strategyInstanceId}`)
        }}
        onClose={() => {
          if (conversationDeleteDialog?.pending) return
          setConversationDeleteDialog(null)
        }}
      />

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
        mode={deploymentState === 'stopped' ? 'redeploy' : 'deploy'}
        driftReasons={[]}
        onSelectAccount={setSelectedDeployAccountId}
        onConfirmDeploy={async () => {
          if (deploySubmitting) {
            return
          }
          if (!activeConversation.backtestResult || !session?.userId) return
          const deployedDetail = await confirmAiQuantDeploy({
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
          if (!deployedDetail) {
            return
          }
          setDeploymentDetail(deployedDetail)
          setDeploymentDetailStatus('ready')
          updateActiveConversation(curr => ({
            ...curr,
            publishedStrategyInstanceId: deployedDetail.id,
            updatedAt: Date.now(),
          }))
        }}
        lng={lng}
      />
    </main>
  )
}
