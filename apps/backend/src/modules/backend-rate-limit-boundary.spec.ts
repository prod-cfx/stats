import * as fs from 'node:fs'
import * as path from 'node:path'
import * as ts from 'typescript'

const modulesRoot = __dirname
const backendSrcRoot = path.resolve(modulesRoot, '..')

describe('backend global rate-limit boundary', () => {
  it('centralizes Redis-backed throttler configuration with default and auth limits', () => {
    const source = readSource(path.join(backendSrcRoot, 'common/modules/rate-limit.module.ts'))

    expect(classHasDecoratorCall(source, 'RateLimitModule', 'Module')).toBe(true)
    expect(source.text).toContain('ThrottlerModule.forRootAsync')
    expect(source.text).toContain('new ThrottlerRedisStorage(redisService)')
    expect(source.text).toContain("name: 'default'")
    expect(source.text).toContain('limit: 300')
    expect(source.text).toContain("name: 'auth'")
    expect(source.text).toContain('limit: 20')
    expect(source.text).toContain('seconds(60)')
  })

  it('keeps AuthModule on the shared rate-limit module without re-registering throttler root', () => {
    const source = readSource(path.join(modulesRoot, 'auth/auth.module.ts'))

    expect(source.text).toContain('RateLimitModule')
    expect(source.text).not.toContain('ThrottlerModule.forRootAsync')
  })

  it('registers default-only global rate-limit guard in AppModule', () => {
    const source = readSource(path.join(modulesRoot, 'app.module.ts'))

    expect(source.text).toContain('APP_GUARD')
    expect(source.text).toContain('GlobalRateLimitGuard')
    expect(source.text).toContain('RateLimitModule')
  })

  it('keeps named throttler guards scoped to their intended buckets', () => {
    const globalGuard = readSource(path.join(backendSrcRoot, 'common/guards/global-rate-limit.guard.ts')).text
    const authGuard = readSource(path.join(modulesRoot, 'auth/guards/auth-rate-limit.guard.ts')).text

    expect(globalGuard).toContain("throttler.name === 'default'")
    expect(authGuard).toContain("throttler.name === 'auth'")
  })

  it('keeps the global HTTP rate-limit guard out of websocket contexts', () => {
    const globalGuard = readSource(path.join(backendSrcRoot, 'common/guards/global-rate-limit.guard.ts')).text

    expect(globalGuard).toContain('canActivate(context')
    expect(globalGuard).toContain("context.getType() !== 'http'")
    expect(globalGuard).toContain('return true')
  })

  it('marks health checks and HTTP SSE streams as skipped for throttling', () => {
    const health = readSource(path.join(modulesRoot, 'health/health.controller.ts'))
    const whaleStream = readSource(path.join(modulesRoot, 'whale-alert/controllers/whale-alert-stream.controller.ts'))

    expect(classHasDecoratorCall(health, 'HealthController', 'SkipThrottle')).toBe(true)
    expect(health.text).toContain("@Get('live')")
    expect(health.text).toContain("@Get('ready')")
    expect(methodHasDecoratorCall(whaleStream, 'WhaleAlertStreamController', 'getRealtimeStream', 'SkipThrottle')).toBe(true)
  })
})

function readSource(filePath: string): ts.SourceFile {
  const sourceText = fs.readFileSync(filePath, 'utf8')
  return ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

function hasDecoratorCall(node: ts.Node, decoratorName: string): boolean {
  if (!ts.canHaveDecorators(node)) {
    return false
  }

  return (ts.getDecorators(node) ?? []).some((decorator) => {
    const expression = decorator.expression
    return ts.isCallExpression(expression)
      && ts.isIdentifier(expression.expression)
      && expression.expression.text === decoratorName
  })
}

function classHasDecoratorCall(sourceFile: ts.SourceFile, className: string, decoratorName: string): boolean {
  let found = false

  visit(sourceFile, (node) => {
    if (ts.isClassDeclaration(node) && node.name?.text === className) {
      found = hasDecoratorCall(node, decoratorName)
    }
  })

  return found
}

function methodHasDecoratorCall(sourceFile: ts.SourceFile, className: string, methodName: string, decoratorName: string): boolean {
  let found = false

  visit(sourceFile, (node) => {
    if (!ts.isClassDeclaration(node) || node.name?.text !== className) {
      return
    }

    for (const member of node.members) {
      if (ts.isMethodDeclaration(member) && member.name.getText(sourceFile) === methodName) {
        found = hasDecoratorCall(member, decoratorName)
      }
    }
  })

  return found
}

function visit(node: ts.Node, callback: (node: ts.Node) => void): void {
  callback(node)
  ts.forEachChild(node, child => visit(child, callback))
}
