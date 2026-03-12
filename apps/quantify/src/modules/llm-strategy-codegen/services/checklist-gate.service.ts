import type { ChecklistField } from '../constants/constraint-pack'
import { Injectable } from '@nestjs/common'

import { REQUIRED_CHECKLIST_FIELDS } from '../constants/constraint-pack'

export type CodegenChecklist = Partial<Record<ChecklistField, unknown>>

@Injectable()
export class ChecklistGateService {
  getMissingFields(checklist: CodegenChecklist): ChecklistField[] {
    return REQUIRED_CHECKLIST_FIELDS.filter((field) => {
      const value = checklist[field]
      if (Array.isArray(value)) {
        return value.length === 0
      }
      if (value && typeof value === 'object') {
        return Object.keys(value).length === 0
      }
      return value === undefined || value === null || value === ''
    })
  }

  mergeChecklist(base: CodegenChecklist, patch: CodegenChecklist): CodegenChecklist {
    const merged: CodegenChecklist = { ...base }
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        merged[key as ChecklistField] = value
      }
    }
    return merged
  }
}
