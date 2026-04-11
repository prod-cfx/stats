'use client'

import type { AiQuantStrategyRecord } from '@/components/account/ai-quant-strategy-store'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchBacktestCapabilities } from '@/components/ai-quant/backtest-capability-client'
import { createBacktestJob, getBacktestJob } from '@/components/ai-quant/backtest-job-client'
import {
  BacktestPayloadBuilderError,
  buildBacktestPayload,
  isBacktestPayloadBuilderError,
} from '@/components/ai-quant/backtest-payload-builder'
import { checkBacktestSymbolSupport } from '@/components/ai-quant/backtest-symbol-support-client'
import { mapAccountStrategyDetailToRecord } from '@/components/account/ai-quant-strategy-api-adapter'
import { AiQuantStrategyDetail } from '@/components/account/AiQuantStrategyDetail'
import { useAuth } from '@/hooks/use-auth'
import { ApiError } from '@/lib/errors'
import { fetchAccountAiQuantStrategyDetail } from '@/lib/api'
import {
  resolveBacktestExecutionConfig,
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
      const symbol = strategy.symbol?.trim() ?? ''
      const baseTimeframe = strategy.timeframe?.trim() ?? ''
      const exchange = strategy.exchange
      const executionConfig = resolveBacktestExecutionConfig(strategy.paramValues ?? {})
      if (!executionConfig.allowPartialValid) {
        throw new BacktestPayloadBuilderError('invalid_execution_config')
      }
      if (!publishedSnapshotId) {
        throw new BacktestPayloadBuilderError('missing_published_snapshot')
      }
      if (!symbol) {
        throw new BacktestPayloadBuilderError('missing_symbol')
      }
      if (!baseTimeframe) {
        throw new BacktestPayloadBuilderError('timeframe_not_allowed')
      }

      const capabilities = await fetchBacktestCapabilities()
      const payload = buildBacktestPayload({
        symbol,
        baseTimeframe,
        capabilities,
        stateTimeframes: [baseTimeframe],
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
        allowPartial: executionConfig.allowPartial,
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
        throw new ApiError(latestJob.error ?? '回测任务执行失败', 'BACKTEST_FAILED')
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
    />
  )
}
