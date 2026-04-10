import type { StrategyAdapterV1 } from '@ai/shared'
import type { BacktestRunInput } from '../types/backtesting.types'
import { ErrorCode } from '@ai/shared'
import { createScriptEngine } from '@ai/shared/node'
import {
  buildCompiledManifest,
  evaluateExprPool,
  evaluateGuards,
  runDecisionPrograms,
  runOrderPrograms,
} from '@ai/shared/script-engine/compiled-runtime'
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
      const decisionPrograms = projection.decisionPrograms as Parameters<typeof runDecisionPrograms>[1]
      const orderPrograms = projection.orderPrograms as Parameters<typeof runOrderPrograms>[1]

      return {
        protocolVersion: 'v1',
        onBar(ctx) {
          const exprValues = evaluateExprPool(
            ctx,
            exprPool,
            projection.topology.exprOrder,
            executionModel,
          )
          const guardState = evaluateGuards(
            ctx,
            guards,
            exprValues,
            projection.topology.guardOrder,
          )
          const decision = runDecisionPrograms(
            ctx,
            decisionPrograms,
            exprValues,
            guardState,
            projection.topology.decisionOrder,
          )
          const orderState = runOrderPrograms(
            ctx,
            orderPrograms,
            exprValues,
            guardState,
            projection.topology.orderProgramOrder,
            executionModel,
          )

          return buildCompiledManifest(
            decision,
            orderState,
            guardState,
            projection.compiledManifest,
          )
        },
      }
    }
    catch {
      return null
    }
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
