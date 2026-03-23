import type { AdminUser, Prisma, PrincipalType, Role } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class AdminUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async count(where?: Prisma.AdminUserWhereInput): Promise<number> {
    const client = this.getClient()
    return client.adminUser.count({ where })
  }

  async findMany(params: {
    where: Prisma.AdminUserWhereInput
    orderBy: Prisma.AdminUserOrderByWithRelationInput
    skip: number
    take: number
  }): Promise<AdminUser[]> {
    const client = this.getClient()
    return client.adminUser.findMany(params)
  }

  async findById(id: string): Promise<AdminUser | null> {
    const client = this.getClient()
    return client.adminUser.findUnique({ where: { id } })
  }

  async findByUsername(username: string): Promise<AdminUser | null> {
    const client = this.getClient()
    return client.adminUser.findUnique({ where: { username } })
  }

  async create(data: Prisma.AdminUserCreateInput): Promise<AdminUser> {
    const client = this.getClient()
    return client.adminUser.create({ data })
  }

  async update(id: string, data: Prisma.AdminUserUpdateInput): Promise<AdminUser> {
    const client = this.getClient()
    return client.adminUser.update({ where: { id }, data })
  }

  async delete(id: string): Promise<void> {
    const client = this.getClient()
    await client.adminUser.delete({ where: { id } })
  }

  async findRoleAssignments(
    adminUserId: string,
    principalType: PrincipalType,
  ): Promise<{ role: { id: string; code: string; name: string; description: string | null } }[]> {
    const client = this.getClient()
    return client.roleAssignment.findMany({
      where: { principalId: adminUserId, principalType },
      select: {
        role: {
          select: { id: true, code: true, name: true, description: true },
        },
      },
    })
  }

  async findRoleCodesByAdmin(
    adminUserId: string,
    principalType: PrincipalType,
  ): Promise<{ role: { code: string } }[]> {
    const client = this.getClient()
    return client.roleAssignment.findMany({
      where: { principalId: adminUserId, principalType },
      select: { role: { select: { code: true } } },
    })
  }

  async findRoleAssignmentsByAdminsBulk(
    userIds: string[],
    principalType: PrincipalType,
  ): Promise<{ principalId: string; role: { id: string; code: string; name: string; description: string | null } }[]> {
    const client = this.getClient()
    return client.roleAssignment.findMany({
      where: { principalId: { in: userIds }, principalType },
      select: {
        principalId: true,
        role: {
          select: { id: true, code: true, name: true, description: true },
        },
      },
    })
  }

  async findRolesByCode(codes: string[]): Promise<Role[]> {
    const client = this.getClient()
    return client.role.findMany({ where: { code: { in: codes } } })
  }

  async findRolesByIdSelect(ids: string[]): Promise<{ id: string }[]> {
    const client = this.getClient()
    return client.role.findMany({ where: { id: { in: ids } }, select: { id: true } })
  }

  async createRoleAssignments(
    data: { principalId: string; principalType: PrincipalType; roleId: string }[],
  ): Promise<void> {
    const client = this.getClient()
    await client.roleAssignment.createMany({ data: data as never })
  }

  async deleteRoleAssignments(adminUserId: string, principalType: PrincipalType): Promise<void> {
    const client = this.getClient()
    await client.roleAssignment.deleteMany({ where: { principalId: adminUserId, principalType } })
  }

  async findMenusByOrderBy(): Promise<import('@/prisma/prisma.types').AdminMenu[]> {
    const client = this.getClient()
    return client.adminMenu.findMany({ orderBy: { sort: 'asc' } })
  }
}
