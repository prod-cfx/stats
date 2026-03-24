import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrincipalType } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class UserRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}
  async findProfileById(userId: string) {
    return this.txHost.tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        emailVerified: true,
        isGuest: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async findRoleAssignments(
    userId: string,
    principalType: PrincipalType,
  ): Promise<{ role: { code: string } }[]> {
    return this.txHost.tx.roleAssignment.findMany({
      where: { principalId: userId, principalType },
      select: { role: { select: { code: true } } },
    })
  }
}
