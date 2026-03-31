import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import ts from 'typescript'

export interface StrategyScriptCompileResult {
  ok: boolean
  executableCode: string
  isTypeScript: boolean
  error?: string
}

const FALLBACK_STRATEGY_TYPE_DECLARATIONS = [
  "type StrategyAction = 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT' | 'ADJUST_POSITION' | 'NOOP'",
  "type StrategySizeMode = 'QUOTE' | 'RATIO' | 'QTY'",
  'interface StrategyDecisionSize {',
  '  mode: StrategySizeMode',
  '  value: number',
  '}',
  'interface StrategyDecisionV1 {',
  '  action: StrategyAction',
  '  size?: StrategyDecisionSize',
  "  adjustMode?: 'TARGET' | 'DELTA'",
  '  confidence?: number',
  '  reason?: string',
  '  risk?: {',
  '    stopLoss?: number',
  '    takeProfit?: number',
  '    maxDrawdown?: number',
  '  }',
  '  meta?: Record<string, unknown>',
  '}',
  'interface StrategyExecutionContextV1 extends Record<string, unknown> {',
  '  timestamp?: number',
  '  paramsNormalized?: Record<string, unknown>',
  '  params?: Record<string, unknown> | null',
  '  symbol?: string',
  '  timeframe?: string',
  '  currentPrice?: number',
  '  indicators?: Record<string, number>',
  '  bars?: Array<Record<string, unknown>>',
  '  helpers?: Record<string, unknown>',
  '  execution?: Record<string, unknown>',
  '  legs?: Array<Record<string, unknown>>',
  '  dataRequirements?: Record<string, unknown>',
  '  data?: Record<string, unknown>',
  '}',
  'interface StrategyAdapterV1 {',
  "  protocolVersion: 'v1'",
  '  onBar: (ctx: StrategyExecutionContextV1) => StrategyDecisionV1 | Promise<StrategyDecisionV1>',
  '  init?: (ctx: StrategyExecutionContextV1) => unknown',
  '  shutdown?: () => unknown',
  '}',
].join('\n')

function resolveSharedTypeModuleSpecifier(): string | null {
  const requireFromHere = createRequire(__filename)
  try {
    const runtimeEntry = requireFromHere.resolve('@ai/shared')
    const inferredTypesEntry = runtimeEntry.replace(/\.js$/, '.d.ts')
    if (existsSync(inferredTypesEntry)) {
      return inferredTypesEntry.split(path.sep).join('/')
    }
  } catch {
    // artifact deployment may omit @ai/shared runtime resolution; continue to workspace fallback
  }

  const workspaceCandidates = [
    path.resolve(__dirname, '../../../../../packages/shared/dist/index.d.ts'),
    path.resolve(__dirname, '../../../../../packages/shared/src/index.d.ts'),
    path.resolve(__dirname, '../../../../../packages/shared/src/index.ts'),
  ]
  for (const candidate of workspaceCandidates) {
    if (existsSync(candidate)) {
      return candidate.split(path.sep).join('/')
    }
  }

  return null
}

function buildTypecheckPrelude(): string {
  const specifier = resolveSharedTypeModuleSpecifier()
  const typeDeclarations = specifier
    ? [
        `type StrategyAdapterV1 = import('${specifier}').StrategyAdapterV1`,
        `type StrategyDecisionV1 = import('${specifier}').StrategyDecisionV1`,
        `type StrategyExecutionContextV1 = import('${specifier}').StrategyExecutionContextV1`,
      ]
    : [
        FALLBACK_STRATEGY_TYPE_DECLARATIONS,
      ]
  return [
    ...typeDeclarations,
    'declare const ctx: StrategyExecutionContextV1',
    "declare const helpers: NonNullable<StrategyExecutionContextV1['helpers']>",
    "declare const bars: NonNullable<StrategyExecutionContextV1['bars']>",
    "declare const indicators: NonNullable<StrategyExecutionContextV1['indicators']>",
    "declare const paramsNormalized: NonNullable<StrategyExecutionContextV1['paramsNormalized']>",
    "declare const params: NonNullable<StrategyExecutionContextV1['params']>",
    "declare const currentPrice: NonNullable<StrategyExecutionContextV1['currentPrice']>",
    "declare const symbol: NonNullable<StrategyExecutionContextV1['symbol']>",
    "declare const timeframe: NonNullable<StrategyExecutionContextV1['timeframe']>",
    "declare const execution: NonNullable<StrategyExecutionContextV1['execution']>",
    "declare const legs: NonNullable<StrategyExecutionContextV1['legs']>",
    "declare const dataRequirements: NonNullable<StrategyExecutionContextV1['dataRequirements']>",
    "declare const data: NonNullable<StrategyExecutionContextV1['data']>",
  ].join('\n')
}

