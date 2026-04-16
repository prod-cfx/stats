'use client'

import type { AiQuantStrategyRecord } from '@/components/account/ai-quant-strategy-store'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { mapAccountStrategyDetailToRecord } from '@/components/account/ai-quant-strategy-api-adapter'
import { AiQuantStrategyDetail } from '@/components/account/AiQuantStrategyDetail'
import { fetchBacktestCapabilities } from '@/components/ai-quant/backtest-capability-client'
import { createBacktestJob, formatBacktestJobFailure, getBacktestJob } from '@/components/ai-quant/backtest-job-client'
import {
  BacktestPayloadBuilderError,
  buildBacktestPayload,
  isBacktestPayloadBuilderError,
} from '@/components/ai-quant/backtest-payload-builder'
import { checkBacktestSymbolSupport } from '@/components/ai-quant/backtest-symbol-support-client'
import { useAuth } from '@/hooks/use-auth'
import {
  fetchAccountAiQuantStrategyDetail,
  updateAccountAiQuantStrategyLeverage,
} from '@/lib/api'
import { ApiError } from '@/lib/errors'
import {
  requiresRepublishForPublishedSnapshot,
  resolveBacktestExecutionConfig,
  resolveEffectivePublishedBacktestInputs,
  resolveBacktestRangeInput,
} from '../../../../ai-quant/ai-quant-page-conversation'

const BACKTEST_JOB_POLL_INTERVAL_MS = 1500
const BACKTEST_JOB_TIMEOUT_MS = 60_000

interface StrategyDetailPageClientProps {
  lng: 'zh' | 'en'
  id: string
}

