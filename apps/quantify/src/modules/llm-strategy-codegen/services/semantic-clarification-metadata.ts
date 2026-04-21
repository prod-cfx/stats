import type { StrategyClarificationItem } from '../types/strategy-clarification'

export function resolveSemanticClarificationMetadata(
  slotKey: string,
): Pick<StrategyClarificationItem, 'reason' | 'field'> {
  if (slotKey === 'position.sizing') {
    return {
      reason: 'missing_position_pct',
      field: 'riskRules.positionPct',
    }
  }

  if (slotKey === 'risk.protective_exit') {
    return {
      reason: 'missing_stop_loss_rule',
      field: 'riskRules.stopLossPct',
    }
  }

  if (slotKey === 'grid.sideMode') {
    return {
      reason: 'missing_side_scope',
      field: 'grid.sideMode',
    }
  }

  if (slotKey.startsWith('grid.')) {
    return {
      reason: 'grid_params_missing',
      field: slotKey,
    }
  }

  if (slotKey.includes('.exit')) {
    return {
      reason: 'missing_exit_rules',
      field: 'exitRules',
    }
  }

  return {
    reason: 'missing_entry_rules',
    field: 'entryRules',
  }
}
