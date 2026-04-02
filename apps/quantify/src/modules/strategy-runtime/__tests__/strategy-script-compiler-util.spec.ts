import type { ScriptTarget } from 'typescript'
import { compileStrategyScriptForVm } from '../strategy-script-compiler.util'

type TypeScriptModule = typeof import('typescript')

function loadCompileStrategyScriptForVm() {
  return jest.requireActual<typeof import('../strategy-script-compiler.util')>('../strategy-script-compiler.util')
    .compileStrategyScriptForVm
}

describe('strategyScriptCompilerUtil', () => {
  it('keeps legacy js script unchanged', () => {
    const source = 'return { direction: "BUY" }'
    const compiled = compileStrategyScriptForVm(source)

    expect(compiled.ok).toBe(true)
    expect(compiled.isTypeScript).toBe(false)
    expect(compiled.executableCode).toBe(source)
  })

  it('type-checks and transpiles strategy adapter ts', () => {
    const source = `
const strategy: StrategyAdapterV1 = {
  protocolVersion: "v1",
  onBar(ctx: Record<string, unknown>): StrategyDecisionV1 {
    return {
      action: "NOOP",
      confidence: 80,
      reason: "hold"
    }
  }
}
strategy
`
    const compiled = compileStrategyScriptForVm(source)
    expect(compiled.ok).toBe(true)
    expect(compiled.isTypeScript).toBe(true)
    expect(compiled.executableCode).toContain('const strategy')
  })

  it('fails when adapter protocolVersion is invalid', () => {
    const source = `
const strategy: StrategyAdapterV1 = {
  protocolVersion: "v2",
  onBar(ctx: Record<string, unknown>): StrategyDecisionV1 {
    return { action: "NOOP" }
  }
}
strategy
`
    const compiled = compileStrategyScriptForVm(source)
    expect(compiled.ok).toBe(false)
    expect(compiled.error).toContain('"v2"')
    expect(compiled.error).toContain('"v1"')
  })

  it('falls back to workspace shared source when runtime @ai/shared cannot be resolved', () => {
    const source = `
const strategy: StrategyAdapterV1 = {
  protocolVersion: "v1",
  onBar(ctx: StrategyExecutionContextV1): StrategyDecisionV1 {
    return {
      action: "NOOP",
      confidence: 80,
      reason: ctx.symbol ?? "hold"
    }
  }
}
strategy
`

    jest.resetModules()
    jest.doMock('node:module', () => {
      const actual = jest.requireActual('node:module')
      return {
        ...actual,
        createRequire: () => ({
          resolve: () => {
            throw new Error("Cannot find module '@ai/shared'")
          },
        }),
      }
    })

    let compileWithFallback!: typeof compileStrategyScriptForVm
    jest.isolateModules(() => {
      compileWithFallback = loadCompileStrategyScriptForVm()
    })

    expect(() => compileWithFallback(source)).not.toThrow()

    const compiled = compileWithFallback(source)
    expect(compiled.ok).toBe(true)
    expect(compiled.isTypeScript).toBe(true)

    jest.dontMock('node:module')
    jest.resetModules()
  })

  it('uses inline fallback declarations when artifact lacks shared type files', () => {
    const source = `
const strategy: StrategyAdapterV1 = {
  protocolVersion: "v1",
  onBar(ctx: StrategyExecutionContextV1): StrategyDecisionV1 {
    return {
      action: "NOOP",
      confidence: 80,
      reason: ctx.symbol ?? "hold"
    }
  }
}
strategy
`

    jest.resetModules()
    jest.doMock('node:module', () => {
      const actual = jest.requireActual('node:module')
      return {
        ...actual,
        createRequire: () => ({
          resolve: () => {
            throw new Error("Cannot find module '@ai/shared'")
          },
        }),
      }
    })
    jest.doMock('node:fs', () => {
      const actual = jest.requireActual('node:fs')
      return {
        ...actual,
        existsSync: (target: string) => {
          if (target.includes('/packages/shared/')) {
            return false
          }
          return actual.existsSync(target)
        },
      }
    })
    jest.doMock('typescript', () => {
      const actual = jest.requireActual('typescript')
      return {
        ...actual,
        createCompilerHost: (...args: Parameters<TypeScriptModule['createCompilerHost']>) => {
          const host = actual.createCompilerHost(...args)
          return {
            ...host,
            getSourceFile: (name: string, languageVersion: ScriptTarget, onError?: (message: string) => void, shouldCreateNewSourceFile?: boolean) => {
              if (name.includes('/packages/shared/')) {
                return undefined
              }
              return host.getSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile)
            },
            readFile: (name: string) => {
              if (name.includes('/packages/shared/')) {
                return undefined
              }
              return host.readFile(name)
            },
            fileExists: (name: string) => {
              if (name.includes('/packages/shared/')) {
                return false
              }
              return host.fileExists(name)
            },
          }
        },
      }
    })

    let compileWithFallback!: typeof compileStrategyScriptForVm
    jest.isolateModules(() => {
      compileWithFallback = loadCompileStrategyScriptForVm()
    })

    const compiled = compileWithFallback(source)
    expect(compiled.ok).toBe(true)
    expect(compiled.error).toBeUndefined()

    jest.dontMock('typescript')
    jest.dontMock('node:fs')
    jest.dontMock('node:module')
    jest.resetModules()
  })

  it('accepts generated RSI strategy under inline fallback declarations in artifact mode', () => {
    const source = `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx) {
    const bars = ctx.bars;
    if (!bars || bars.length < 15) {
      return { action: 'NOOP', reason: 'Insufficient data' };
    }

    const currentPrice = ctx.currentPrice;
    if (currentPrice === undefined) {
      return { action: 'NOOP', reason: 'No current price' };
    }

    const closes = bars.map(bar => bar.close);
    const rsiValue = helpers.ta.rsi(closes, 14);
    if (rsiValue === null) {
      return { action: 'NOOP', reason: 'RSI calculation failed' };
    }

    const params = ctx.paramsNormalized;
    const positionPct = params?.positionPct ?? 10;
    const maxDrawdownPct = params?.maxDrawdownPct ?? 20;

    const entryPrice = (ctx as any)._entryPrice as number | undefined;
    const positionDirection = (ctx as any)._positionDirection as 'LONG' | 'SHORT' | undefined;

    const isLongEntry = helpers.signal.isOversold(rsiValue, 30);
    const isLongExitOverbought = helpers.signal.isOverbought(rsiValue, 70);

    if (!positionDirection) {
      if (isLongEntry) {
        const sizeValue = Math.min(positionPct, 100 - (maxDrawdownPct || 0));
        const stopLossPrice = currentPrice * (1 - 0.02);
        const takeProfitPrice = currentPrice * (1 + 0.04);
        (ctx as any)._entryPrice = currentPrice;
        (ctx as any)._positionDirection = 'LONG';
        (ctx as any)._stopLossPrice = stopLossPrice;
        (ctx as any)._takeProfitPrice = takeProfitPrice;

        return {
          action: 'OPEN_LONG',
          size: { mode: 'RATIO', value: sizeValue },
          confidence: 75,
          reason: \`RSI(\${rsiValue.toFixed(2)}) below 30, long entry\`,
          risk: {
            stopLoss: stopLossPrice,
            takeProfit: takeProfitPrice,
            maxDrawdown: maxDrawdownPct
          }
        };
      }
      return { action: 'NOOP', reason: 'Waiting for oversold RSI entry signal' };
    }

    if (positionDirection === 'LONG' && entryPrice !== undefined) {
      const stopLossPrice = (ctx as any)._stopLossPrice as number | undefined;
      const takeProfitPrice = (ctx as any)._takeProfitPrice as number | undefined;

      let exitSignal = false;
      let exitReason = '';

      if (isLongExitOverbought) {
        exitSignal = true;
        exitReason = \`RSI(\${rsiValue.toFixed(2)}) above 70, exit\`;
      } else if (stopLossPrice !== undefined && currentPrice <= stopLossPrice) {
        exitSignal = true;
        exitReason = \`Price (\${currentPrice}) hit stop loss (\${stopLossPrice}), exit\`;
      } else if (takeProfitPrice !== undefined && currentPrice >= takeProfitPrice) {
        exitSignal = true;
        exitReason = \`Price (\${currentPrice}) hit take profit (\${takeProfitPrice}), exit\`;
      }

      if (exitSignal) {
        (ctx as any)._entryPrice = undefined;
        (ctx as any)._positionDirection = undefined;
        (ctx as any)._stopLossPrice = undefined;
        (ctx as any)._takeProfitPrice = undefined;
        return {
          action: 'CLOSE_LONG',
          size: { mode: 'RATIO', value: 100 },
          confidence: 80,
          reason: exitReason
        };
      }
      return { action: 'NOOP', reason: 'Holding long position, no exit signal' };
    }

    return { action: 'NOOP', reason: 'No actionable signal' };
  }
};

strategy
`

    jest.resetModules()
    jest.doMock('node:module', () => {
      const actual = jest.requireActual('node:module')
      return {
        ...actual,
        createRequire: () => ({
          resolve: () => {
            throw new Error("Cannot find module '@ai/shared'")
          },
        }),
      }
    })
    jest.doMock('node:fs', () => {
      const actual = jest.requireActual('node:fs')
      return {
        ...actual,
        existsSync: (target: string) => {
          if (target.includes('/packages/shared/')) {
            return false
          }
          return actual.existsSync(target)
        },
      }
    })
    jest.doMock('typescript', () => {
      const actual = jest.requireActual('typescript')
      return {
        ...actual,
        createCompilerHost: (...args: Parameters<TypeScriptModule['createCompilerHost']>) => {
          const host = actual.createCompilerHost(...args)
          return {
            ...host,
            getSourceFile: (name: string, languageVersion: ScriptTarget, onError?: (message: string) => void, shouldCreateNewSourceFile?: boolean) => {
              if (name.includes('/packages/shared/')) {
                return undefined
              }
              return host.getSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile)
            },
            readFile: (name: string) => {
              if (name.includes('/packages/shared/')) {
                return undefined
              }
              return host.readFile(name)
            },
            fileExists: (name: string) => {
              if (name.includes('/packages/shared/')) {
                return false
              }
              return host.fileExists(name)
            },
          }
        },
      }
    })

    let compileWithFallback!: typeof compileStrategyScriptForVm
    jest.isolateModules(() => {
      compileWithFallback = loadCompileStrategyScriptForVm()
    })

    const compiled = compileWithFallback(source)
    expect(compiled.ok).toBe(true)
    expect(compiled.error).toBeUndefined()

    jest.dontMock('typescript')
    jest.dontMock('node:fs')
    jest.dontMock('node:module')
    jest.resetModules()
  })
})
