import type { PrincipalType } from '@ai/shared'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { AdminMenu } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

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
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}
  async findMany(): Promise<AdminMenu[]> {
    return this.txHost.tx.adminMenu.findMany({ orderBy: { sort: 'asc' } })
  }

  async findById(id: string): Promise<AdminMenu | null> {
    return this.txHost.tx.adminMenu.findUnique({ where: { id } })
  }

  async findByIdSelect(id: string): Promise<{ id: string } | null> {
    return this.txHost.tx.adminMenu.findUnique({ where: { id }, select: { id: true } })
  }

  async findChildrenIds(parentId: string): Promise<{ id: string }[]> {
    return this.txHost.tx.adminMenu.findMany({ where: { parentId }, select: { id: true } })
  }

  async findRoleAssignmentsByAdmin(
    adminId: string,
    principalType: PrincipalType,
  ): Promise<{ role: { menuPermissions: string[] } }[]> {
    return this.txHost.tx.roleAssignment.findMany({
      where: { principalId: adminId, principalType },
      select: { role: { select: { menuPermissions: true } } },
    })
  }

  async create(data: AdminMenuCreateData): Promise<AdminMenu> {
    return this.txHost.tx.adminMenu.create({ data: data as never })
  }

  async update(id: string, data: AdminMenuUpdateData): Promise<AdminMenu> {
    return this.txHost.tx.adminMenu.update({ where: { id }, data: data as never })
  }

  async deleteMany(ids: string[]): Promise<void> {
    await this.txHost.tx.adminMenu.deleteMany({ where: { id: { in: ids } } })
  }
}
