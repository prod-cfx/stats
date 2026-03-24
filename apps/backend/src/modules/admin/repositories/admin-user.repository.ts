import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { AdminUser, Prisma, Role } from '@/prisma/prisma.types'
import { PrincipalType } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class AdminUserRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}
  async count(where?: Prisma.AdminUserWhereInput): Promise<number> {
    return this.txHost.tx.adminUser.count({ where })
  }

  async findMany(params: {
    where: Prisma.AdminUserWhereInput
    orderBy: Prisma.AdminUserOrderByWithRelationInput
    skip: number
    take: number
  }): Promise<AdminUser[]> {
    return this.txHost.tx.adminUser.findMany(params)
  }

  async findById(id: string): Promise<AdminUser | null> {
    return this.txHost.tx.adminUser.findUnique({ where: { id } })
  }

  async findByUsername(username: string): Promise<AdminUser | null> {
    return this.txHost.tx.adminUser.findUnique({ where: { username } })
  }

  async create(data: Prisma.AdminUserCreateInput): Promise<AdminUser> {
    return this.txHost.tx.adminUser.create({ data })
  }

  async update(id: string, data: Prisma.AdminUserUpdateInput): Promise<AdminUser> {
    return this.txHost.tx.adminUser.update({ where: { id }, data })
  }

  async delete(id: string): Promise<void> {
    await this.txHost.tx.adminUser.delete({ where: { id } })
  }

  async findRoleAssignments(
    adminUserId: string,
    principalType: PrincipalType,
  ): Promise<{ role: { id: string; code: string; name: string; description: string | null } }[]> {
    return this.txHost.tx.roleAssignment.findMany({
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
    return this.txHost.tx.roleAssignment.findMany({
      where: { principalId: adminUserId, principalType },
      select: { role: { select: { code: true } } },
    })
  }

  async findRoleAssignmentsByAdminsBulk(
    userIds: string[],
    principalType: PrincipalType,
  ): Promise<{ principalId: string; role: { id: string; code: string; name: string; description: string | null } }[]> {
    return this.txHost.tx.roleAssignment.findMany({
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
    return this.txHost.tx.role.findMany({ where: { code: { in: codes } } })
  }

  async findRolesByIdSelect(ids: string[]): Promise<{ id: string }[]> {
    return this.txHost.tx.role.findMany({ where: { id: { in: ids } }, select: { id: true } })
  }

  async createRoleAssignments(
    data: { principalId: string; principalType: PrincipalType; roleId: string }[],
  ): Promise<void> {
    await this.txHost.tx.roleAssignment.createMany({ data: data as never })
  }

  async deleteRoleAssignments(adminUserId: string, principalType: PrincipalType): Promise<void> {
    await this.txHost.tx.roleAssignment.deleteMany({ where: { principalId: adminUserId, principalType } })
  }

  async findMenusByOrderBy(): Promise<import('@/prisma/prisma.types').AdminMenu[]> {
    return this.txHost.tx.adminMenu.findMany({ orderBy: { sort: 'asc' } })
  }
}
