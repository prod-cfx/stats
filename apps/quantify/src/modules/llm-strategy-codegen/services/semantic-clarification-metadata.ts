import type { StrategyClarificationItem } from '../types/strategy-clarification'

export function resolveSemanticClarificationMetadata(
  slotKey: string,
): Pick<StrategyClarificationItem, 'reason' | 'field'> {
  if (slotKey === 'position.sizing') {
    return {
      reason: 'missing_semantic_position_sizing',
      field: 'position.sizing',
    }
  }

  if (slotKey === 'position.mode' || slotKey === 'exposure.position_mode') {
    return {
      reason: 'missing_semantic_position_mode',
      field: 'position.positionMode',
    }
  }

  if (slotKey === 'risk.protective_exit' || slotKey.startsWith('risk.')) {
    return {
      reason: 'missing_semantic_risk',
      field: 'risk',
    }
  }

  if (slotKey === 'grid.sideMode' || slotKey.startsWith('action.') || slotKey.includes('order.intent')) {
    return {
      reason: 'missing_semantic_action',
      field: 'actions',
    }
  }

  if (slotKey.startsWith('grid.')) {
    return {
      reason: 'missing_semantic_contract_requirement',
      field: slotKey,
    }
  }

  if (slotKey.startsWith('contract.requirement.')) {
    return {
      reason: 'missing_semantic_contract_requirement',
      field: slotKey,
    }
  }

  return {
    reason: 'missing_semantic_trigger',
    field: 'triggers',
  }
}
