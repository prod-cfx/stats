import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const repoRoot = join(__dirname, '../../../../../../..')

const semanticStateFlatFields = [
  'trigger',
  'action',
  'risk',
  'positionConstraint',
  'orchestration',
] as const

const semanticPatchLegacyFields = [
  'atoms',
  'triggers',
  'actions',
  'risk',
  'position',
  'orchestration',
] as const

type GuardFinding = {
  filePath: string
  line: number
  column: number
  field: string
  kind: string
  text: string
}

function rg(pattern: string, paths: readonly string[]): string {
  try {
    return execFileSync('rg', ['-n', pattern, ...paths], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }
  catch (error) {
    const status = (error as { status?: number }).status
    if (status === 1) return ''
    throw error
  }
}

function productionFiles(): string[] {
  const productionPaths = [
    'apps/quantify/src/modules/llm-strategy-codegen',
    'apps/quantify/src/modules/backtesting',
    'apps/quantify/src/modules/account-strategy-view',
  ] as const

  return execFileSync('rg', ['--files', ...productionPaths, '-g', '*.ts'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split('\n')
    .filter(filePath => filePath.trim())
    .filter(filePath => !filePath.includes('/__tests__/'))
    .filter(filePath => !filePath.endsWith('.spec.ts'))
}

function productionMatches(pattern: string): string {
  const productionPaths = [
    'apps/quantify/src/modules/llm-strategy-codegen',
    'apps/quantify/src/modules/backtesting',
    'apps/quantify/src/modules/account-strategy-view',
  ] as const

  return rg(pattern, productionPaths)
    .split('\n')
    .filter(line => line.trim())
    .filter(line => !line.includes('__tests__'))
    .filter(line => !line.includes('.spec.ts'))
    .filter(line => !line.includes('stage3-source-guard.spec.ts'))
    .join('\n')
}

function scanSourceForStage3LegacyDataFlow(filePath: string, sourceText: string): GuardFinding[] {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const semanticStateVars = new Set<string>()
  const semanticPatchVars = new Set<string>()
  const findings: GuardFinding[] = []

  const addFinding = (node: ts.Node, field: string, kind: string) => {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    findings.push({
      filePath,
      line: line + 1,
      column: character + 1,
      field,
      kind,
      text: node.getText(sourceFile),
    })
  }

  const typeTextContains = (node: ts.TypeNode | undefined, typeName: string): boolean =>
    Boolean(node?.getText(sourceFile).split(/\W+/u).includes(typeName))

  const rememberTypedIdentifier = (name: ts.BindingName, typeNode: ts.TypeNode | undefined) => {
    if (!ts.isIdentifier(name)) return
    if (typeTextContains(typeNode, 'SemanticState')) semanticStateVars.add(name.text)
    if (typeTextContains(typeNode, 'CodegenSemanticPatch')) semanticPatchVars.add(name.text)
  }

  const stringLiteralKey = (node: ts.Expression | undefined): string | null =>
    node && ts.isStringLiteralLike(node) ? node.text : null

  const expressionIdentifier = (node: ts.Expression): string | null => {
    if (ts.isIdentifier(node)) return node.text
    if (ts.isParenthesizedExpression(node)) return expressionIdentifier(node.expression)
    return null
  }

  const isSemanticStateExpression = (node: ts.Expression): boolean => {
    const identifier = expressionIdentifier(node)
    return Boolean(identifier && semanticStateVars.has(identifier))
  }

  const isSemanticPatchExpression = (node: ts.Expression): boolean => {
    const identifier = expressionIdentifier(node)
    return Boolean(identifier && (semanticPatchVars.has(identifier) || /semanticPatch/u.test(identifier)))
  }

  const reportObjectBindingFields = (
    pattern: ts.ObjectBindingPattern,
    initializer: ts.Expression | undefined,
    fields: readonly string[],
    kind: string,
    matchesExpression: (node: ts.Expression) => boolean,
  ) => {
    if (!initializer || !matchesExpression(initializer)) return
    for (const element of pattern.elements) {
      const propertyName = element.propertyName ?? element.name
      if (ts.isIdentifier(propertyName) && fields.includes(propertyName.text)) {
        addFinding(propertyName, propertyName.text, kind)
      }
    }
  }

  const reportObjectLiteralFields = (
    objectLiteral: ts.ObjectLiteralExpression,
    fields: readonly string[],
    kind: string,
  ) => {
    for (const property of objectLiteral.properties) {
      if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) continue
      const name = property.name
      const field = ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : null
      if (field && fields.includes(field)) addFinding(name, field, kind)
    }
  }

  const visit = (node: ts.Node) => {
    if (ts.isParameter(node)) {
      rememberTypedIdentifier(node.name, node.type)
      if (ts.isObjectBindingPattern(node.name)) {
        const fields = typeTextContains(node.type, 'SemanticState') ? semanticStateFlatFields : []
        for (const element of node.name.elements) {
          const propertyName = element.propertyName ?? element.name
          if (ts.isIdentifier(propertyName) && fields.includes(propertyName.text)) {
            addFinding(propertyName, propertyName.text, 'SemanticState parameter destructuring')
          }
        }
      }
    }

    if (ts.isVariableDeclaration(node)) {
      rememberTypedIdentifier(node.name, node.type)
      if (ts.isObjectBindingPattern(node.name)) {
        reportObjectBindingFields(
          node.name,
          node.initializer,
          semanticStateFlatFields,
          'SemanticState destructuring',
          isSemanticStateExpression,
        )
        reportObjectBindingFields(
          node.name,
          node.initializer,
          semanticPatchLegacyFields,
          'CodegenSemanticPatch destructuring',
          isSemanticPatchExpression,
        )
      }
      if (node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
        if (typeTextContains(node.type, 'SemanticState')) {
          reportObjectLiteralFields(node.initializer, semanticStateFlatFields, 'SemanticState object literal')
        }
        if (typeTextContains(node.type, 'CodegenSemanticPatch')) {
          reportObjectLiteralFields(node.initializer, semanticPatchLegacyFields, 'CodegenSemanticPatch object literal')
        }
      }
    }

    if (ts.isPropertyAccessExpression(node)) {
      const field = node.name.text
      if (semanticStateFlatFields.includes(field) && isSemanticStateExpression(node.expression)) {
        addFinding(node.name, field, 'SemanticState property access')
      }
      if (semanticPatchLegacyFields.includes(field) && isSemanticPatchExpression(node.expression)) {
        addFinding(node.name, field, 'CodegenSemanticPatch property access')
      }
    }

    if (ts.isElementAccessExpression(node)) {
      const field = stringLiteralKey(node.argumentExpression)
      if (field && semanticStateFlatFields.includes(field) && isSemanticStateExpression(node.expression)) {
        addFinding(node.argumentExpression, field, 'SemanticState bracket access')
      }
      if (field && semanticPatchLegacyFields.includes(field) && isSemanticPatchExpression(node.expression)) {
        addFinding(node.argumentExpression, field, 'CodegenSemanticPatch bracket access')
      }
    }

    if (
      ts.isReturnStatement(node)
      && node.expression
      && ts.isObjectLiteralExpression(node.expression)
    ) {
      const parent = node.parent.parent
      if (
        (ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent) || ts.isMethodDeclaration(parent) || ts.isArrowFunction(parent))
        && typeTextContains(parent.type, 'SemanticState')
      ) {
        reportObjectLiteralFields(node.expression, semanticStateFlatFields, 'SemanticState return object literal')
      }
    }

    if (
      ts.isAsExpression(node)
      && ts.isObjectLiteralExpression(node.expression)
      && typeTextContains(node.type, 'SemanticState')
    ) {
      reportObjectLiteralFields(node.expression, semanticStateFlatFields, 'SemanticState asserted object literal')
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return findings
}

function formatFindings(findings: readonly GuardFinding[]): string {
  return findings
    .map(finding => `${finding.filePath}:${finding.line}:${finding.column} ${finding.kind} ${finding.field}: ${finding.text}`)
    .join('\n')
}

describe('stage3 rules-only hard-delete source guard', () => {
  it.each([
    'readFlatTriggers',
    'readFlatActions',
    'readFlatRisks',
    'readFlatPositionConstraints',
    'projectToFlat',
    'reprojectFromRules',
    'SemanticStateBuckets',
  ])('does not use removed flat helper %s in production code', (pattern) => {
    expect(productionMatches(pattern)).toBe('')
  })

  it.each([
    '\\bstate\\.trigger\\b',
    '\\bstate\\.action\\b',
    '\\bstate\\.risk\\b',
    '\\bstate\\.positionConstraint\\b',
    '\\bstate\\.orchestration\\b',
    '\\bsemanticPatch\\.atoms\\b',
    '\\bsemanticPatch\\.triggers\\b',
    '\\bsemanticPatch\\.actions\\b',
    '\\bsemanticPatch\\.risk\\b',
    '\\bsemanticPatch\\.position\\b',
    '\\bsemanticPatch\\.orchestration\\b',
  ])('does not use removed flat field pattern %s in production code', (pattern) => {
    expect(productionMatches(pattern)).toBe('')
  })

  it('catches SemanticState and CodegenSemanticPatch legacy data-flow while ignoring comments and type-only text', () => {
    const source = `
      import type { SemanticState } from '../types/semantic-state'
      import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
      // state.trigger and semanticPatch.atoms in comments are documentation only.
      type CommentLike = { trigger?: string; atoms?: string }
      const readState = (state: SemanticState) => {
        state.trigger
        state['risk']
        const { orchestration } = state
        return orchestration
      }
      const readPatch = (semanticPatch: CodegenSemanticPatch) => {
        semanticPatch.atoms
        semanticPatch['position']
      }
    `

    expect(formatFindings(scanSourceForStage3LegacyDataFlow('fixture.ts', source))).toBe([
      `fixture.ts:7:15 SemanticState property access trigger: trigger`,
      `fixture.ts:8:15 SemanticState bracket access risk: 'risk'`,
      `fixture.ts:9:17 SemanticState destructuring orchestration: orchestration`,
      `fixture.ts:13:23 CodegenSemanticPatch property access atoms: atoms`,
      `fixture.ts:14:23 CodegenSemanticPatch bracket access position: 'position'`,
    ].join('\n'))
  })

  it('does not use SemanticState flat buckets or CodegenSemanticPatch legacy fields in production data-flow', () => {
    const findings = productionFiles().flatMap(filePath =>
      scanSourceForStage3LegacyDataFlow(filePath, readFileSync(join(repoRoot, filePath), 'utf8')),
    )

    expect(formatFindings(findings)).toBe('')
  })
})
