import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import ts from 'typescript'
import { DomainException } from '@/common/exceptions/domain.exception'

let cachedContract: string | null = null

const FALLBACK_STRATEGY_PROTOCOL_DECLARATIONS = [
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
  'interface StrategyExecutionContextV1 extends Record<string, any> {',
  '  timestamp?: number',
  '  paramsNormalized?: Record<string, unknown>',
  '  params?: Record<string, unknown> | null',
  '  symbol?: string',
  '  timeframe?: string',
  '  currentPrice?: number',
  '  indicators?: Record<string, number>',
  '  bars?: Array<Record<string, unknown>>',
  '}',
  'interface StrategyAdapterV1 {',
  "  protocolVersion: 'v1'",
  '  onBar: (ctx: StrategyExecutionContextV1) => StrategyDecisionV1 | Promise<StrategyDecisionV1>',
  '  init?: (ctx: StrategyExecutionContextV1) => unknown',
  '  shutdown?: () => unknown',
  '}',
].join('\n')

function resolveSharedTypeDeclarationFile(): string {
  const requireFromHere = createRequire(__filename)
  try {
    const runtimeEntry = requireFromHere.resolve('@ai/shared')
    const runtimeDir = path.dirname(runtimeEntry)
    const candidates = [
      path.join(runtimeDir, 'strategy-protocol.d.ts'),
      path.join(runtimeDir, 'strategy-protocol.ts'),
      runtimeEntry.replace(/\.js$/, '.d.ts'),
      runtimeEntry,
    ]
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate
    }
  } catch {
    // runtime dependency may be absent in artifact deployment; continue to workspace fallback
  }

  const workspaceFallback = path.resolve(__dirname, '../../../../../../packages/shared/src/strategy-protocol.ts')
  if (existsSync(workspaceFallback)) return workspaceFallback

  throw new DomainException('codegen.cannot_resolve_strategy_protocol_declarations', {
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  })
}

function collectExportedTypeDeclarations(sourceFile: ts.SourceFile): string[] {
  const declarations: string[] = []
  for (const stmt of sourceFile.statements) {
    if (!ts.isTypeAliasDeclaration(stmt) && !ts.isInterfaceDeclaration(stmt)) {
      continue
    }
    const hasExport = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
    if (!hasExport) {
      continue
    }
    const raw = sourceFile.text.slice(stmt.getFullStart(), stmt.getEnd())
    declarations.push(raw.trim().replace(/^export\s+/, ''))
  }
  return declarations
}

export function buildStrategyProtocolTypeContractPrompt(): string {
  if (cachedContract) return cachedContract

  let declarations: string[] = []
  try {
    const declarationFile = resolveSharedTypeDeclarationFile()
    const sourceText = readFileSync(declarationFile, 'utf8')
    const sourceFile = ts.createSourceFile(declarationFile, sourceText, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS)
    declarations = collectExportedTypeDeclarations(sourceFile)
  } catch {
    declarations = []
  }
  if (declarations.length === 0) {
    declarations = [FALLBACK_STRATEGY_PROTOCOL_DECLARATIONS]
  }
  const typeBindingBlock = [
    "type StrategyAdapterV1 = import('@ai/shared').StrategyAdapterV1",
    "type StrategyDecisionV1 = import('@ai/shared').StrategyDecisionV1",
  ].join('\n')

  cachedContract = [
    '// 以下类型由 @ai/shared 的真实 TypeScript 类型定义自动生成',
    '// 澄清时请围绕 open semantic slots 追问，例如 sideScope 与 basis，而不是 checklist 字段。',
    ...declarations,
    '',
    '// 最终必须满足的绑定（编译器按此约束校验）',
    typeBindingBlock,
    '',
    "const strategy: StrategyAdapterV1 = {",
    "  protocolVersion: 'v1',",
    '  onBar(ctx) {',
    '    // 根据 ctx 计算后返回 StrategyDecisionV1',
    "    return { action: 'NOOP' }",
    '  },',
    '}',
    '',
    'strategy',
  ].join('\n')

  return cachedContract
}
