import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class RoleAssignmentRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}
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
