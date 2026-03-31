import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import ts from 'typescript'
import { DomainException } from '@/common/exceptions/domain.exception'

let cachedContract: string | null = null

function resolveSharedTypeDeclarationFile(): string {
  const requireFromHere = createRequire(__filename)
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

  const declarationFile = resolveSharedTypeDeclarationFile()
  const sourceText = readFileSync(declarationFile, 'utf8')
  const sourceFile = ts.createSourceFile(declarationFile, sourceText, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS)
  const declarations = collectExportedTypeDeclarations(sourceFile)
  if (declarations.length === 0) {
    throw new DomainException('codegen.no_exported_type_declarations', {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      args: { declarationFile },
    })
  }
  const typeBindingBlock = [
    "type StrategyAdapterV1 = import('@ai/shared').StrategyAdapterV1",
    "type StrategyDecisionV1 = import('@ai/shared').StrategyDecisionV1",
  ].join('\n')

  cachedContract = [
    '// 以下类型由 @ai/shared 的真实 TypeScript 类型定义自动生成',
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
