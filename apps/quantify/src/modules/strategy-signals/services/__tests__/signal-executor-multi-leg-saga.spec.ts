/**
 * #1208 — Executor-stage multi-leg saga compensate unit tests.
 *
 * Verifies that when one leg of a multi-leg fan-out batch fails to execute on
 * an account, the executor:
 *   1. Reads `metadata.runtimeProvenance.leg` to detect multi-leg signals.
 *   2. Queries sibling EXECUTED signals from the same emit batch on the same
 *      account (by `runtimeProvenance.executionSemanticKey`).
 *   3. Submits a reduce-only market close for each EXECUTED sibling.
 *   4. Writes saga audit metadata to each sibling execution.
 *   5. Skips siblings already saga-compensated (idempotency).
 *   6. Single-leg signals (no `metadata.runtimeProvenance.leg`) bypass the
 *      whole compensate path — byte-equal guard for AC #3.
 *
 * Tests use a standalone harness that replicates the helper's contract,
 * mirroring the PR4b saga-spec pattern, since the full SignalExecutorService
 * constructor needs ~10 NestJS providers.
 */
import { Logger } from '@nestjs/common'

// ---------------------------------------------------------------------------
// Test harness — replicates triggerMultiLegSagaCompensateIfNeeded contract
// ---------------------------------------------------------------------------

interface SiblingExecutionStub {
  id: string
  status: 'EXECUTED' | 'FAILED' | 'SKIPPED' | 'PENDING'
  metadata: Record<string, unknown> | null
  executedQuantity: string | null
  orderSide: 'BUY' | 'SELL'
}

interface SiblingSignalStub {
  id: string
  symbol: { exchange: string; instrumentType: 'SPOT' | 'PERPETUAL'; baseAsset: string; quoteAsset: string } | null
  executions: SiblingExecutionStub[]
}

interface FailedSignalStub {
  id: string
  metadata: Record<string, unknown> | null
  strategyInstanceId: string | null
  llmStrategyInstanceId: string | null
}

