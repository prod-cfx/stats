import type { StrategyAdapterV1, StrategyDecisionV1 } from '@ai/shared'
import type { BacktestRunInput } from '../types/backtesting.types'
import { ErrorCode } from '@ai/shared'
import { createScriptEngine } from '@ai/shared/node'
import {
  buildCompiledManifest,
  evaluateExprPool,
  evaluateGuards,
  evaluateRiskPredicates,
  runDecisionPrograms,
  runOrderPrograms,
} from '@ai/shared/script-engine/compiled-runtime'
import { evaluateOrchestrationGates } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates'
import { evaluateOrchestrationPortfolioRisks } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks'
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

      // peakEquity 在 build() 闭包内逐 bar 维护，与 account-strategy-view.service.ts:1970 同公式
      let peakEquity: number | undefined

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
          const portfolioRiskState = evaluateOrchestrationPortfolioRisks(
            portfolioRisks,
            { drawdownPct: (ctx as { accountDrawdownPct?: number }).accountDrawdownPct },
          )
          let decision = runDecisionPrograms(
            ctx,
            decisionPrograms,
            exprValues,
            guardState,
            projection.topology.decisionOrder,
            orchestrationGateState,
            portfolioRiskState,
          )
          const orderState = runOrderPrograms(
            ctx,
            orderPrograms,
            exprValues,
            guardState,
            projection.topology.orderProgramOrder,
            executionModel,
            orchestrationPrograms,
          )

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
