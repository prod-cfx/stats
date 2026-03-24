/* eslint-disable perfectionist/sort-imports */
import type { AdminUserInfoDto } from '../dto/admin-user-info.dto'
import type { AdminAssignedRoleDto, AdminUserDto } from '../dto/admin-user.dto'
import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { AdminUser } from '@/prisma/prisma.types'
import { PrincipalType, ErrorCode } from '@ai/shared'
import { compare, hash } from 'bcrypt'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
import { buildAuthorizedMenuTree } from '../utils/menu-permissions.util'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { AdminUserRepository } from '../repositories/admin-user.repository'

interface AdminJwtPayload {
  sub: string
  principalType: 'admin'
  roles: string[]
  tokenType: 'access' | 'refresh'
}

@Injectable()
export class AdminUserService {
  private readonly passwordSaltRounds: number

  constructor(
    private readonly adminUserRepository: AdminUserRepository,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {
    const roundsFromConfig =
      this.configService.get<number>('auth.passwordSaltRounds') ??
      this.configService.get<number>('BCRYPT_SALT_ROUNDS')
    const parsed = Number(roundsFromConfig)
    this.passwordSaltRounds = Number.isFinite(parsed) && parsed > 0 ? parsed : 12
  }

  private async hashPassword(plain: string): Promise<string> {
    return hash(plain, this.passwordSaltRounds)
  }

  private async verifyPassword(plain: string, hashed: string): Promise<boolean> {
    if (!hashed) return false
    return compare(plain, hashed)
  }

  private async getUserRoleDetails(adminUserId: string): Promise<AdminAssignedRoleDto[]> {
    const assignments = await this.adminUserRepository.findRoleAssignments(adminUserId, PrincipalType.ADMIN)
    return assignments.map(({ role }) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description ?? null,
    }))
  }

  private buildInvalidCredentialException() {
    return new DomainException('Invalid credentials', {
      code: ErrorCode.AUTH_UNAUTHORIZED,
      status: HttpStatus.UNAUTHORIZED,
    })
  }

  private mapToDto(user: AdminUser, roles: AdminAssignedRoleDto[]): AdminUserDto {
    return {
      id: user.id,
      username: user.username,
      nickName: user.nickName ?? null,
      email: user.email ?? null,
      avatarUrl: user.avatarUrl ?? null,
      phone: user.phone ?? null,
      isFrozen: user.isFrozen,
      roles,
    }
  }

  async findByUsername(username: string): Promise<AdminUser | null> {
    return this.adminUserRepository.findByUsername(username)
  }

  async getUserRoles(adminUserId: string): Promise<string[]> {
    const assignments = await this.adminUserRepository.findRoleCodesByAdmin(adminUserId, PrincipalType.ADMIN)
    return assignments.map(a => a.role.code)
  }

  async login(username: string, password: string) {
    const user = await this.adminUserRepository.findByUsername(username)

    if (!user) {
      throw this.buildInvalidCredentialException()
    }

    if (user.isFrozen) {
      throw new DomainException('Admin account is frozen', {
        code: ErrorCode.FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      })
    }

    const passwordOk = await this.verifyPassword(password, user.password)
    if (!passwordOk) {
      throw this.buildInvalidCredentialException()
    }

    const roles = await this.getUserRoles(user.id)
    const roleDetails = await this.getUserRoleDetails(user.id)
    const basePayload = {
      sub: user.id,
      principalType: 'admin' as const,
      roles,
    }

    const accessTokenExpiresIn =
      this.configService.get<string>('jwt.expiresIn') ??
      this.configService.get<string>('JWT_EXPIRES_IN') ??
      '30m'

    const refreshTokenExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') ??
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ??
      '30d'

    const accessToken = await this.jwtService.signAsync(
      { ...basePayload, tokenType: 'access' },
      {
      expiresIn: accessTokenExpiresIn as import('@nestjs/jwt').JwtSignOptions['expiresIn'],
      },
    )

    const refreshToken = await this.jwtService.signAsync(
      { ...basePayload, tokenType: 'refresh' },
      {
        expiresIn: refreshTokenExpiresIn as import('@nestjs/jwt').JwtSignOptions['expiresIn'],
      },
    )

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTokenExpiresIn,
      user: this.mapToDto(user, roleDetails),
    }
  }

  async list(params: { page: number; limit: number; keyword?: string }) {
    const { page, limit, keyword } = params
    const where =
      keyword && keyword.trim().length > 0
        ? {
            OR: [
              { username: { contains: keyword, mode: 'insensitive' as const } },
              { nickName: { contains: keyword, mode: 'insensitive' as const } },
              { email: { contains: keyword, mode: 'insensitive' as const } },
            ],
          }
        : {}

    const total = await this.adminUserRepository.count(where)
    const items = await this.adminUserRepository.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    const userIds = items.map(u => u.id)
    const assignments =
      userIds.length === 0
        ? []
        : await this.adminUserRepository.findRoleAssignmentsByAdminsBulk(userIds, PrincipalType.ADMIN)

    const roleMap = new Map<string, AdminAssignedRoleDto[]>()
    assignments.forEach(({ principalId, role }) => {
      const list = roleMap.get(principalId) ?? []
      list.push({
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description ?? null,
      })
      roleMap.set(principalId, list)
    })

    return new BasePaginationResponseDto(total, page, limit, items.map(user => this.mapToDto(user, roleMap.get(user.id) ?? [])))
  }

  async findById(id: string): Promise<AdminUserDto> {
    const user = await this.adminUserRepository.findById(id)
    if (!user) {
      throw new DomainException('Admin user not found', {
        code: ErrorCode.USER_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }
    const roles = await this.getUserRoleDetails(user.id)
    return this.mapToDto(user, roles)
  }

  async getAdminInfo(id: string): Promise<AdminUserInfoDto> {
    const user = await this.adminUserRepository.findById(id)
    if (!user) {
      throw new DomainException('Admin user not found', {
        code: ErrorCode.USER_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    const roleCodes = await this.getUserRoles(user.id)
    const roles =
      roleCodes.length > 0
        ? await this.adminUserRepository.findRolesByCode(roleCodes)
        : []

    const menuPermissionSet = new Set<string>()
    const featurePermissions = new Set<string>()
    const apiPermissions = new Set<string>()

    roles.forEach(role => {
      role.menuPermissions.forEach(code => menuPermissionSet.add(code))
      role.featurePermissions.forEach(code => featurePermissions.add(code))
      role.apiPermissions.forEach(code => apiPermissions.add(code))
    })

    const menus = await this.adminUserRepository.findMenusByOrderBy()

    const filteredMenus = buildAuthorizedMenuTree(menus, menuPermissionSet)

    return {
      id: user.id,
      username: user.username,
      nickName: user.nickName ?? null,
      headPic: user.avatarUrl ?? null,
      menus: filteredMenus,
      menuPermissions: Array.from(menuPermissionSet),
      featurePermissions: Array.from(featurePermissions),
      apiPermissions: Array.from(apiPermissions),
    }
  }

  async refresh(refreshToken: string) {
    let payload: AdminJwtPayload
    try {
      payload = (await this.jwtService.verifyAsync(refreshToken)) as AdminJwtPayload
    } catch {
      throw new DomainException('Invalid refresh token', {
        code: ErrorCode.AUTH_UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    if (!payload?.sub || payload.principalType !== 'admin' || payload.tokenType !== 'refresh') {
      throw new DomainException('Invalid refresh token', {
        code: ErrorCode.AUTH_UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const user = await this.adminUserRepository.findById(payload.sub)
    if (!user || user.isFrozen) {
      throw new DomainException('Admin user not found or frozen', {
        code: ErrorCode.AUTH_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      })
    }

    const roles = await this.getUserRoles(user.id)
    const basePayload = {
      sub: user.id,
      principalType: 'admin' as const,
      roles,
    }

    const accessTokenExpiresIn =
      this.configService.get<string>('jwt.expiresIn') ??
      this.configService.get<string>('JWT_EXPIRES_IN') ??
      '30m'

    const refreshTokenExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') ??
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ??
      '30d'

    const accessToken = await this.jwtService.signAsync(
      { ...basePayload, tokenType: 'access' },
      {
        expiresIn: accessTokenExpiresIn as import('@nestjs/jwt').JwtSignOptions['expiresIn'],
      },
    )
    const newRefreshToken = await this.jwtService.signAsync(
      { ...basePayload, tokenType: 'refresh' },
      {
        expiresIn: refreshTokenExpiresIn as import('@nestjs/jwt').JwtSignOptions['expiresIn'],
      },
    )

    const roleDetails = await this.getUserRoleDetails(user.id)
    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: accessTokenExpiresIn,
      user: this.mapToDto(user, roleDetails),
    }
  }

  async registerInitialAdmin(data: {
    username: string
    password: string
    nickName?: string
    email?: string
    avatarUrl?: string
    phone?: string
    roleCodes?: string[]
  }): Promise<AdminUserDto> {
    const adminCount = await this.adminUserRepository.count()
    if (adminCount > 0) {
      throw new DomainException('Initial admin already registered', {
        code: ErrorCode.CONFLICT,
        status: HttpStatus.CONFLICT,
      })
    }

    const roleCodes = data.roleCodes && data.roleCodes.length > 0 ? data.roleCodes : ['SUPER_ADMIN']
    const roles = await this.adminUserRepository.findRolesByIdSelect(roleCodes)

    if (roles.length !== roleCodes.length) {
      throw new DomainException('Default roles not found', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    return this.create({
      username: data.username,
      password: data.password,
      nickName: data.nickName,
      email: data.email,
      avatarUrl: data.avatarUrl,
      phone: data.phone,
      roleIds: roles.map(role => role.id),
    })
  }

  async create(data: {
    username: string
    password: string
    nickName?: string
    email?: string
    avatarUrl?: string
    phone?: string
    roleIds?: string[]
  }): Promise<AdminUserDto> {
    const existing = await this.adminUserRepository.findByUsername(data.username)
    if (existing) {
      throw new DomainException('Admin account already exists', {
        code: ErrorCode.CONFLICT,
        status: HttpStatus.CONFLICT,
        args: { username: data.username },
      })
    }

    const hashedPassword = await this.hashPassword(data.password)

    const user = await this.adminUserRepository.create({
      username: data.username,
      password: hashedPassword,
      nickName: data.nickName,
      email: data.email,
      avatarUrl: data.avatarUrl,
      phone: data.phone,
    })

    const roleIds = data.roleIds ?? []
    if (roleIds.length > 0) {
      await this.assignRoles(user.id, roleIds)
    }

    const roles = await this.getUserRoleDetails(user.id)
    return this.mapToDto(user, roles)
  }

  async update(
    id: string,
    data: {
      nickName?: string
      email?: string
      avatarUrl?: string
      phone?: string
      isFrozen?: boolean
      roleIds?: string[]
    },
  ): Promise<AdminUserDto> {
    const user = await this.adminUserRepository.findById(id)
    if (!user) {
      throw new DomainException('Admin user not found', {
        code: ErrorCode.USER_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    await this.adminUserRepository.update(id, {
      nickName: data.nickName,
      email: data.email,
      avatarUrl: data.avatarUrl,
      phone: data.phone,
      isFrozen: data.isFrozen,
    })

    if (data.roleIds) {
      await this.replaceRoles(id, data.roleIds)
    }

    const updated = await this.adminUserRepository.findById(id)
    if (!updated) {
      throw new DomainException('Admin user not found', {
        code: ErrorCode.USER_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    const roles = await this.getUserRoleDetails(updated.id)
    return this.mapToDto(updated, roles)
  }

  async delete(id: string): Promise<void> {
    const user = await this.adminUserRepository.findById(id)
    if (!user) {
      throw new DomainException('Admin user not found', {
        code: ErrorCode.USER_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    await this.adminUserRepository.deleteRoleAssignments(id, PrincipalType.ADMIN)
    await this.adminUserRepository.delete(id)
  }

  private async assignRoles(userId: string, roleIds: string[]) {
    if (!roleIds.length) return
    const roles = await this.adminUserRepository.findRolesByIdSelect(roleIds)

    if (roles.length !== roleIds.length) {
      throw new DomainException('Some roles do not exist', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    await this.adminUserRepository.createRoleAssignments(
      roles.map(role => ({
        principalId: userId,
        principalType: PrincipalType.ADMIN,
        roleId: role.id,
      })),
    )
  }

  private async replaceRoles(userId: string, roleIds: string[]) {
    await this.adminUserRepository.deleteRoleAssignments(userId, PrincipalType.ADMIN)
    if (roleIds.length > 0) {
      await this.assignRoles(userId, roleIds)
    }
  }
}