function sleep(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

function getBacktestErrorMessage(error: unknown): string {
  if (isBacktestPayloadBuilderError(error)) {
    switch (error.code) {
      case 'missing_published_snapshot':
        return '当前策略缺少 published snapshot，无法直接发起回测。'
      case 'missing_symbol':
        return '当前策略缺少交易对，无法发起回测。'
      case 'timeframe_not_allowed':
        return '当前策略的周期不在可回测能力范围内。'
      case 'missing_range':
        return '当前策略缺少有效回测区间。'
      case 'start_after_end':
        return '回测开始时间必须早于结束时间。'
      case 'range_too_large':
        return '回测区间过大，请缩小后重试。'
      case 'invalid_execution_config':
      default:
        return '当前策略的回测执行参数无效，请先修正策略快照配置。'
    }
  }

  if (error instanceof BacktestPayloadBuilderError) {
    return getBacktestErrorMessage(error)
  }
  if (error instanceof ApiError && error.message.trim()) {
    return error.message
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return '现有策略回测失败，请稍后重试。'
}

export function StrategyDetailPageClient({ lng, id }: StrategyDetailPageClientProps) {
  const router = useRouter()
  const { session, isLoading } = useAuth()
  const [strategy, setStrategy] = useState<AiQuantStrategyRecord | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(true)
  const [isBacktestRunning, setIsBacktestRunning] = useState(false)
  const [backtestError, setBacktestError] = useState<string | null>(null)
  const [isUpdatingLeverage, setIsUpdatingLeverage] = useState(false)
  const [leverageUpdateError, setLeverageUpdateError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !session) {
      window.location.href = `/${lng}/auth/login?redirect=${encodeURIComponent(`/${lng}/account/ai-quant/strategy/${id}`)}`
    }
  }, [id, isLoading, lng, session])

  useEffect(() => {
    if (isLoading || !session) return
    let cancelled = false
    setIsDetailLoading(true)

    void fetchAccountAiQuantStrategyDetail(id, session.userId)
      .then((detail) => {
        if (cancelled) return
        setStrategy(mapAccountStrategyDetailToRecord(detail))
      })
      .catch(() => {
        if (cancelled) return
        setStrategy(null)
      })
      .finally(() => {
        if (!cancelled) setIsDetailLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, isLoading, session])

  const handleRunBacktest = useCallback(async () => {
    if (!session || !strategy || isBacktestRunning) return

    setBacktestError(null)
    setIsBacktestRunning(true)

    try {
      const publishedSnapshotId = strategy.publishedSnapshotId?.trim() ?? ''
      if (!publishedSnapshotId) {
        throw new BacktestPayloadBuilderError('missing_published_snapshot')
      }
      if (requiresRepublishForPublishedSnapshot({
        publishedSnapshotId,
        publishedSnapshotParamValues: strategy.publishedSnapshotParamValues ?? null,
        publishedSnapshotCompatibilityMetadata: strategy.compatibilityMetadata ?? null,
        editableParamValues: strategy.paramValues ?? {},
      })) {
        throw new ApiError('当前参数已脱离已发布快照，请重新发布后再回测。', 'REPUBLISH_REQUIRED')
      }
      const effectiveInputs = resolveEffectivePublishedBacktestInputs({
        publishedSnapshotId,
        publishedSnapshotStrategyConfig: strategy.publishedSnapshotParamValues
          ? {
              exchange: typeof strategy.publishedSnapshotParamValues.exchange === 'string'
                ? strategy.publishedSnapshotParamValues.exchange
                : strategy.exchange,
              symbol: typeof strategy.publishedSnapshotParamValues.symbol === 'string'
                ? strategy.publishedSnapshotParamValues.symbol
                : strategy.symbol,
              baseTimeframe: typeof strategy.publishedSnapshotParamValues.baseTimeframe === 'string'
                ? strategy.publishedSnapshotParamValues.baseTimeframe
                : strategy.timeframe,
              positionPct:
                typeof strategy.publishedSnapshotParamValues.positionPct === 'number'
                  ? strategy.publishedSnapshotParamValues.positionPct
                  : strategy.positionPct,
            }
          : null,
        publishedSnapshotCompatibilityMetadata: strategy.compatibilityMetadata ?? null,
      })
      if (!effectiveInputs) {
        throw new ApiError('当前已发布快照缺少策略市场绑定真相，请重新发布后再回测。', 'PUBLISHED_SNAPSHOT_PARAMS_MISSING')
      }
      const { symbol, baseTimeframe, exchange } = effectiveInputs
      const executionConfig = resolveBacktestExecutionConfig(strategy.paramValues ?? {})
      const snapshotStateTimeframes = strategy.snapshotBacktestConfigDefaults?.stateTimeframes ?? []
      if (!executionConfig.allowPartialValid) {
        throw new BacktestPayloadBuilderError('invalid_execution_config')
      }

      const capabilities = await fetchBacktestCapabilities()
      const payload = buildBacktestPayload({
        symbol,
        baseTimeframe,
        capabilities,
        stateTimeframes: snapshotStateTimeframes.length > 0 ? snapshotStateTimeframes : [baseTimeframe],
        initialCash: executionConfig.initialCash,
        leverage: executionConfig.leverage,
        execution: {
          slippageBps: executionConfig.slippageBps,
          feeBps: executionConfig.feeBps,
          priceSource: executionConfig.priceSource as 'open' | 'close' | 'mid',
        },
        strategy: {
          id: strategy.id,
          publishedSnapshotId,
        },
        range: resolveBacktestRangeInput(strategy.paramValues ?? {}),
        // Top-level allowPartial controls whether the backtest job may clamp the
        // requested range to the available market-data coverage. It is not the
        // same semantic as the snapshot execution-policy allowPartialFill flag.
        allowPartial: true,
      })

      const support = await checkBacktestSymbolSupport({ exchange, symbol })
      if (support.status === 'not_supported') {
        throw new ApiError('当前策略交易对暂不支持回测', 'SYMBOL_NOT_SUPPORTED')
      }

      const createdJob = await createBacktestJob(payload)
      let latestJob = createdJob
      const deadline = Date.now() + BACKTEST_JOB_TIMEOUT_MS

      while (latestJob.status === 'queued' || latestJob.status === 'running') {
        if (Date.now() >= deadline) {
          throw new ApiError('回测任务执行超时，请稍后重试', 'BACKTEST_TIMEOUT')
        }
        await sleep(BACKTEST_JOB_POLL_INTERVAL_MS)
        latestJob = await getBacktestJob(createdJob.id)
      }

      if (latestJob.status !== 'succeeded') {
        throw new ApiError(formatBacktestJobFailure(latestJob), 'BACKTEST_FAILED', 409, latestJob.errorDetails)
      }

      const search = new URLSearchParams({
        symbol,
        startAt: new Date(payload.dataRange.fromTs).toISOString(),
        endAt: new Date(payload.dataRange.toTs).toISOString(),
      })
      router.push(`/${lng}/ai-quant/backtest/${createdJob.id}?${search.toString()}`)
    } catch (error) {
      setBacktestError(getBacktestErrorMessage(error))
    } finally {
      setIsBacktestRunning(false)
    }
  }, [isBacktestRunning, lng, router, session, strategy])

  const handleUpdateLeverage = useCallback(async (leverage: number) => {
    if (!session?.userId || !strategy) return
    setLeverageUpdateError(null)
    setIsUpdatingLeverage(true)
    try {
      const detail = await updateAccountAiQuantStrategyLeverage(strategy.id, {
        userId: session.userId,
        leverage,
      })
      setStrategy(mapAccountStrategyDetailToRecord(detail))
    } catch (error) {
      setLeverageUpdateError(getBacktestErrorMessage(error))
    } finally {
      setIsUpdatingLeverage(false)
    }
  }, [session?.userId, strategy])

  if (isLoading || !session || isDetailLoading) {
    return <main className="mx-auto w-full max-w-[920px] flex-1 px-4 py-8 md:px-8" />
  }

  return (
    <AiQuantStrategyDetail
      lng={lng}
      strategy={strategy}
      onRunBacktest={handleRunBacktest}
      isBacktestRunning={isBacktestRunning}
      backtestError={backtestError}
      onUpdateLeverage={handleUpdateLeverage}
      isUpdatingLeverage={isUpdatingLeverage}
      leverageUpdateError={leverageUpdateError}
    />
  )
}
