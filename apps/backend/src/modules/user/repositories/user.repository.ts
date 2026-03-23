import type { PrincipalType } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async findProfileById(userId: string) {
    const client = this.getClient()
    return client.user.findUnique({
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
    const client = this.getClient()
    return client.roleAssignment.findMany({
      where: { principalId: userId, principalType },
      select: { role: { select: { code: true } } },
    })
  }
}
