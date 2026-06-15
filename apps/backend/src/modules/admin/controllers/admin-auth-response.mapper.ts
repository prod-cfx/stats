import type { AdminAuthResponseDto, AdminProfileDto } from '../dto/admin-auth.dto'
import type { AdminUserDto } from '../dto/admin-user.dto'
import type { AdminUserService } from '../services/admin-user.service'

type AdminAuthService = Pick<AdminUserService, 'getAdminInfo'>
type AdminAuthServiceResult = Awaited<ReturnType<AdminUserService['login']>>

export async function buildAdminAuthResponse(
  adminUserService: AdminAuthService,
  result: AdminAuthServiceResult,
): Promise<AdminAuthResponseDto> {
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
    admin: await buildAdminProfile(adminUserService, result.user),
  }
}

export async function buildAdminProfile(
  adminUserService: AdminAuthService,
  user: AdminUserDto,
): Promise<AdminProfileDto> {
  const info = await adminUserService.getAdminInfo(user.id)
  return {
    id: user.id,
    username: user.username,
    email: user.email ?? null,
    nickName: user.nickName ?? null,
    isFrozen: user.isFrozen,
    menuPermissions: info.menuPermissions,
  }
}
