import * as fs from 'node:fs'
import * as path from 'node:path'
import * as ts from 'typescript'

const modulesRoot = __dirname
const allowedAppModuleImports = [
  'ConfigModule',
  'EnvModule',
  'ClsConfigModule',
  'EventEmitterModule',
  'WinstonModule',
  'CacheModule',
  'RateLimitModule',
  'PrismaModule',
  'ScheduleModule',
  'HealthModule',
  'AdminApiModule',
  'MarketDataModule',
  'NotificationDataSyncModule',
  'AiQuantBridgeModule',
]
const forbiddenBusinessLeafImports = [
  'SettingsModule',
  'UserModule',
  'AuthModule',
  'BetaCodeModule',
  'AdminModule',
  'AccountExchangeAccountsModule',
  'AiQuantProxyModule',
  'DataSyncModule',
  'MarketsModule',
  'LiquidationHeatmapModule',
  'AggregatedLiquidationModule',
  'OrderbookConfigModule',
  'AggregatedOrderbookModule',
  'KlineModule',
  'TradesConfigModule',
  'ExchangeConfigModule',
  'OpenInterestModule',
  'PolymarketModule',
  'WhaleAlertModule',
  'WhaleNotificationModule',
  'CryptoStockQuotesModule',
  'WhaleTrackingModule',
  'WhaleHoldingsModule',
]

describe('backend AppModule module boundary', () => {
  it('detects any single direct business leaf import', () => {
    expect(findForbiddenImports(['ConfigModule', 'MarketsModule'])).toEqual(['MarketsModule'])
  })

  it('detects imports outside the infrastructure and aggregation allowlist', () => {
    expect(findUnexpectedImports(['ConfigModule', 'UnexpectedBusinessModule'])).toEqual(['UnexpectedBusinessModule'])
  })

  it('imports infrastructure modules and business aggregation modules only', () => {
    const source = readSource(path.join(modulesRoot, 'app.module.ts'))
    const imports = getAppModuleImports(source)

    expect(imports).toEqual(allowedAppModuleImports)
    expect(findForbiddenImports(imports)).toEqual([])
    expect(findUnexpectedImports(imports)).toEqual([])
  })

  it('does not introduce forwardRef in backend module assembly', () => {
    const moduleFiles = collectModuleFiles(modulesRoot)
    const offenders = moduleFiles
      .filter(filePath => fs.readFileSync(filePath, 'utf8').includes('forwardRef('))
      .map(filePath => path.relative(modulesRoot, filePath))
      .sort()

    expect(offenders).toEqual([])
  })
})

function readSource(filePath: string): ts.SourceFile {
  const sourceText = fs.readFileSync(filePath, 'utf8')
  return ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

function getAppModuleImports(source: ts.SourceFile): string[] {
  let imports: string[] = []

  visit(source, (node) => {
    if (!ts.isClassDeclaration(node) || node.name?.text !== 'AppModule') {
      return
    }

    const moduleDecorator = (ts.getDecorators(node) ?? []).find((decorator) => {
      const expression = decorator.expression
      return ts.isCallExpression(expression)
        && ts.isIdentifier(expression.expression)
        && expression.expression.text === 'Module'
    })

    if (!moduleDecorator || !ts.isCallExpression(moduleDecorator.expression)) {
      return
    }

    const metadata = moduleDecorator.expression.arguments[0]
    if (!metadata || !ts.isObjectLiteralExpression(metadata)) {
      return
    }

    const importsProperty = metadata.properties.find((property): property is ts.PropertyAssignment => {
      return ts.isPropertyAssignment(property)
        && ts.isIdentifier(property.name)
        && property.name.text === 'imports'
    })

    if (!importsProperty || !ts.isArrayLiteralExpression(importsProperty.initializer)) {
      return
    }

    imports = importsProperty.initializer.elements.map(element => getImportName(element, source))
  })

  return imports
}

function findForbiddenImports(imports: string[]): string[] {
  return imports.filter(moduleName => forbiddenBusinessLeafImports.includes(moduleName))
}

function findUnexpectedImports(imports: string[]): string[] {
  return imports.filter(moduleName => !allowedAppModuleImports.includes(moduleName))
}

function getImportName(expression: ts.Expression, source: ts.SourceFile): string {
  if (ts.isIdentifier(expression)) {
    return expression.text
  }

  if (ts.isCallExpression(expression)) {
    return getCallRootName(expression.expression, source)
  }

  return expression.getText(source)
}

function getCallRootName(expression: ts.Expression, source: ts.SourceFile): string {
  if (ts.isIdentifier(expression)) {
    return expression.text
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return getCallRootName(expression.expression, source)
  }

  return expression.getText(source)
}

function collectModuleFiles(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((entry) => {
    const filePath = path.join(dir, entry)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      return collectModuleFiles(filePath)
    }

    return filePath.endsWith('.module.ts') ? [filePath] : []
  })
}

function visit(node: ts.Node, callback: (node: ts.Node) => void): void {
  callback(node)
  ts.forEachChild(node, child => visit(child, callback))
}
