import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { Prisma, Role } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class AdminRoleRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}
  async count(where: Prisma.RoleWhereInput): Promise<number> {
    return this.txHost.tx.role.count({ where })
  }

  async findMany(params: {
    where: Prisma.RoleWhereInput
    orderBy: Prisma.RoleOrderByWithRelationInput
    skip: number
    take: number
  }): Promise<Role[]> {
    return this.txHost.tx.role.findMany(params)
  }

  async findById(id: string): Promise<Role | null> {
    return this.txHost.tx.role.findUnique({ where: { id } })
  }

  async findFirst(where: Prisma.RoleWhereInput): Promise<Role | null> {
    return this.txHost.tx.role.findFirst({ where })
  }

  async create(data: Prisma.RoleCreateInput): Promise<Role> {
    return this.txHost.tx.role.create({ data })
  }

  async update(id: string, data: Prisma.RoleUpdateInput): Promise<Role> {
    return this.txHost.tx.role.update({ where: { id }, data })
  }

  async delete(id: string): Promise<void> {
    await this.txHost.tx.role.delete({ where: { id } })
  }

  async deleteAssignmentsByRole(roleId: string): Promise<void> {
    await this.txHost.tx.roleAssignment.deleteMany({ where: { roleId } })
  }
}
