import type { AdminUserDto } from '../dto/admin-user.dto'
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { AdminAuthResponseDto, AdminProfileDto, AdminRegisterDto } from '../dto/admin-auth.dto'
import { AdminLoginDto, AdminRefreshDto } from '../dto/admin-login.dto'
// eslint-disable-next-line ts/consistent-type-imports -- NestJS 依赖运行时类型，需保持值导入
import { AdminUserService } from '../services/admin-user.service'

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Post('login')
  @ApiOperation({ summary: '管理员登录' })
  @ApiBody({ type: AdminLoginDto })
  @ApiOkResponse({ description: '登录成功', type: AdminAuthResponseDto })
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: AdminLoginDto): Promise<AdminAuthResponseDto> {
    const result = await this.adminUserService.login(body.username, body.password)
    return this.buildAuthResponse(result)
  }

  @Post('refresh')
  @ApiOperation({ summary: '刷新管理员访问令牌' })
  @ApiBody({ type: AdminRefreshDto })
  @ApiOkResponse({ description: '刷新成功', type: AdminAuthResponseDto })
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: AdminRefreshDto): Promise<AdminAuthResponseDto> {
    const result = await this.adminUserService.refresh(body.refreshToken)
    return this.buildAuthResponse(result)
  }

  @Post('register')
  @ApiOperation({ summary: '注册首个管理员账号' })
  @ApiBody({ type: AdminRegisterDto })
  @ApiOkResponse({ description: '注册成功', type: AdminAuthResponseDto })
  async register(@Body() body: AdminRegisterDto): Promise<AdminAuthResponseDto> {
    await this.adminUserService.registerInitialAdmin(body)
    const result = await this.adminUserService.login(body.username, body.password)
    return this.buildAuthResponse(result)
  }

  @Get('me')
  @Auth()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '获取当前管理员资料' })
  @ApiOkResponse({ description: '获取成功', schema: { $ref: getSchemaPath(AdminProfileDto) } })
  async me(@CurrentUser('id') adminId: string): Promise<AdminProfileDto> {
    const user = await this.adminUserService.findById(adminId)
    return this.buildProfile(user)
  }

  private async buildAuthResponse(result: Awaited<ReturnType<AdminUserService['login']>>): Promise<AdminAuthResponseDto> {
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      admin: await this.buildProfile(result.user),
    }
  }

  private async buildProfile(user: AdminUserDto): Promise<AdminProfileDto> {
    const info = await this.adminUserService.getAdminInfo(user.id)
    return {
      id: user.id,
      username: user.username,
      email: user.email ?? null,
      nickName: user.nickName ?? null,
      isFrozen: user.isFrozen,
      menuPermissions: info.menuPermissions,
    }
  }
}
