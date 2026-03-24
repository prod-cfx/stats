import type { BacktestRunInput } from '../types/backtesting.types'
import { ErrorCode } from '@ai/shared'
import { createScriptEngine } from '@ai/shared/node'
import { HttpStatus, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
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
  async build(input: BacktestProtocolScriptInput): Promise<BacktestRunInput['strategy']> {
    if (input.protocolVersion !== 'v1') {
      throw new DomainException('backtest.strategy_protocol_invalid', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { protocolVersion: input.protocolVersion },
      })
    }

    const normalizedScript = typeof input.scriptCode === 'string' ? input.scriptCode.trim() : ''
    if (!normalizedScript) {
      throw new DomainException('backtest.strategy_script_invalid', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    const compiled = compileStrategyScriptForVm(normalizedScript)
    if (!compiled.ok) {
      throw new DomainException('backtest.strategy_compile_failed', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { error: compiled.error ?? 'unknown compile error' },
      })
    }

    const adapter = await this.executeAdapter(compiled.executableCode)
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
