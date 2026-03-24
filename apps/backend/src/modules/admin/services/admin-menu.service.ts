import type { CreateAdminMenuDto, UpdateAdminMenuDto } from '../dto/admin-menu.dto'
import type { AdminUserInfoDto } from '../dto/admin-user-info.dto'
import type { AdminMenu } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { AdminMenuType, PrincipalType } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { AdminMenuRepository } from '../repositories/admin-menu.repository'
import { buildAuthorizedMenuTree } from '../utils/menu-permissions.util'

interface AdminMenuTreeNode extends AdminMenu {
  children: AdminMenuTreeNode[]
}

@Injectable()
export class AdminMenuService {
  constructor(private readonly adminMenuRepository: AdminMenuRepository) {}

  async findMenuTree(): Promise<AdminMenuTreeNode[]> {
    const menus = await this.adminMenuRepository.findMany()

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
    return this.adminMenuRepository.findMany()
  }

  async findPermissionMenus(adminId: string): Promise<AdminUserInfoDto['menus']> {
    const assignments = await this.adminMenuRepository.findRoleAssignmentsByAdmin(adminId, PrincipalType.ADMIN)

    const permissionCodes = new Set<string>()
    assignments.forEach(({ role }) => {
      role.menuPermissions.forEach(code => permissionCodes.add(code))
    })

    const menus = await this.adminMenuRepository.findMany()

    return buildAuthorizedMenuTree(menus, permissionCodes)
  }

  async findById(id: string): Promise<AdminMenu> {
    const menu = await this.adminMenuRepository.findById(id)
    if (!menu) {
      throw new DomainException('Menu not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }
    return menu
  }

  async create(dto: CreateAdminMenuDto): Promise<AdminMenu> {
    const parentIdForCreate = dto.parentId?.trim()
    if (parentIdForCreate) {
      await this.ensureParentMenu(parentIdForCreate)
    }

    return this.adminMenuRepository.create({
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
    })
  }

  async update(id: string, dto: UpdateAdminMenuDto): Promise<AdminMenu> {
    const menu = await this.adminMenuRepository.findById(id)
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
      await this.ensureParentMenu(normalizedParentId)
      const subtreeIds = await this.collectSubtreeIds(id)
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

    return this.adminMenuRepository.update(id, {
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
    })
  }

  async delete(id: string): Promise<void> {
    const idsToDelete = await this.collectSubtreeIds(id)
    if (!idsToDelete.length) {
      throw new DomainException('Menu not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }
    await this.adminMenuRepository.deleteMany(idsToDelete)
  }

  private async collectSubtreeIds(rootId: string): Promise<string[]> {
    const queue = [rootId]
    const collected: string[] = []
    while (queue.length) {
      const current = queue.pop()!
      const menu = await this.adminMenuRepository.findByIdSelect(current)
      if (!menu) continue
      collected.push(current)
      const children = await this.adminMenuRepository.findChildrenIds(current)
      children.forEach(child => queue.push(child.id))
    }
    return collected
  }

  private async ensureParentMenu(parentId: string): Promise<AdminMenu> {
    const parent = await this.adminMenuRepository.findById(parentId)
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