function maybeTypeScriptStrategy(source: string): boolean {
  return /protocolVersion\s*:\s*['"]v1['"]/.test(source) || /onBar\s*\(\s*ctx/.test(source)
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  return diagnostics
    .map((diagnostic) => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      if (!diagnostic.file || diagnostic.start === undefined) return message
      const pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
      return `${pos.line + 1}:${pos.character + 1} ${message}`
    })
    .join('; ')
}

function typecheckSourceWithTsc(sourceText: string, fileName = 'strategy.generated.ts'): readonly ts.Diagnostic[] {
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.None,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    strict: true,
    noImplicitAny: true,
    skipLibCheck: true,
  }

  const defaultHost = ts.createCompilerHost(compilerOptions, true)
  const host: ts.CompilerHost = {
    ...defaultHost,
    getSourceFile: (name, languageVersion, onError, shouldCreateNewSourceFile) => {
      if (name === fileName) {
        return ts.createSourceFile(name, sourceText, languageVersion, true)
      }
      return defaultHost.getSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile)
    },
    readFile: (name) => {
      if (name === fileName) {
        return sourceText
      }
      return defaultHost.readFile(name)
    },
    fileExists: (name) => {
      if (name === fileName) {
        return true
      }
      return defaultHost.fileExists(name)
    },
  }

  const program = ts.createProgram([fileName], compilerOptions, host)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  return diagnostics.filter((d) => d.category === ts.DiagnosticCategory.Error)
}

function buildTypecheckCandidates(source: string): string[] {
  const prelude = buildTypecheckPrelude()
  const returnStyle = `${prelude}
const __strategy_eval_return_style__ = (() : StrategyAdapterV1 => {
${source}
})()
void __strategy_eval_return_style__
`

  const variableStyle = `${prelude}
${source}
const __strategy_typecheck_var_style__: StrategyAdapterV1 = strategy
`

  return [returnStyle, variableStyle]
}

export function compileStrategyScriptForVm(source: string): StrategyScriptCompileResult {
  if (!maybeTypeScriptStrategy(source)) {
    return { ok: true, executableCode: source, isTypeScript: false }
  }

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.None,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    strict: true,
    noImplicitAny: true,
  }

  const candidates = buildTypecheckCandidates(source)
  const checkResults = candidates.map((text, index) => ({
    index,
    diagnostics: typecheckSourceWithTsc(text, `strategy.generated.${index}.ts`),
  }))
  const passed = checkResults.some((result) => result.diagnostics.length === 0)
  if (!passed) {
    const mergedErrors = checkResults.flatMap((result) => result.diagnostics)
    return {
      ok: false,
      executableCode: '',
      isTypeScript: true,
      error: formatDiagnostics(mergedErrors),
    }
  }

  const transpileResult = ts.transpileModule(source, {
    compilerOptions,
    reportDiagnostics: true,
    fileName: 'strategy.generated.ts',
  })
  const transpileErrors = (transpileResult.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
  if (transpileErrors.length > 0) {
    return {
      ok: false,
      executableCode: '',
      isTypeScript: true,
      error: formatDiagnostics(transpileErrors),
    }
  }

  return {
    ok: true,
    executableCode: transpileResult.outputText,
    isTypeScript: true,
  }
}
