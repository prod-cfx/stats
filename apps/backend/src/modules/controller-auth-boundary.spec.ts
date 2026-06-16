import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as ts from 'typescript'

const AUTH_BOUNDARY_DECORATORS = [
  'Auth',
  'OptionalAccessControl',
  'OptionalAuth',
  'Public',
  'RequireAuth',
]

const AUTH_GUARD_IDENTIFIERS = ['ACGuard', 'JwtAuthGuard', 'OptionalJwtAuthGuard']

const ROUTE_DECORATORS = [
  'All',
  'Delete',
  'Get',
  'Head',
  'Options',
  'Patch',
  'Post',
  'Put',
]

describe('backend controller auth boundary', () => {
  it('requires every HTTP controller route to declare auth, optional auth, guarded, or public semantics', () => {
    const violations = findControllerAuthBoundaryViolations(__dirname)

    expect(violations).toEqual([])
  })

  it('does not treat a rate-limit-only guard as an auth boundary', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'controller-auth-boundary-'))
    fs.writeFileSync(
      path.join(tempDir, 'rate-limited.controller.ts'),
      `
import { Controller, Get, UseGuards } from '@nestjs/common'
import { AuthRateLimitGuard } from './auth-rate-limit.guard'

@Controller('probe')
export class RateLimitedController {
  @Get()
  @UseGuards(AuthRateLimitGuard)
  probe() {}
}
`,
    )

    expect(findControllerAuthBoundaryViolations(tempDir)).toEqual([
      'rate-limited.controller.ts:RateLimitedController.probe',
    ])
  })

  it('does not treat SkipThrottle as an auth boundary', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'controller-auth-boundary-'))
    fs.writeFileSync(
      path.join(tempDir, 'skip-throttled.controller.ts'),
      `
import { Controller, Get } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'

@Controller('probe')
export class SkipThrottledController {
  @Get()
  @SkipThrottle()
  probe() {}
}
`,
    )

    expect(findControllerAuthBoundaryViolations(tempDir)).toEqual([
      'skip-throttled.controller.ts:SkipThrottledController.probe',
    ])
  })
})

function findControllerAuthBoundaryViolations(modulesRoot: string): string[] {
  const violations: string[] = []

  for (const filePath of listControllerFiles(modulesRoot)) {
    const sourceText = fs.readFileSync(filePath, 'utf8')
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const relativePath = path.relative(modulesRoot, filePath)

    visit(sourceFile, (node) => {
      if (!ts.isClassDeclaration(node) || !hasDecoratorCall(node, ['Controller'])) {
        return
      }

      const className = node.name?.text ?? '<anonymous>'
      if (hasAuthBoundaryDecorator(node)) {
        return
      }

      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member) || !hasDecoratorCall(member, ROUTE_DECORATORS)) {
          continue
        }

        if (!hasAuthBoundaryDecorator(member)) {
          violations.push(`${relativePath}:${className}.${member.name.getText(sourceFile)}`)
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

function hasAuthBoundaryDecorator(node: ts.Node): boolean {
  if (!ts.canHaveDecorators(node)) {
    return false
  }

  return (ts.getDecorators(node) ?? []).some((decorator) => {
    const expression = decorator.expression
    if (!ts.isCallExpression(expression) || !ts.isIdentifier(expression.expression)) {
      return false
    }

    const decoratorName = expression.expression.text
    if (AUTH_BOUNDARY_DECORATORS.includes(decoratorName)) {
      return true
    }

    return decoratorName === 'UseGuards'
      && expression.arguments.some(argument => ts.isIdentifier(argument) && AUTH_GUARD_IDENTIFIERS.includes(argument.text))
  })
}
