import type { Dispatch, SetStateAction } from 'react'

import type { ConversationState, QuantParams } from './ai-quant-page-conversation'
import {
  deployAccountAiQuantStrategy,
  fetchAccountAiQuantDeployResult,
  fetchUserExchangeAccountStatuses,
} from '@/lib/api'
import { ApiError } from '@/lib/errors'
import { extractCodegenErrorMessage } from './ai-quant-page-codegen'
import { mapExchangeStatusesToDeployAccounts } from './ai-quant-page-conversation'

type Translate = (key: string, options?: Record<string, unknown>) => string

function isTransientDeployError(error: unknown): boolean {
  const candidate = error as {
    code?: unknown
    statusCode?: unknown
    status?: unknown
    details?: { error?: { code?: unknown } }
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

export function createDeployRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function confirmAiQuantDeploy(args: {
  activeConversation: ConversationState
  apiConfigHref: string
  deployRequestId: string | null
  selectedDeployAccountId: string
  selectedDeployExchange: QuantParams['exchange']
  selectedDeployMarketType: 'spot' | 'perp' | null
  selectedDeployLeverage: number | null
  sessionUserId: string
  setDeployOpen: Dispatch<SetStateAction<boolean>>
  setDeployRequestId: Dispatch<SetStateAction<string | null>>
  setDeploySubmitting: Dispatch<SetStateAction<boolean>>
  setExchangeAccounts: Dispatch<SetStateAction<ReturnType<typeof mapExchangeStatusesToDeployAccounts>>>
  setSelectedDeployAccountId: Dispatch<SetStateAction<string>>
  t: Translate
  updateActiveConversation: (updater: (curr: ConversationState) => ConversationState) => void
  push: (href: string) => void
}): Promise<void> {
  const {
    activeConversation,
    apiConfigHref,
    deployRequestId,
    selectedDeployAccountId,
    selectedDeployExchange,
    selectedDeployMarketType,
    selectedDeployLeverage,
    sessionUserId,
    setDeployOpen,
    setDeployRequestId,
    setDeploySubmitting,
    setExchangeAccounts,
    setSelectedDeployAccountId,
    t,
    updateActiveConversation,
    push,
  } = args

  if (!activeConversation.backtestResult) {
    return
  }

  const strategyName =
    activeConversation.title
    || t('aiQuant.defaultStrategyName', { defaultValue: 'AI Strategy' })
  const requestId = deployRequestId ?? createDeployRequestId()
  if (!deployRequestId) {
    setDeployRequestId(requestId)
  }

  try {
    setDeploySubmitting(true)
    const publishedSnapshotId = activeConversation.publishedSnapshotId?.trim() ?? ''
    if (!publishedSnapshotId) {
      updateActiveConversation(curr => ({
        ...curr,
        messages: [
          ...curr.messages,
          {
            id: `deploy-guard-${Date.now()}`,
            role: 'assistant',
            content: t('aiQuant.messages.codegenGuard', {
              defaultValue: 'Please generate strategy code before deploying.',
            }),
          },
        ],
        updatedAt: Date.now(),
      }))
      return
    }

    if (activeConversation.publishedSnapshotCompatibilityMetadata?.requiresRepublishForDeploy) {
      updateActiveConversation(curr => ({
        ...curr,
        messages: [
          ...curr.messages,
          {
            id: `deploy-republish-${Date.now()}`,
            role: 'assistant',
            content: t('aiQuant.messages.deployRepublishRequired', {
              defaultValue: '当前已发布快照缺少可部署绑定真相，请重新发布后再部署。',
            }),
          },
        ],
        updatedAt: Date.now(),
      }))
      return
    }

    if (!selectedDeployMarketType) {
      updateActiveConversation(curr => ({
        ...curr,
        messages: [
          ...curr.messages,
          {
            id: `deploy-truth-missing-${Date.now()}`,
            role: 'assistant',
            content: t('aiQuant.messages.deployRepublishRequired', {
              defaultValue: '当前已发布快照缺少可部署绑定真相，请重新发布后再部署。',
            }),
          },
        ],
        updatedAt: Date.now(),
      }))
      return
    }

    const latestExchangeAccounts = mapExchangeStatusesToDeployAccounts(
      await fetchUserExchangeAccountStatuses(),
    )
    setExchangeAccounts(latestExchangeAccounts)
    const latestAvailableAccounts = latestExchangeAccounts.filter(
      item => item.exchange === selectedDeployExchange && item.status === 'available',
    )
    const account = latestAvailableAccounts.find(
      item => item.accountId === selectedDeployAccountId,
    )

    if (!account) {
      const nextAccountId = latestAvailableAccounts[0]?.accountId ?? ''
      setSelectedDeployAccountId(nextAccountId)
      if (!nextAccountId) {
        push(apiConfigHref)
      }
      return
    }

    try {
      await deployAccountAiQuantStrategy({
        userId: sessionUserId,
        name: strategyName,
        deployRequestId: requestId,
        publishedSnapshotId,
        exchangeAccountId: account.accountId,
        exchangeAccountName: account.accountName,
        deploymentExecutionConfig:
          selectedDeployMarketType === 'perp' && typeof selectedDeployLeverage === 'number'
            ? { leverage: selectedDeployLeverage }
            : undefined,
      })
    } catch (error) {
      if (!isTransientDeployError(error)) {
        throw error
      }

      const reconciled = await fetchAccountAiQuantDeployResult(requestId, sessionUserId)
      if (!reconciled) {
        throw error
      }
    }
    setDeployOpen(false)
    setDeployRequestId(null)
    updateActiveConversation(curr => ({
      ...curr,
      messages: [
        ...curr.messages,
        {
          id: `deploy-ok-${Date.now()}`,
          role: 'assistant',
          content: t('aiQuant.messages.deploySuccess', {
            exchange: selectedDeployExchange.toUpperCase(),
            account: account.accountName,
          }),
        },
      ],
      updatedAt: Date.now(),
    }))
  } catch (error) {
    const deployErrorMessage = extractCodegenErrorMessage(
      error,
      t('aiQuant.messages.deployFailedFallback', {
        defaultValue: 'Strategy deployment failed. Please try again later.',
      }),
    )
    updateActiveConversation(curr => ({
      ...curr,
      messages: [
        ...curr.messages,
        {
          id: `deploy-fail-${Date.now()}`,
          role: 'assistant',
          content: t('aiQuant.messages.deployFailedWithReason', {
            reason: deployErrorMessage,
            defaultValue: `Strategy deployment failed: ${deployErrorMessage}`,
          }),
        },
      ],
      updatedAt: Date.now(),
    }))
    throw error instanceof ApiError
      ? error
      : new ApiError(deployErrorMessage, 'AI_QUANT_DEPLOY_FAILED', 500, { error })
  } finally {
    setDeploySubmitting(false)
  }
}
