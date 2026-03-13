import { Injectable } from '@nestjs/common'

import { ALLOWED_HELPER_PREFIXES } from '../constants/constraint-pack'

export interface StaticGuardrailResult {
  passed: boolean
  reason?: string
}

@Injectable()
export class StaticGuardrailService {
  private static readonly FORBIDDEN_PATTERNS = [
    /\beval\s*\(/i,
    /\bFunction\s*\(/,
    /\bimport\s*[('"{*]/i,
    /\brequire\s*\(/i,
    /\bprocess\b/i,
    /__dirname/,
    /__filename/,
    /\bglobalThis\b/,
  ]

  validate(script: string): StaticGuardrailResult {
    for (const pattern of StaticGuardrailService.FORBIDDEN_PATTERNS) {
      if (pattern.test(script)) {
        return {
          passed: false,
          reason: `策略脚本使用了禁用能力: ${pattern.source}`,
        }
      }
    }

    if (/helpers\s*\[\s*[^'"]/.test(script)) {
      return {
        passed: false,
        reason: '禁止使用动态 helper 下标访问',
      }
    }

    const helperUsages = script.matchAll(/helpers(?:\[['"]([A-Za-z_]\w*)['"]\]|\.(\w+))/g)
    for (const match of helperUsages) {
      const namespace = match[1] ?? match[2]
      if (!namespace) continue
      const prefix = `helpers.${namespace}.`
      if (!ALLOWED_HELPER_PREFIXES.includes(prefix as (typeof ALLOWED_HELPER_PREFIXES)[number])) {
        return {
          passed: false,
          reason: `检测到未授权 helper 路径: helpers.${namespace}`,
        }
      }
    }

    return { passed: true }
  }
}
