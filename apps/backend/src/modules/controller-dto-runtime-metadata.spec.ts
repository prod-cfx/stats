import * as fs from 'node:fs'
import * as path from 'node:path'
import * as ts from 'typescript'
import { ArgumentMetadata, ValidationPipe } from '@nestjs/common'
import { AdminRoleController } from './admin/controllers/admin-role.controller'
import { AdminRoleListQueryDto } from './admin/dto/admin-role-list.dto'
import { AdminUserController } from './admin/controllers/admin-user.controller'
import { AdminUserListQueryDto } from './admin/dto/admin-user-list.dto'
import { LlmStrategyInstancesController } from './ai-quant-proxy/llm-strategy-instances.controller'
import { LlmStrategyInstanceListQueryDto } from './ai-quant-proxy/dto/llm-strategy-instance-list-query.dto'
import { LlmStrategyInstanceSignalsQueryDto } from './ai-quant-proxy/dto/llm-strategy-instance-signals-query.dto'
import { LlmStrategySubscriptionsController } from './ai-quant-proxy/llm-strategy-subscriptions.controller'
import { LlmSubscriptionCreateRequestDto } from './ai-quant-proxy/dto/llm-subscription-create.request.dto'
import { LlmSubscriptionListQueryDto } from './ai-quant-proxy/dto/llm-subscription-list-query.dto'
import { LlmSubscriptionUpdateRequestDto } from './ai-quant-proxy/dto/llm-subscription-update.request.dto'

describe('controller request DTO runtime metadata', () => {
  const cases = [
    {
      controller: LlmStrategySubscriptionsController,
      method: 'create',
      paramIndex: 1,
      expectedType: LlmSubscriptionCreateRequestDto,
    },
    {
      controller: LlmStrategySubscriptionsController,
      method: 'list',
      paramIndex: 1,
      expectedType: LlmSubscriptionListQueryDto,
    },
    {
      controller: LlmStrategySubscriptionsController,
      method: 'update',
      paramIndex: 2,
      expectedType: LlmSubscriptionUpdateRequestDto,
    },
    {
      controller: LlmStrategyInstancesController,
      method: 'list',
      paramIndex: 1,
      expectedType: LlmStrategyInstanceListQueryDto,
    },
    {
      controller: LlmStrategyInstancesController,
      method: 'signals',
      paramIndex: 2,
      expectedType: LlmStrategyInstanceSignalsQueryDto,
    },
    {
      controller: AdminUserController,
      method: 'list',
      paramIndex: 0,
      expectedType: AdminUserListQueryDto,
    },
    {
      controller: AdminRoleController,
      method: 'list',
      paramIndex: 0,
      expectedType: AdminRoleListQueryDto,
    },
  ] as const

  it.each(cases)('$controller.name.$method keeps request DTO as runtime design:paramtypes metadata', ({ controller, method, paramIndex, expectedType }) => {
    const paramTypes = Reflect.getMetadata('design:paramtypes', controller.prototype, method) as unknown[] | undefined

    expect(paramTypes?.[paramIndex]).toBe(expectedType)
  })

  it('does not use type-only imports for DTOs bound by @Body() or @Query()', () => {
    const violations = findTypeOnlyRequestDtoViolations(__dirname)

    expect(violations).toEqual([])
  })

  it.each([
    LlmSubscriptionListQueryDto,
    LlmStrategyInstanceListQueryDto,
    LlmStrategyInstanceSignalsQueryDto,
    AdminUserListQueryDto,
    AdminRoleListQueryDto,
  ])('%p converts inherited pagination query fields through ValidationPipe', async (metatype) => {
    await expect(transformQuery(metatype, { page: '2', limit: '5' })).resolves.toMatchObject({
      page: 2,
      limit: 5,
    })
  })

  it('rejects invalid subscription create body when runtime DTO metadata is present', async () => {
    await expect(transformBody(LlmSubscriptionCreateRequestDto, {
      llmStrategyInstanceId: '',
      exchangeAccountId: '',
    })).rejects.toThrow()
  })
})

type DtoConstructor = new () => object

const validationPipe = new ValidationPipe({
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
})

function transformQuery(metatype: DtoConstructor, value: Record<string, unknown>) {
  return validationPipe.transform(value, {
    type: 'query',
    metatype,
    data: '',
  } satisfies ArgumentMetadata)
}

function transformBody(metatype: DtoConstructor, value: Record<string, unknown>) {
  return validationPipe.transform(value, {
    type: 'body',
    metatype,
    data: '',
  } satisfies ArgumentMetadata)
}

function findTypeOnlyRequestDtoViolations(dir: string): string[] {
  const violations: string[] = []

  for (const filePath of listControllerFiles(dir)) {
    const sourceText = fs.readFileSync(filePath, 'utf8')
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const typeOnlyImports = collectTypeOnlyImports(sourceFile)

    if (typeOnlyImports.size === 0) {
      continue
    }

    const relativePath = path.relative(__dirname, filePath)
    visit(sourceFile, (node) => {
      if (!ts.isMethodDeclaration(node)) {
        return
      }

      const methodName = node.name.getText(sourceFile)
      for (const parameter of node.parameters) {
        if (!hasDecoratorCall(parameter, ['Body', 'Query'])) {
          continue
        }
        const typeName = getParameterTypeName(parameter)
        if (typeName && typeOnlyImports.has(typeName)) {
          violations.push(`${relativePath}:${methodName}:${typeName}`)
        }
      }
    })
  }

  return violations.sort()
}

function listControllerFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return listControllerFiles(entryPath)
    }
    return entry.isFile() && entry.name.endsWith('controller.ts') ? [entryPath] : []
  })
}

function collectTypeOnlyImports(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>()

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) {
      continue
    }

    const importClause = statement.importClause
    const namedBindings = importClause.namedBindings
    if (!namedBindings || !ts.isNamedImports(namedBindings)) {
      continue
    }

    for (const element of namedBindings.elements) {
      if (importClause.isTypeOnly || element.isTypeOnly) {
        names.add(element.name.text)
      }
    }
  }

  return names
}

function visit(node: ts.Node, callback: (node: ts.Node) => void): void {
  callback(node)
  ts.forEachChild(node, child => visit(child, callback))
}

function hasDecoratorCall(node: ts.Node, decoratorNames: string[]): boolean {
  if (!ts.canHaveDecorators(node)) {
    return false
  }

  return (ts.getDecorators(node) ?? []).some((decorator) => {
    const expression = decorator.expression
    return ts.isCallExpression(expression)
      && ts.isIdentifier(expression.expression)
      && decoratorNames.includes(expression.expression.text)
  })
}

function getParameterTypeName(parameter: ts.ParameterDeclaration): string | null {
  if (!parameter.type || !ts.isTypeReferenceNode(parameter.type) || !ts.isIdentifier(parameter.type.typeName)) {
    return null
  }

  return parameter.type.typeName.text
}