function makeHarness(opts: {
  siblings: SiblingSignalStub[]
  prepareResult?: { status: string; reason?: string }
  submitResult?: { status: string; reason?: string; order?: { id: string } | null }
  prepareThrows?: Error
}) {
  const logger = new Logger('ExecutorSagaHarness')
  jest.spyOn(logger, 'log').mockImplementation(() => undefined)
  jest.spyOn(logger, 'error').mockImplementation(() => undefined)
  jest.spyOn(logger, 'warn').mockImplementation(() => undefined)

  const findExecutedMultiLegSiblings = jest.fn().mockResolvedValue(opts.siblings)
  const prepareIntent = opts.prepareThrows
    ? jest.fn().mockRejectedValue(opts.prepareThrows)
    : jest.fn().mockResolvedValue(opts.prepareResult ?? { status: 'prepared' })
  const submitPrepared = jest.fn().mockResolvedValue(
    opts.submitResult ?? { status: 'submitted', order: { id: 'compensate-order-1' } },
  )
  const markStage = jest.fn().mockResolvedValue(undefined)

  function readSignalRuntimeProvenance(signal: { metadata: Record<string, unknown> | null }) {
    const m = signal.metadata
    if (!m || typeof m !== 'object') return null
    const rp = (m as any).runtimeProvenance
    if (!rp || typeof rp !== 'object') return null
    return rp as Record<string, unknown>
  }

  async function triggerMultiLegSagaCompensateIfNeeded(
    failedSignal: FailedSignalStub,
    account: { id: string; userId: string },
  ): Promise<void> {
    const runtimeProvenance = readSignalRuntimeProvenance(failedSignal)
    if (!runtimeProvenance) return

    const legMeta = runtimeProvenance.leg
    if (!legMeta || typeof legMeta !== 'object') return

    const executionSemanticKey = runtimeProvenance.executionSemanticKey
    if (typeof executionSemanticKey !== 'string' || executionSemanticKey.length === 0) {
      logger.warn(`[multi-leg saga executor] missing executionSemanticKey on ${failedSignal.id}`)
      return
    }

    const failedLegId = typeof (legMeta as any).legId === 'string' ? (legMeta as any).legId : 'unknown'

    let siblings: SiblingSignalStub[]
    try {
      siblings = await findExecutedMultiLegSiblings({
        strategyInstanceId: failedSignal.strategyInstanceId,
        llmStrategyInstanceId: failedSignal.llmStrategyInstanceId,
        executionSemanticKey,
        excludeSignalId: failedSignal.id,
        accountId: account.id,
      })
    }
    catch (err) {
      logger.error(`[multi-leg saga executor] sibling query failed: ${(err as Error).message}`)
      return
    }

    if (!siblings.length) return

    for (const sibling of siblings) {
      const execution = sibling.executions.find(e => e.status === 'EXECUTED')
      if (!execution) continue

      const meta = execution.metadata
      if (meta && typeof meta === 'object' && (meta as any).sagaCompensated === true) {
        continue
      }

      const compensatedAt = new Date().toISOString()
      const symbol = sibling.symbol
      if (!symbol) {
        await markStage(execution.id, 'RECONCILE_REQUIRED', {
          sagaCompensated: true, sagaReason: 'sibling_leg_execute_failed',
          sagaCompensateFailed: true, sagaCompensateFailureReason: 'SAGA_COMPENSATE_SYMBOL_MISSING',
          failedLegId, failedSignalId: failedSignal.id, compensatedAt,
        })
        continue
      }

      const qty = execution.executedQuantity ? Number(execution.executedQuantity) : 0
      if (!Number.isFinite(qty) || qty <= 0) {
        await markStage(execution.id, 'RECONCILE_REQUIRED', {
          sagaCompensated: true, sagaReason: 'sibling_leg_execute_failed',
          sagaCompensateFailed: true, sagaCompensateFailureReason: 'SAGA_COMPENSATE_QUANTITY_INVALID',
          failedLegId, failedSignalId: failedSignal.id, compensatedAt,
        })
        continue
      }

      const closeSide: 'buy' | 'sell' = execution.orderSide === 'BUY' ? 'sell' : 'buy'
      try {
        const prepared = await prepareIntent({
          source: 'signal', sourceId: execution.id, userId: account.userId,
          exchangeAccountId: null, exchangeId: 'binance', marketType: 'spot',
          symbol: `${symbol.baseAsset}/${symbol.quoteAsset}`, side: closeSide,
          type: 'market', amount: qty, reduceOnly: true, role: 'spot_sell',
        })
        if (prepared.status !== 'prepared') {
          await markStage(execution.id, 'RECONCILE_REQUIRED', {
            sagaCompensated: true, sagaReason: 'sibling_leg_execute_failed',
            sagaCompensateFailed: true, sagaCompensateFailureReason: prepared.reason ?? 'SAGA_COMPENSATE_PREPARE_FAILED',
            failedLegId, failedSignalId: failedSignal.id, compensatedAt,
          })
          continue
        }
        const submitted = await submitPrepared(prepared)
        if (submitted.status !== 'submitted') {
          await markStage(execution.id, 'RECONCILE_REQUIRED', {
            sagaCompensated: true, sagaReason: 'sibling_leg_execute_failed',
            sagaCompensateFailed: true, sagaCompensateFailureReason: submitted.reason ?? 'SAGA_COMPENSATE_SUBMIT_FAILED',
            failedLegId, failedSignalId: failedSignal.id, compensatedAt,
          })
          continue
        }
        await markStage(execution.id, 'RECONCILE_REQUIRED', {
          sagaCompensated: true, sagaReason: 'sibling_leg_execute_failed',
          failedLegId, failedSignalId: failedSignal.id,
          compensateOrderId: submitted.order?.id ?? null, compensatedAt,
        })
      }
      catch (err) {
        await markStage(execution.id, 'RECONCILE_REQUIRED', {
          sagaCompensated: true, sagaReason: 'sibling_leg_execute_failed',
          sagaCompensateFailed: true,
          sagaCompensateFailureReason: `SAGA_COMPENSATE_THROWN:${(err as Error).message}`,
          failedLegId, failedSignalId: failedSignal.id, compensatedAt,
        })
      }
    }
  }

  return { triggerMultiLegSagaCompensateIfNeeded, findExecutedMultiLegSiblings, prepareIntent, submitPrepared, markStage, logger }
}

