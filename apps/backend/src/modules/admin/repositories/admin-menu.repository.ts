import type { AdminMenu, PrincipalType } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

export interface AdminMenuCreateData {
  parentId?: string | null
  type: string
  title: string
  icon?: string | null
  code?: string | null
  path?: string | null
  description?: string | null
  i18nKey?: string | null
  sort: number
  isShow: boolean
}

export interface AdminMenuUpdateData {
  parentId?: string | null
  type?: string
  title?: string
  icon?: string | null
  code?: string | null
  path?: string | null
  description?: string | null
  i18nKey?: string | null
  sort?: number
  isShow?: boolean
}

@Injectable()
export class AdminMenuRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async findMany(): Promise<AdminMenu[]> {
    const client = this.getClient()
    return client.adminMenu.findMany({ orderBy: { sort: 'asc' } })
  }

  async findById(id: string): Promise<AdminMenu | null> {
    const client = this.getClient()
    return client.adminMenu.findUnique({ where: { id } })
  }

  async findByIdSelect(id: string): Promise<{ id: string } | null> {
    const client = this.getClient()
    return client.adminMenu.findUnique({ where: { id }, select: { id: true } })
  }

  async findChildrenIds(parentId: string): Promise<{ id: string }[]> {
    const client = this.getClient()
    return client.adminMenu.findMany({ where: { parentId }, select: { id: true } })
  }

  async findRoleAssignmentsByAdmin(
    adminId: string,
    principalType: PrincipalType,
  ): Promise<{ role: { menuPermissions: string[] } }[]> {
    const client = this.getClient()
    return client.roleAssignment.findMany({
      where: { principalId: adminId, principalType },
      select: { role: { select: { menuPermissions: true } } },
    })
  }

  async create(data: AdminMenuCreateData): Promise<AdminMenu> {
    const client = this.getClient()
    return client.adminMenu.create({ data: data as never })
  }

  async update(id: string, data: AdminMenuUpdateData): Promise<AdminMenu> {
    const client = this.getClient()
    return client.adminMenu.update({ where: { id }, data: data as never })
  }

  async deleteMany(ids: string[]): Promise<void> {
    const client = this.getClient()
    await client.adminMenu.deleteMany({ where: { id: { in: ids } } })
  }
}
