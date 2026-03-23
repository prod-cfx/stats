import type { Prisma, Role } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class AdminRoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async count(where: Prisma.RoleWhereInput): Promise<number> {
    const client = this.getClient()
    return client.role.count({ where })
  }

  async findMany(params: {
    where: Prisma.RoleWhereInput
    orderBy: Prisma.RoleOrderByWithRelationInput
    skip: number
    take: number
  }): Promise<Role[]> {
    const client = this.getClient()
    return client.role.findMany(params)
  }

  async findById(id: string): Promise<Role | null> {
    const client = this.getClient()
    return client.role.findUnique({ where: { id } })
  }

  async findFirst(where: Prisma.RoleWhereInput): Promise<Role | null> {
    const client = this.getClient()
    return client.role.findFirst({ where })
  }

  async create(data: Prisma.RoleCreateInput): Promise<Role> {
    const client = this.getClient()
    return client.role.create({ data })
  }

  async update(id: string, data: Prisma.RoleUpdateInput): Promise<Role> {
    const client = this.getClient()
    return client.role.update({ where: { id }, data })
  }

  async delete(id: string): Promise<void> {
    const client = this.getClient()
    await client.role.delete({ where: { id } })
  }

  async deleteAssignmentsByRole(roleId: string): Promise<void> {
    const client = this.getClient()
    await client.roleAssignment.deleteMany({ where: { roleId } })
  }
}
