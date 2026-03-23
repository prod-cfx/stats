import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class RoleAssignmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async findRolesByPrincipal(
    principalId: string,
    principalType: 'USER' | 'ADMIN',
  ): Promise<{ role: { code: string | null; apiPermissions: string[] | null } }[]> {
    const client = this.getClient()
    return client.roleAssignment.findMany({
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
