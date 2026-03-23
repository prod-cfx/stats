import type { CreateAdminRoleDto, UpdateAdminRoleDto } from '../dto/admin-role.dto'
import type { Role } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
import { AppRole } from '@/modules/auth/rbac/permissions'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { AdminRoleRepository } from '../repositories/admin-role.repository'

@Injectable()
export class AdminRoleService {
  constructor(private readonly adminRoleRepository: AdminRoleRepository) {}

  async list(params: { page: number; limit: number; name?: string; code?: string }) {
    const { page, limit, name, code } = params

    const where =
      (name && name.trim().length > 0) || (code && code.trim().length > 0)
        ? {
            AND: [
              name && name.trim().length > 0
                ? { name: { contains: name, mode: 'insensitive' as const } }
                : {},
              code && code.trim().length > 0
                ? { code: { contains: code, mode: 'insensitive' as const } }
                : {},
            ],
          }
        : {}

    const total = await this.adminRoleRepository.count(where)
    const items = await this.adminRoleRepository.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    return new BasePaginationResponseDto(total, page, limit, items)
  }

  async findById(id: string): Promise<Role> {
    const role = await this.adminRoleRepository.findById(id)
    if (!role) {
      throw new DomainException('Role not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }
    return role
  }

  async create(dto: CreateAdminRoleDto): Promise<Role> {
    const existing = await this.adminRoleRepository.findFirst({
      OR: [{ code: dto.code }, { name: dto.name }],
    })
    if (existing) {
      throw new DomainException('Role already exists', {
        code: ErrorCode.CONFLICT,
        status: HttpStatus.CONFLICT,
      })
    }

    return this.adminRoleRepository.create({
      code: dto.code,
      name: dto.name,
      description: dto.description,
      menuPermissions: dto.menuPermissions ?? [],
      featurePermissions: dto.featurePermissions ?? [],
      apiPermissions: dto.apiPermissions ?? [],
    })
  }

  async update(id: string, dto: UpdateAdminRoleDto): Promise<Role> {
    const role = await this.adminRoleRepository.findById(id)
    if (!role) {
      throw new DomainException('Role not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    return this.adminRoleRepository.update(id, {
      name: dto.name ?? role.name,
      description: dto.description ?? role.description,
      menuPermissions: dto.menuPermissions ?? role.menuPermissions,
      featurePermissions: dto.featurePermissions ?? role.featurePermissions,
      apiPermissions: dto.apiPermissions ?? role.apiPermissions,
    })
  }

  async delete(id: string): Promise<void> {
    const role = await this.adminRoleRepository.findById(id)
    if (!role) {
      throw new DomainException('Role not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    const reservedCodes = new Set<AppRole>([
      AppRole.USER,
      AppRole.MODERATOR,
      AppRole.ADMIN,
      AppRole.SUPER_ADMIN,
    ])
    if (reservedCodes.has(role.code as AppRole)) {
      throw new DomainException('Built-in role cannot be deleted', {
        code: ErrorCode.FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      })
    }

    await this.adminRoleRepository.deleteAssignmentsByRole(id)
    await this.adminRoleRepository.delete(id)
  }
}
