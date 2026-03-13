import type { Role } from '@/prisma/prisma.types'
import type { CreateAdminRoleDto, UpdateAdminRoleDto } from '../dto/admin-role.dto'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { AppRole } from '@/modules/auth/rbac/permissions'
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class AdminRoleService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async list(params: { page: number; limit: number; name?: string; code?: string }) {
    const client = this.getClient()
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

    const total = await client.role.count({ where })
    const items = await client.role.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    return {
      total,
      page,
      limit,
      items,
    }
  }

  async findById(id: string): Promise<Role> {
    const client = this.getClient()
    const role = await client.role.findUnique({
      where: { id },
    })
    if (!role) {
      throw new DomainException('Role not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }
    return role
  }

  async create(dto: CreateAdminRoleDto): Promise<Role> {
    const client = this.getClient()

    const existing = await client.role.findFirst({
      where: {
        OR: [{ code: dto.code }, { name: dto.name }],
      },
    })
    if (existing) {
      throw new DomainException('Role already exists', {
        code: ErrorCode.CONFLICT,
        status: HttpStatus.CONFLICT,
      })
    }

    return client.role.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        menuPermissions: dto.menuPermissions ?? [],
        featurePermissions: dto.featurePermissions ?? [],
        apiPermissions: dto.apiPermissions ?? [],
      },
    })
  }

  async update(id: string, dto: UpdateAdminRoleDto): Promise<Role> {
    const client = this.getClient()

    const role = await client.role.findUnique({ where: { id } })
    if (!role) {
      throw new DomainException('Role not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    return client.role.update({
      where: { id },
      data: {
        name: dto.name ?? role.name,
        description: dto.description ?? role.description,
        menuPermissions: dto.menuPermissions ?? role.menuPermissions,
        featurePermissions: dto.featurePermissions ?? role.featurePermissions,
        apiPermissions: dto.apiPermissions ?? role.apiPermissions,
      },
    })
  }

  async delete(id: string): Promise<void> {
    const client = this.getClient()
    const role = await client.role.findUnique({ where: { id } })
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

    await client.roleAssignment.deleteMany({
      where: { roleId: id },
    })
    await client.role.delete({
      where: { id },
    })
  }
}


