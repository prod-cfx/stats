import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 PrismaService
import { PrismaService } from '@/prisma/prisma.service'

import { PrincipalType } from '@/prisma/prisma.types'

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async findProfileById(userId: string) {
    const client = this.getClient()
    const user = await client.user.findUnique({
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

    if (!user) {
      return null
    }

    const assignments = await client.roleAssignment.findMany({
      where: {
        principalId: userId,
        principalType: PrincipalType.USER,
      },
      select: {
        role: {
          select: {
            code: true,
          },
        },
      },
    })

    const roles = assignments.map(item => item.role.code)

    return {
      ...user,
      roles,
    }
  }
}
