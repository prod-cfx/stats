import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrincipalType } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class RoleAssignmentRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async hasAssignment(principalId: string, principalType: PrincipalType): Promise<boolean> {
    const assignment = await this.txHost.tx.roleAssignment.findFirst({
      where: { principalId, principalType },
      select: { id: true },
    })
    return Boolean(assignment)
  }

  async findRolesByPrincipal(
    principalId: string,
    principalType: 'USER' | 'ADMIN',
  ): Promise<{ role: { code: string | null; apiPermissions: string[] | null } }[]> {
    return this.txHost.tx.roleAssignment.findMany({
      where: { principalId, principalType: principalType as never },
      select: {
        role: {
          select: {
            code: true,
            apiPermissions: true,
          },
        },
      },
    })
  }
}
