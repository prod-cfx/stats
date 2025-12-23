import type { AdminMenu } from '@prisma/client'
import type { CreateAdminMenuDto, UpdateAdminMenuDto } from '../dto/admin-menu.dto'
import type { AdminUserInfoDto } from '../dto/admin-user-info.dto'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import { AdminMenuType, PrincipalType } from '@prisma/client'
import { DomainException } from '@/common/exceptions/domain.exception'
import { PrismaService } from '@/prisma/prisma.service'
import { buildAuthorizedMenuTree } from '../utils/menu-permissions.util'

interface AdminMenuTreeNode extends AdminMenu {
  children: AdminMenuTreeNode[]
}

@Injectable()
export class AdminMenuService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async findMenuTree(): Promise<AdminMenuTreeNode[]> {
    const client = this.getClient()
    const menus = await client.adminMenu.findMany({
      orderBy: { sort: 'asc' },
    })

    const map = new Map<string, AdminMenuTreeNode>()
    const roots: AdminMenuTreeNode[] = []

    menus.forEach(menu => {
      map.set(menu.id, { ...menu, children: [] })
    })

    map.forEach(node => {
      if (node.parentId) {
        const parent = map.get(node.parentId)
        if (parent) {
          parent.children.push(node)
        } else {
          roots.push(node)
        }
      } else {
        roots.push(node)
      }
    })

    return roots
  }

  async findFlat(): Promise<AdminMenu[]> {
    const client = this.getClient()
    return client.adminMenu.findMany({
      orderBy: { sort: 'asc' },
    })
  }

  async findPermissionMenus(adminId: string): Promise<AdminUserInfoDto['menus']> {
    const client = this.getClient()

    const assignments = await client.roleAssignment.findMany({
      where: {
        principalId: adminId,
        principalType: PrincipalType.ADMIN,
      },
      select: {
        role: { select: { menuPermissions: true } },
      },
    })

    const permissionCodes = new Set<string>()
    assignments.forEach(({ role }) => {
      role.menuPermissions.forEach(code => permissionCodes.add(code))
    })

    const menus = await client.adminMenu.findMany({
      orderBy: { sort: 'asc' },
    })

    return buildAuthorizedMenuTree(menus, permissionCodes)
  }

  async findById(id: string): Promise<AdminMenu> {
    const client = this.getClient()
    const menu = await client.adminMenu.findUnique({ where: { id } })
    if (!menu) {
      throw new DomainException('Menu not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }
    return menu
  }

  async create(dto: CreateAdminMenuDto): Promise<AdminMenu> {
    const client = this.getClient()

    const parentIdForCreate = dto.parentId?.trim()
    if (parentIdForCreate) {
      await this.ensureParentMenu(parentIdForCreate, client)
    }

    return client.adminMenu.create({
      data: {
        parentId: parentIdForCreate ?? null,
        type: dto.type,
        title: dto.title,
        icon: dto.icon,
        code: dto.code,
        path: dto.path,
        description: dto.description,
        i18nKey: dto.i18nKey,
        sort: dto.sort ?? 0,
        isShow: dto.isShow ?? true,
      },
    })
  }

  async update(id: string, dto: UpdateAdminMenuDto): Promise<AdminMenu> {
    const client = this.getClient()

    const menu = await client.adminMenu.findUnique({ where: { id } })
    if (!menu) {
      throw new DomainException('Menu not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    const hasParentUpdate = dto.parentId !== undefined
    const normalizedParentId =
      hasParentUpdate && typeof dto.parentId === 'string' ? dto.parentId.trim() : undefined

    if (normalizedParentId && normalizedParentId === id) {
      throw new DomainException('Menu cannot be its own parent', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    if (normalizedParentId) {
      await this.ensureParentMenu(normalizedParentId, client)
      const subtreeIds = await this.collectSubtreeIds(id, client)
      if (subtreeIds.includes(normalizedParentId)) {
        throw new DomainException('Menu cannot be moved under its own descendants', {
          code: ErrorCode.BAD_REQUEST,
          status: HttpStatus.BAD_REQUEST,
        })
      }
    }

    const nextType = dto.type ?? menu.type
    const dtoCode = dto.code !== undefined ? dto.code?.trim() ?? '' : undefined
    const nextCode = dtoCode !== undefined ? dtoCode : menu.code ?? null
    const parentIdToApply = hasParentUpdate
      ? normalizedParentId && normalizedParentId.length > 0
        ? normalizedParentId
        : null
      : menu.parentId

    if (nextType !== AdminMenuType.DIRECTORY) {
      if (!nextCode || nextCode.length === 0) {
        throw new DomainException('Non-directory menu requires a code', {
          code: ErrorCode.BAD_REQUEST,
          status: HttpStatus.BAD_REQUEST,
        })
      }
    }

    return client.adminMenu.update({
      where: { id },
      data: {
        parentId: parentIdToApply,
        type: dto.type ?? menu.type,
        title: dto.title ?? menu.title,
        icon: dto.icon ?? menu.icon,
        code: nextType === AdminMenuType.DIRECTORY ? null : nextCode,
        path: dto.path ?? menu.path,
        description: dto.description ?? menu.description,
        i18nKey: dto.i18nKey ?? menu.i18nKey,
        sort: dto.sort ?? menu.sort,
        isShow: dto.isShow ?? menu.isShow,
      },
    })
  }

  async delete(id: string): Promise<void> {
    const client = this.getClient()
    const idsToDelete = await this.collectSubtreeIds(id, client)
    if (!idsToDelete.length) {
      throw new DomainException('Menu not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }
    await client.adminMenu.deleteMany({
      where: { id: { in: idsToDelete } },
    })
  }

  private async collectSubtreeIds(rootId: string, client: ReturnType<typeof this.getClient>) {
    const queue = [rootId]
    const collected: string[] = []
    while (queue.length) {
      const current = queue.pop()!
      const menu = await client.adminMenu.findUnique({
        where: { id: current },
        select: { id: true },
      })
      if (!menu) continue
      collected.push(current)
      const children = await client.adminMenu.findMany({
        where: { parentId: current },
        select: { id: true },
      })
      children.forEach(child => queue.push(child.id))
    }
    return collected
  }

  private async ensureParentMenu(parentId: string, client: ReturnType<typeof this.getClient>) {
    const parent = await client.adminMenu.findUnique({ where: { id: parentId } })
    if (!parent) {
      throw new DomainException('Parent menu not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }
    if (parent.type === AdminMenuType.FEATURE) {
      throw new DomainException('Feature menu cannot be a parent', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }
    return parent
  }
}


