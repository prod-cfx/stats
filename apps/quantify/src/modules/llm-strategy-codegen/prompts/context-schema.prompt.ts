import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import ts from 'typescript'
import { DomainException } from '@/common/exceptions/domain.exception'

let cachedPrompt: string | null = null

const FALLBACK_CONTEXT_SCHEMA_BLOCK = [
  'interface Bar {',
  '  open: number',
  '  high: number',
  '  low: number',
  '  close: number',
  '  volume: number',
  '  timestamp: number',
  '}',
  'interface StrategyParamsNormalized {',
  '  riskPct: number | null',
  '  positionPct: number | null',
  '  stopLossPct: number | null',
  '  takeProfitPct: number | null',
  '  maxDrawdownPct: number | null',
  '  leverage: number | null',
  '  allowShort: boolean | null',
  '}',
  'interface LegTimeframeData {',
  '  bars: Bar[]',
  '  indicators: Record<string, number>',
  '  currentPrice: number',
  '}',
  'interface StrategyContext {',
  '  bars: Bar[]',
  '  symbol: string',
  '  timeframe: string',
  '  indicators: Record<string, number>',
  '  currentPrice?: number',
  '  timestamp?: number',
  '  params?: Record<string, unknown> | null',
  '  paramsNormalized?: StrategyParamsNormalized',
  '}',
  'interface MultiLegStrategyContext {',
  '  data: Record<string, Record<string, LegTimeframeData>>',
  '  execution: { timeframe: string; cooldownMinutes?: number }',
  "  legs: Array<{ id: string; symbol: string; role: 'primary' | 'hedge' | 'context'; description?: string }>",
  '  dataRequirements: Record<string, string[]>',
  '  timestamp: number',
  '  params?: Record<string, unknown> | null',
  '  paramsNormalized?: StrategyParamsNormalized',
  '  bars?: Bar[]',
  '  symbol?: string',
  '  timeframe?: string',
  '  indicators?: Record<string, number>',
  '  currentPrice?: number',
  '}',
].join('\n')

function resolveSharedHelpersTypesFile(): string {
  const requireFromHere = createRequire(__filename)
  const helpersRuntimeEntry = requireFromHere.resolve('@ai/shared/script-engine/helpers')
  const runtimeDir = path.dirname(helpersRuntimeEntry)
  const candidates = [
    path.join(runtimeDir, 'helpers.types.d.ts'),
    path.join(runtimeDir, 'helpers.types.ts'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  const workspaceFallback = path.resolve(
    __dirname,
    '../../../../../../packages/shared/src/script-engine/helpers/helpers.types.ts',
  )
  if (existsSync(workspaceFallback)) return workspaceFallback

  throw new DomainException('codegen.cannot_resolve_helpers_type_declarations', {
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  })
}

function resolveSharedBarTypesFile(): string {
  const requireFromHere = createRequire(__filename)
  const helpersRuntimeEntry = requireFromHere.resolve('@ai/shared/script-engine/helpers')
  const runtimeDir = path.dirname(helpersRuntimeEntry)
  const candidates = [
    path.join(runtimeDir, 'technical-indicators.d.ts'),
    path.join(runtimeDir, 'technical-indicators.ts'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  const workspaceFallback = path.resolve(
    __dirname,
    '../../../../../../packages/shared/src/script-engine/helpers/technical-indicators.ts',
  )
  if (existsSync(workspaceFallback)) return workspaceFallback

  throw new DomainException('codegen.cannot_resolve_bar_type_declarations', {
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  })
}

function readSourceFile(filePath: string): ts.SourceFile {
  const sourceText = readFileSync(filePath, 'utf8')
  return ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS)
}

function extractDeclaration(sourceFile: ts.SourceFile, name: string): string {
  for (const stmt of sourceFile.statements) {
    if ((ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt)) && stmt.name.text === name) {
      const raw = sourceFile.text.slice(stmt.getFullStart(), stmt.getEnd())
      return raw.trim().replace(/^export\s+/, '')
    }
  }
  throw new DomainException('codegen.missing_type_declaration', {
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    args: { name, fileName: sourceFile.fileName },
  })
}

export function buildContextSchemaPrompt(): string {
  if (cachedPrompt) return cachedPrompt

  let schemaBlock = ''
  try {
    const helpersSource = readSourceFile(resolveSharedHelpersTypesFile())
    const barSource = readSourceFile(resolveSharedBarTypesFile())
    const barDeclaration = extractDeclaration(barSource, 'Bar')
    const declarations = [
      extractDeclaration(helpersSource, 'StrategyParamsNormalized'),
      extractDeclaration(helpersSource, 'LegTimeframeData'),
      extractDeclaration(helpersSource, 'StrategyContext'),
      extractDeclaration(helpersSource, 'MultiLegStrategyContext'),
    ]
    schemaBlock = [barDeclaration, ...declarations].join('\n')
  } catch {
    schemaBlock = FALLBACK_CONTEXT_SCHEMA_BLOCK
  }

  cachedPrompt = [
    '// 以下 ctx 协议由 @ai/shared 类型定义自动生成',
    schemaBlock,
    '',
    '// 使用规则',
    '1) 你的 onBar 入参是 ctx（可视为 StrategyContext & MultiLegStrategyContext 的运行时联合）。',
    '2) 参数优先使用 ctx.paramsNormalized，不要臆造参数字段。',
    '3) 多腿模式优先使用 ctx.data / ctx.execution / ctx.legs / ctx.dataRequirements。',
    '4) 访问字段前先判空，不要假设任何字段一定存在。',
    '5) 不要访问未声明字段，不要使用外部 I/O（网络/文件/进程）。',
  ].join('\n')

  return cachedPrompt
}
