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
          reason: `绛栫暐鑴氭湰浣跨敤浜嗙鐢ㄨ兘鍔? ${pattern.source}`,
        }
      }
    }

    if (/helpers\s*\[\s*[^'"]/.test(script)) {
      return {
        passed: false,
        reason: '绂佹浣跨敤鍔ㄦ€?helper 涓嬫爣璁块棶',
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
          reason: `妫€娴嬪埌鏈巿鏉?helper 璺緞: helpers.${namespace}`,
        }
      }
    }

    return { passed: true }
  }
}
