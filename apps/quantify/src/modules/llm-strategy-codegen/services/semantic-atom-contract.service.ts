import { Injectable } from '@nestjs/common'

import type { SemanticAtomContract, SemanticCapability, SemanticRequirement } from '../types/semantic-state'

export interface MissingSemanticRequirement extends SemanticRequirement {
  contractId: string
}

export interface SemanticAtomContractResolution {
  capabilities: SemanticCapability[]
  missingRequirements: MissingSemanticRequirement[]
  canCompileOrderProgram: boolean
}

@Injectable()
export class SemanticAtomContractService {
  resolve(contracts: readonly SemanticAtomContract[]): SemanticAtomContractResolution {
    const capabilities = contracts.flatMap(contract => contract.capabilities)
    const missingRequirements = contracts.flatMap(contract =>
      contract.requires
        .filter(requirement => !this.hasCapability(capabilities, requirement))
        .map(requirement => ({ contractId: contract.id, ...requirement })),
    )

    return {
      capabilities,
      missingRequirements,
      canCompileOrderProgram: missingRequirements.length === 0 && this.hasOrderProgramCapability(capabilities),
    }
  }

  private hasCapability(capabilities: readonly SemanticCapability[], requirement: SemanticRequirement): boolean {
    return capabilities.some(capability =>
      capability.domain === requirement.domain
      && capability.verb === requirement.verb
      && capability.object === requirement.object,
    )
  }

  private hasOrderProgramCapability(capabilities: readonly SemanticCapability[]): boolean {
    return capabilities.some(capability =>
      capability.domain === 'order_program'
      && capability.verb === 'maintain'
      && capability.object === 'limit_ladder',
    )
  }
}