const ACCOUNT = { id: 'acct-1', userId: 'user-1' }

const SYMBOL_BTC_USDT = {
  exchange: 'BINANCE',
  instrumentType: 'SPOT' as const,
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
}

function makeMultiLegFailedSignal(legId: string, semanticKey = 'sem-key-1'): FailedSignalStub {
  return {
    id: `signal-${legId}`,
    strategyInstanceId: 'instance-1',
    llmStrategyInstanceId: null,
    metadata: {
      runtimeProvenance: {
        executionSemanticKey: semanticKey,
        leg: { legId, legScopeId: `${legId}-scope`, totalLegs: 2, legSizing: { mode: 'fixed_quote', value: 100 } },
      },
    },
  }
}

function makeExecutedSibling(legId: string, executionId: string, side: 'BUY' | 'SELL' = 'BUY', qty = '0.001'): SiblingSignalStub {
  return {
    id: `signal-${legId}`,
    symbol: SYMBOL_BTC_USDT,
    executions: [{
      id: executionId, status: 'EXECUTED', metadata: null, executedQuantity: qty, orderSide: side,
    }],
  }
}

describe('SignalExecutorService#triggerMultiLegSagaCompensateIfNeeded (#1208)', () => {
  it('T1: dual-leg, leg-A EXECUTED + leg-B fails → market-close leg-A with audit metadata', async () => {
    const harness = makeHarness({ siblings: [makeExecutedSibling('leg-a', 'exec-A')] })
    const failedB = makeMultiLegFailedSignal('leg-b')

    await harness.triggerMultiLegSagaCompensateIfNeeded(failedB, ACCOUNT)

    expect(harness.findExecutedMultiLegSiblings).toHaveBeenCalledWith(expect.objectContaining({
      strategyInstanceId: 'instance-1',
      executionSemanticKey: 'sem-key-1',
      excludeSignalId: 'signal-leg-b',
      accountId: 'acct-1',
    }))
    expect(harness.prepareIntent).toHaveBeenCalledTimes(1)
    expect(harness.prepareIntent).toHaveBeenCalledWith(expect.objectContaining({
      side: 'sell', reduceOnly: true, type: 'market', amount: 0.001,
    }))
    expect(harness.submitPrepared).toHaveBeenCalledTimes(1)
    expect(harness.markStage).toHaveBeenCalledWith('exec-A', 'RECONCILE_REQUIRED', expect.objectContaining({
      sagaCompensated: true,
      sagaReason: 'sibling_leg_execute_failed',
      failedLegId: 'leg-b',
      failedSignalId: 'signal-leg-b',
      compensateOrderId: 'compensate-order-1',
    }))
  })

  it('T2: single-leg signal (no metadata.leg) → byte-equal: never queries siblings or trading-execution', async () => {
    const harness = makeHarness({ siblings: [] })
    const singleLegSignal: FailedSignalStub = {
      id: 'signal-single',
      strategyInstanceId: 'instance-1',
      llmStrategyInstanceId: null,
      metadata: { runtimeProvenance: { executionSemanticKey: 'sem-key-1' } }, // no leg field
    }

    await harness.triggerMultiLegSagaCompensateIfNeeded(singleLegSignal, ACCOUNT)

    expect(harness.findExecutedMultiLegSiblings).not.toHaveBeenCalled()
    expect(harness.prepareIntent).not.toHaveBeenCalled()
    expect(harness.submitPrepared).not.toHaveBeenCalled()
    expect(harness.markStage).not.toHaveBeenCalled()
  })

  it('T3: leg-B fails but no sibling has EXECUTED execution → no compensate', async () => {
    const harness = makeHarness({ siblings: [] })
    const failedB = makeMultiLegFailedSignal('leg-b')

    await harness.triggerMultiLegSagaCompensateIfNeeded(failedB, ACCOUNT)

    expect(harness.findExecutedMultiLegSiblings).toHaveBeenCalledTimes(1)
    expect(harness.prepareIntent).not.toHaveBeenCalled()
    expect(harness.submitPrepared).not.toHaveBeenCalled()
    expect(harness.markStage).not.toHaveBeenCalled()
  })

  it('T4: market-close throws → still records FAILED audit metadata and does not propagate error', async () => {
    const harness = makeHarness({
      siblings: [makeExecutedSibling('leg-a', 'exec-A')],
      prepareThrows: new Error('exchange offline'),
    })
    const failedB = makeMultiLegFailedSignal('leg-b')

    await expect(harness.triggerMultiLegSagaCompensateIfNeeded(failedB, ACCOUNT)).resolves.toBeUndefined()

    expect(harness.markStage).toHaveBeenCalledWith('exec-A', 'RECONCILE_REQUIRED', expect.objectContaining({
      sagaCompensated: true,
      sagaCompensateFailed: true,
      sagaCompensateFailureReason: expect.stringContaining('exchange offline'),
      failedLegId: 'leg-b',
    }))
  })

  it('T5: three legs, leg-C fails, leg-A + leg-B both EXECUTED → both siblings compensated', async () => {
    const harness = makeHarness({
      siblings: [
        makeExecutedSibling('leg-a', 'exec-A', 'BUY', '0.001'),
        makeExecutedSibling('leg-b', 'exec-B', 'BUY', '0.002'),
      ],
    })
    const failedC = makeMultiLegFailedSignal('leg-c')

    await harness.triggerMultiLegSagaCompensateIfNeeded(failedC, ACCOUNT)

    expect(harness.prepareIntent).toHaveBeenCalledTimes(2)
    expect(harness.submitPrepared).toHaveBeenCalledTimes(2)
    expect(harness.markStage).toHaveBeenNthCalledWith(1, 'exec-A', 'RECONCILE_REQUIRED', expect.objectContaining({
      sagaCompensated: true, failedLegId: 'leg-c',
    }))
    expect(harness.markStage).toHaveBeenNthCalledWith(2, 'exec-B', 'RECONCILE_REQUIRED', expect.objectContaining({
      sagaCompensated: true, failedLegId: 'leg-c',
    }))
  })

  it('T6: idempotency — sibling already sagaCompensated → skipped (no double compensate)', async () => {
    const sibling = makeExecutedSibling('leg-a', 'exec-A')
    sibling.executions[0].metadata = { sagaCompensated: true }
    const harness = makeHarness({ siblings: [sibling] })
    const failedB = makeMultiLegFailedSignal('leg-b')

    await harness.triggerMultiLegSagaCompensateIfNeeded(failedB, ACCOUNT)

    expect(harness.prepareIntent).not.toHaveBeenCalled()
    expect(harness.submitPrepared).not.toHaveBeenCalled()
    expect(harness.markStage).not.toHaveBeenCalled()
  })

  it('T7: missing executionSemanticKey → warns and bails out without sibling query', async () => {
    const harness = makeHarness({ siblings: [] })
    const failed: FailedSignalStub = {
      id: 'signal-leg-b',
      strategyInstanceId: 'instance-1',
      llmStrategyInstanceId: null,
      metadata: {
        runtimeProvenance: {
          // no executionSemanticKey
          leg: { legId: 'leg-b', legScopeId: 'leg-b-scope', totalLegs: 2, legSizing: { mode: 'fixed_quote', value: 100 } },
        },
      },
    }

    await harness.triggerMultiLegSagaCompensateIfNeeded(failed, ACCOUNT)

    expect(harness.findExecutedMultiLegSiblings).not.toHaveBeenCalled()
    expect(harness.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('missing executionSemanticKey'),
    )
  })

  it('T8: SELL sibling → close side reverses to buy', async () => {
    const harness = makeHarness({
      siblings: [makeExecutedSibling('leg-a', 'exec-A', 'SELL', '0.005')],
    })
    const failedB = makeMultiLegFailedSignal('leg-b')

    await harness.triggerMultiLegSagaCompensateIfNeeded(failedB, ACCOUNT)

    expect(harness.prepareIntent).toHaveBeenCalledWith(expect.objectContaining({
      side: 'buy', reduceOnly: true, amount: 0.005,
    }))
  })
})
