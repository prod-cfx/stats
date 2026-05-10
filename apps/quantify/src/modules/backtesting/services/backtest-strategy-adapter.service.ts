import type { StrategyAdapterV1, StrategyDecisionV1 } from '@ai/shared'
import type { ProgramLifecycleState } from '@ai/shared/script-engine/compiled-runtime'
import type { BacktestRunInput } from '../types/backtesting.types'
import { ErrorCode } from '@ai/shared'
import { createScriptEngine } from '@ai/shared/node'
import {
  buildCompiledManifest,
  evaluateExprPool,
  evaluateGuards,
  evaluateRiskPredicates,
  runDecisionPrograms,
  runDecisionProgramsFanOut,
  runOrderPrograms,
} from '@ai/shared/script-engine/compiled-runtime'
import { evaluateOrchestrationGates } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates'
import { evaluateOrchestrationPortfolioRisks } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks'
import { buildTimeframeBarStatus } from '@ai/shared/script-engine/helpers/build-timeframe-bar-status'
import { HttpStatus, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { CompiledScriptParserService } from '@/modules/llm-strategy-codegen/services/compiled-script-parser.service'
import { isStrategyAdapterV1 } from '@/modules/strategy-runtime/strategy-protocol.util'
import { compileStrategyScriptForVm } from '@/modules/strategy-runtime/strategy-script-compiler.util'

export interface BacktestProtocolScriptInput {
  id: string
  protocolVersion: 'v1'
  scriptCode: string
  params: Record<string, unknown>
}

@Injectable()
export class BacktestStrategyAdapterService {
  private readonly compiledScriptParser = new CompiledScriptParserService()

  async build(input: BacktestProtocolScriptInput): Promise<BacktestRunInput['strategy']> {
    if (input.protocolVersion !== 'v1') {
      throw new DomainException('backtest.strategy_protocol_invalid', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { protocolVersion: input.protocolVersion },
      })
    }

    const rawScript = typeof input.scriptCode === 'string' ? input.scriptCode : ''
    if (!rawScript.trim()) {
      throw new DomainException('backtest.strategy_script_invalid', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    const adapter = await this.resolveAdapter(rawScript)
    if (!isStrategyAdapterV1(adapter)) {
      throw new DomainException('backtest.strategy_adapter_invalid', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    return {
      id: input.id,
      params: input.params ?? {},
      fn: async ctx => adapter.onBar(ctx as never),
    }
  }

  private async resolveAdapter(scriptCode: string): Promise<unknown> {
    const compiledAdapter = this.buildCompiledAdapter(scriptCode)
    if (compiledAdapter) {
      return compiledAdapter
    }

    const compiled = compileStrategyScriptForVm(scriptCode)
    if (!compiled.ok) {
      throw new DomainException('backtest.strategy_compile_failed', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { error: compiled.error ?? 'unknown compile error' },
      })
    }

    return this.executeAdapter(compiled.executableCode)
  }

  private buildCompiledAdapter(scriptCode: string): StrategyAdapterV1 | null {
    try {
      const projection = this.compiledScriptParser.parse(scriptCode)
      const exprPool = projection.exprPool as Parameters<typeof evaluateExprPool>[1]
      const executionModel = projection.executionModel as unknown as Parameters<typeof evaluateExprPool>[3]
      const guards = projection.guards as Parameters<typeof evaluateGuards>[1]
      const riskPredicates = projection.riskPredicates as Parameters<typeof evaluateRiskPredicates>[1]
      const decisionPrograms = projection.decisionPrograms as Parameters<typeof runDecisionPrograms>[1]
      const orderPrograms = projection.orderPrograms as Parameters<typeof runOrderPrograms>[1]
      const portfolioRisks = (projection as {
        orchestrationPortfolioRisks?: Parameters<typeof evaluateOrchestrationPortfolioRisks>[0]
      }).orchestrationPortfolioRisks ?? []
      const orchestrationPrograms = ((projection as {
        orchestrationPrograms?: Parameters<typeof runOrderPrograms>[6]
      }).orchestrationPrograms ?? []) as Parameters<typeof runOrderPrograms>[6]
      // Phase 5 S2 (#1104): scope.symbol substrate
      //   - 单/0 scope 时为空数组，runDecisionPrograms 走兜底
      //   - 多 scope 时由上游 caller 设置 ctx.activeSymbolScopeId 完成 fan-out
      //   - 全 caller fan-out 循环留 follow-up issue（plan 段 N3 已声明 substrate 边界）
      // Phase 5 S3 (#1109): scope.timeframe substrate
      //   - 含 timeframe scope 时本 onBar 内调 buildTimeframeBarStatus 注入 ctx.timeframeBarStatus
      //   - 0 个 timeframe scope 时 helper 返回 undefined，runtime 自动跳过 alignment 检查
      const orchestrationScopes = ((projection as {
        orchestrationScopes?: Parameters<typeof runDecisionPrograms>[7]
      }).orchestrationScopes ?? []) as Parameters<typeof runDecisionPrograms>[7]
      // Phase 5 S11 (#1112): scope.leg substrate（与 S2 同形）
      //   - 单/0 leg 时为空数组，runDecisionPrograms 走兜底（'continue'）
      //   - 多 leg 时由上游 caller 设置 ctx.activeLegScopeId 完成 fan-out
      //   - leg fan-out caller 循环留 follow-up（与 S2 一致）
      const orchestrationLegScopes = ((projection as {
        orchestrationLegScopes?: Parameters<typeof runDecisionPrograms>[8]
      }).orchestrationLegScopes ?? []) as Parameters<typeof runDecisionPrograms>[8]
      const hasTimeframeScopeInProjection = (orchestrationScopes ?? []).some(
        (s) => s.scopeKind === 'timeframe',
      )

      // peakEquity 在 build() 闭包内逐 bar 维护，与 account-strategy-view.service.ts:1970 同公式
      let peakEquity: number | undefined

      // Phase 5 S0a: program lifecycle 跨 K 线状态（按 symbol 分桶）。
      // 闭包持久；同一 backtest 跑结束后随 adapter 一起被回收（无需显式 cleanup）。
      // S0a fixed_grid_gated 仅写 placeholder；S5/S6 在此 map 上维护 dynamic_grid / adaptive_volatility_grid 实状态。
      const programLifecycleStateBySymbol = new Map<string, Record<string, ProgramLifecycleState>>()

      return {
        protocolVersion: 'v1',
        onBar(ctx) {
          // accountDrawdownPct = max(0, (peak-curr)/peak*100)
          // 与 account-strategy-view.service.ts:1970 computeMaxDrawdownPct 同公式
          // live signal 侧 drawdown 上报由 follow-up issue #1058 接入；本 PR 仅 backtest 注入
          const currentEquity = readContextEquity(ctx)
          if (typeof currentEquity === 'number' && Number.isFinite(currentEquity)) {
            peakEquity = peakEquity === undefined ? currentEquity : Math.max(peakEquity, currentEquity)
            if (peakEquity > 0) {
              ;(ctx as { accountDrawdownPct?: number }).accountDrawdownPct
                = Math.max(0, ((peakEquity - currentEquity) / peakEquity) * 100)
            }
          }

          // Phase 5 S3 (#1109): 含 timeframe scope 时注入 ctx.timeframeBarStatus
          //   helper 自动从 ctx.data?.[legId]?.[tf]?.bars 派生；缺数据 tf 不写入 → runtime required_missing
          if (hasTimeframeScopeInProjection) {
            const tfBarStatus = buildTimeframeBarStatus(ctx, orchestrationScopes ?? [])
            if (tfBarStatus !== undefined) {
              ;(ctx as { timeframeBarStatus?: Record<string, { lastClosedBarTs: number; lastClosedBarIndex: number }> }).timeframeBarStatus = tfBarStatus
            }
          }

          const exprValues = evaluateExprPool(
            ctx,
            exprPool,
            projection.topology.exprOrder,
            executionModel,
          )
          const baseGuardState = evaluateGuards(
            ctx,
            guards,
            exprValues,
            projection.topology.guardOrder,
          )
          const guardState = evaluateRiskPredicates(
            ctx,
            riskPredicates,
            baseGuardState,
            projection.topology.riskPredicateOrder,
          )
          const orchestrationGateState = evaluateOrchestrationGates(
            (projection as { orchestrationGates?: Parameters<typeof evaluateOrchestrationGates>[0] }).orchestrationGates ?? [],
            exprValues,
          )
          // Phase 5 S8 (#1119): inject accountEquity + exposure maps into portfolioRisk evaluator
          //   exposure formula: |qty| * markPrice (markPrice = ctx.markPrice ?? ctx.bar.close ?? ctx.currentPrice)
          //   single-position model: map active symbol scope id → notional exposure
          const accountEquityForRisk = readContextEquity(ctx)
          const exposureNotionalBySymbolScope = buildExposureNotionalBySymbolScope(ctx, orchestrationScopes)
          const exposureNotionalBySubStrategyScope = buildExposureNotionalBySubStrategyScope(ctx, orchestrationScopes)
          const portfolioRiskState = evaluateOrchestrationPortfolioRisks(
            portfolioRisks,
            {
              drawdownPct: (ctx as { accountDrawdownPct?: number }).accountDrawdownPct,
              accountEquity: accountEquityForRisk,
              exposureNotionalBySymbolScope,
              exposureNotionalBySubStrategyScope,
            },
          )
          // Phase 5 S2 follow-up (#1108): scope.symbol fan-out caller — 多 scope 时循环每个 scope
          //   per-scope ctx 克隆由 buildScopeIteration 构造（activeSymbolScopeId + symbol + 可选 position）
          //   单/0 scope 透传，旧策略字节兼容；多 scope 时 decision.meta.scopeDecisions 携带 per-scope 副本
          let decision = runDecisionProgramsFanOut(
            ctx,
            decisionPrograms,
            exprValues,
            guardState,
            projection.topology.decisionOrder,
            orchestrationGateState,
            portfolioRiskState,
            orchestrationScopes,
            orchestrationLegScopes,
          )
          // Phase 5 S0a: 取本 symbol 上一根 K 线的 lifecycle state，传入 runOrderPrograms 第 8 参。
          const symbolKey = readContextSymbol(ctx)
          const lifecycleStateForCurrentBar = symbolKey
            ? programLifecycleStateBySymbol.get(symbolKey)
            : undefined
          const orderState = runOrderPrograms(
            ctx,
            orderPrograms,
            exprValues,
            guardState,
            projection.topology.orderProgramOrder,
            executionModel,
            orchestrationPrograms,
            lifecycleStateForCurrentBar,
          )
          // 回写 next state 到 map，供下一根 K 线使用。
          // 直接持有 runtime 返回的 frozen 引用，保 freeze 不变量端到端贯通
          // （runtime 已对该对象顶层 Object.freeze）。
          if (symbolKey) {
            programLifecycleStateBySymbol.set(
              symbolKey,
              orderState.programLifecycleStateNext,
            )
          }

          // T12 M2: 仅当 decision=NOOP + orchestration program 进入 close 阶段 + 当前持仓非 0
          // 时合成 CLOSE_*；OPEN_*/CLOSE_*/REDUCE_* 一律不动（W5 不变量保护）。
          // closeProgramIds 不污染 manifest（仅 decision.meta 携带）。
          if (
            orderState.closeProgramIds.length > 0
            && decision.action === 'NOOP'
          ) {
            const currentPositionQty = readContextPositionQty(ctx)
            if (currentPositionQty !== 0) {
              decision = synthesizeCloseDecision(currentPositionQty, orderState.closeProgramIds)
            }
          }

          return buildCompiledManifest(
            decision,
            orderState,
            guardState,
            projection.compiledManifest,
          )
        },
      }
    }
    catch (error) {
      if (this.isCompilerV1CompiledScript(scriptCode)) {
        this.raiseCompiledStrategyInvalid(error)
      }
      return null
    }
  }

  private isCompilerV1CompiledScript(scriptCode: string): boolean {
    return scriptCode.startsWith('/* @generated by compiler.v1 */')
  }

  private raiseCompiledStrategyInvalid(error: unknown): never {
    throw new DomainException('backtest.compiled_strategy_invalid', {
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      args: {
        reason: error instanceof Error ? error.message : 'unknown',
      },
    })
  }

  private async executeAdapter(scriptCode: string): Promise<unknown> {
    const engine = createScriptEngine()
    let result = await engine.execute(scriptCode, {
      context: {},
      timeout: 5000,
      allowAsync: false,
    })

    const errorMessage = result.error?.message ?? ''
    if (!result.success && errorMessage.includes('Illegal return statement')) {
      result = await engine.execute(`(() => { ${scriptCode} })()`, {
        context: {},
        timeout: 5000,
        allowAsync: true,
      })
    }

    if (!result.success) {
      throw new DomainException('backtest.strategy_execute_failed', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { error: result.error?.message ?? 'script execute failed' },
      })
    }

    return result.value
  }
}

function readContextPositionQty(ctx: unknown): number {
  if (!ctx || typeof ctx !== 'object') return 0
  const c = ctx as { position?: { qty?: unknown } }
  const qty = c.position?.qty
  return typeof qty === 'number' && Number.isFinite(qty) ? qty : 0
}

function readContextSymbol(ctx: unknown): string | undefined {
  if (!ctx || typeof ctx !== 'object') return undefined
  const c = ctx as { symbol?: unknown }
  return typeof c.symbol === 'string' && c.symbol.length > 0 ? c.symbol : undefined
}

function synthesizeCloseDecision(
  qty: number,
  closeProgramIds: readonly string[],
): StrategyDecisionV1 {
  if (qty > 0) {
    return {
      action: 'CLOSE_LONG',
      reason: 'compiled.orchestration.program.close_position',
      meta: { closeProgramIds: [...closeProgramIds] },
    }
  }
  if (qty < 0) {
    return {
      action: 'CLOSE_SHORT',
      reason: 'compiled.orchestration.program.close_position',
      meta: { closeProgramIds: [...closeProgramIds] },
    }
  }
  return {
    action: 'NOOP',
    reason: 'compiled.orchestration.program.no_position_to_close',
  }
}

function readContextEquity(ctx: unknown): number | undefined {
  if (!ctx || typeof ctx !== 'object') return undefined
  const c = ctx as { accountEquity?: unknown, portfolio?: { equity?: unknown } }
  if (typeof c.accountEquity === 'number' && Number.isFinite(c.accountEquity)) {
    return c.accountEquity
  }
  if (c.portfolio && typeof c.portfolio === 'object') {
    const equity = c.portfolio.equity
    if (typeof equity === 'number' && Number.isFinite(equity)) return equity
  }
  return undefined
}

/**
 * Phase 5 S8 (#1119): 按 scope.symbol scope id 聚合名义敞口（|qty| * markPrice）
 *
 * **substrate 边界（critic Round 1 M1 标注）**：本 adapter 当前为**单 position 模型** —
 *   仅读 ctx.position.qty 投到单个 targetScopeId（activeSymbolScopeId 或 symbolScopes[0]）。
 *   多 leg fan-out caller 由 follow-up（#984 multi-leg + #1120 live exposure feed）接入。
 *   evaluator `exposureNotionalBySymbolScope` map 接口已支持 caller 端预聚合（|qty| 之和不抵消），
 *   只是 backtest adapter 现阶段不主动 fan-out leg 维度。
 *
 *   markPrice = ctx.markPrice ?? ctx.bar?.close ?? ctx.currentPrice
 *   单 symbol scope（或 0 scope）时 activeSymbolScopeId 对应单个 scope，将 ctx.position 全部聚合到该 scope
 *   多 scope 时仅映射 activeSymbolScopeId，其余 scope 敞口上报留 follow-up
 */
function buildExposureNotionalBySymbolScope(
  ctx: unknown,
  scopes: unknown,
): Record<string, number> | undefined {
  if (!ctx || typeof ctx !== 'object') return undefined
  const c = ctx as Record<string, unknown>
  const markPrice = typeof c['markPrice'] === 'number' && Number.isFinite(c['markPrice'])
    ? c['markPrice']
    : typeof (c['bar'] as Record<string, unknown> | undefined)?.['close'] === 'number'
      ? (c['bar'] as Record<string, unknown>)['close'] as number
      : typeof c['currentPrice'] === 'number' && Number.isFinite(c['currentPrice'])
        ? c['currentPrice'] as number
        : undefined
  if (markPrice === undefined || markPrice <= 0) return undefined

  const pos = c['position'] as Record<string, unknown> | undefined
  const qty = typeof pos?.['qty'] === 'number' ? Math.abs(pos['qty'] as number) : 0
  const notional = qty * markPrice

  // Determine active symbol scope ref
  const scopesArr = Array.isArray(scopes) ? scopes : []
  const symbolScopes = scopesArr.filter(
    (s: Record<string, unknown>) => s['scopeKind'] === 'symbol',
  )
  if (symbolScopes.length === 0) return undefined

  const activeId = typeof c['activeSymbolScopeId'] === 'string' ? c['activeSymbolScopeId'].trim() : ''
  const targetScopeId = activeId !== ''
    ? activeId
    : (typeof (symbolScopes[0] as Record<string, unknown>)['id'] === 'string'
        ? (symbolScopes[0] as Record<string, unknown>)['id'] as string
        : '')
  if (targetScopeId === '') return undefined

  return { [targetScopeId]: notional }
}

/**
 * Phase 5 S8 (#1119): 按 scope.subStrategy scope id 聚合名义敞口
 *
 * **substrate 边界（critic Round 1 M1 标注）**：与 buildExposureNotionalBySymbolScope 同形 —
 *   单 position 模型，仅映射 activeSubStrategyScopeId → notional；
 *   多 leg fan-out caller 由 follow-up（#984 multi-leg + #1120 live exposure feed）接入。
 *   evaluator `exposureNotionalBySubStrategyScope` map 接口支持 caller 端预聚合。
 *
 *   单 subStrategy scope（或 0 scope）时映射 activeSubStrategyScopeId → notional
 */
function buildExposureNotionalBySubStrategyScope(
  ctx: unknown,
  scopes: unknown,
): Record<string, number> | undefined {
  if (!ctx || typeof ctx !== 'object') return undefined
  const c = ctx as Record<string, unknown>
  const markPrice = typeof c['markPrice'] === 'number' && Number.isFinite(c['markPrice'])
    ? c['markPrice']
    : typeof (c['bar'] as Record<string, unknown> | undefined)?.['close'] === 'number'
      ? (c['bar'] as Record<string, unknown>)['close'] as number
      : typeof c['currentPrice'] === 'number' && Number.isFinite(c['currentPrice'])
        ? c['currentPrice'] as number
        : undefined
  if (markPrice === undefined || markPrice <= 0) return undefined

  const pos = c['position'] as Record<string, unknown> | undefined
  const qty = typeof pos?.['qty'] === 'number' ? Math.abs(pos['qty'] as number) : 0
  const notional = qty * markPrice

  const scopesArr = Array.isArray(scopes) ? scopes : []
  const subScopes = scopesArr.filter(
    (s: Record<string, unknown>) => s['scopeKind'] === 'subStrategy',
  )
  if (subScopes.length === 0) return undefined

  const activeId = typeof c['activeSubStrategyScopeId'] === 'string'
    ? c['activeSubStrategyScopeId'].trim()
    : ''
  const targetScopeId = activeId !== ''
    ? activeId
    : (typeof (subScopes[0] as Record<string, unknown>)['id'] === 'string'
        ? (subScopes[0] as Record<string, unknown>)['id'] as string
        : '')
  if (targetScopeId === '') return undefined

  return { [targetScopeId]: notional }
}
