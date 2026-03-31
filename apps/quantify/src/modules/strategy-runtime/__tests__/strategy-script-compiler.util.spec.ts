import ts from 'typescript'
import { compileStrategyScriptForVm } from '../strategy-script-compiler.util'

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
      ({ compileStrategyScriptForVm: compileWithFallback } = require('../strategy-script-compiler.util'))
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
        createCompilerHost: (...args: Parameters<typeof actual.createCompilerHost>) => {
          const host = actual.createCompilerHost(...args)
          return {
            ...host,
            getSourceFile: (name: string, languageVersion: ts.ScriptTarget, onError?: (message: string) => void, shouldCreateNewSourceFile?: boolean) => {
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
      ({ compileStrategyScriptForVm: compileWithFallback } = require('../strategy-script-compiler.util'))
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
