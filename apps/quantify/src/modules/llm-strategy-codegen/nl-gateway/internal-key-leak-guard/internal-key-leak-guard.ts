import type {
  InternalKeyLeakGuardFinding,
  InternalKeyLeakGuardScanOptions,
} from './internal-key-leak-guard.types'
import { InternalKeyLeakDetectedException } from '../../exceptions/internal-key-leak.exception'
import { SemanticAtomRegistryService } from '../../services/semantic-atom-registry.service'
import {
  buildInternalIdentifierKeys,
  buildInternalIdentifierPattern,
  PUBLIC_RESPONSE_INTERNAL_IDENTIFIERS,
} from './internal-key-identifiers'

const INTERNAL_KEY_SUGGESTIONS: Record<string, string> = {
  generic_boundary: '用可读边界名称替代，例如“上边界 / 下边界 / 中线”。',
  'condition.kind': '不要暴露 canonical condition 字段路径；改为展示条件类型的可读文案。',
  'condition.key': '不要暴露 canonical condition 字段路径；改为展示条件名称或摘要。',
  'condition.expression': '用“表达式条件”或具体条件摘要替代 raw atom key。',
  'risk.condition_expression': '用“风控表达式条件”或具体风控摘要替代 raw atom key。',
  'price.previous_extrema.kind': '用“前高/前低类型”替代 raw slot key。',
  'price.previous_extrema.lookback': '用“回看窗口”替代 raw slot key。',
  'price.previous_extrema.memoryKey': '用“记忆位名称”替代 raw slot key。',
}

export class InternalKeyLeakGuardService {
  private readonly internalKeys: readonly string[]
  private readonly internalKeyPattern: RegExp

  constructor(
    atomRegistry: SemanticAtomRegistryService = new SemanticAtomRegistryService(),
    additionalInternalKeys: readonly string[] = [],
  ) {
    this.internalKeys = buildInternalIdentifierKeys(atomRegistry, [
      ...PUBLIC_RESPONSE_INTERNAL_IDENTIFIERS,
      ...additionalInternalKeys,
    ])
    this.internalKeyPattern = buildInternalIdentifierPattern(this.internalKeys)
  }

  assertNoLeaks(value: unknown, options: InternalKeyLeakGuardScanOptions): void {
    const findings = this.scan(value, options)
    if (findings.length === 0) return

    const first = findings[0]
    throw new InternalKeyLeakDetectedException({
      key: first.key,
      details: formatFinding(options.surface, first),
    })
  }

  scan(value: unknown, options: InternalKeyLeakGuardScanOptions): InternalKeyLeakGuardFinding[] {
    const findings: InternalKeyLeakGuardFinding[] = []
    this.walk(value, options, '$', [], findings)
    return findings
  }

  private walk(
    value: unknown,
    options: InternalKeyLeakGuardScanOptions,
    path: string,
    keyPath: readonly string[],
    findings: InternalKeyLeakGuardFinding[],
  ): void {
    if (typeof value === 'string') {
      this.collectFinding(value, path, findings)
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        this.walk(item, options, `${path}[${index}]`, keyPath, findings)
      })
      return
    }

    if (!isRecord(value)) return

    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`
      const childKeyPath = [...keyPath, key]
      if (options.scanPaths) {
        this.collectPathFinding(childKeyPath, childPath, findings)
      }
      this.walk(child, options, childPath, childKeyPath, findings)
    }
  }

  private collectFinding(
    value: string,
    path: string,
    findings: InternalKeyLeakGuardFinding[],
  ): void {
    const match = this.internalKeyPattern.exec(value)
    if (!match?.[2]) return

    const key = match[2]
    findings.push({
      key,
      path,
      value,
      suggestion: INTERNAL_KEY_SUGGESTIONS[key] ?? `为 ${key} 增加 display-registry 文案并输出可读文本。`,
    })
  }

  private collectPathFinding(
    keyPath: readonly string[],
    path: string,
    findings: InternalKeyLeakGuardFinding[],
  ): void {
    const normalizedPath = `.${keyPath.join('.')}.`
    const key = this.internalKeys.find(candidate => normalizedPath.includes(`.${candidate}.`))
    if (!key) return

    findings.push({
      key,
      path,
      value: path,
      suggestion: INTERNAL_KEY_SUGGESTIONS[key] ?? `为 ${key} 增加 display-registry 文案并输出可读文本。`,
    })
  }
}

function formatFinding(surface: string, finding: InternalKeyLeakGuardFinding): string {
  return [
    `surface=${surface}`,
    `path=${finding.path}`,
    `key=${finding.key}`,
    `suggestion=${finding.suggestion}`,
  ].join('; ')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
