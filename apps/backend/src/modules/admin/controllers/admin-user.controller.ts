import type { AdminUserListQueryDto } from '../dto/admin-user-list.dto'
import { Transactional } from '@nestjs-cls/transactional'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { BaseResponseDto } from '@/common/dto/base.dto'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { CreateAny, DeleteAny, ReadAny, RequireAuth, UpdateAny } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
import { AdminLoginDto, AdminRefreshDto } from '../dto/admin-login.dto'
import { AdminUserInfoDto } from '../dto/admin-user-info.dto'
import { AdminUserDto, CreateAdminUserDto, UpdateAdminUserDto } from '../dto/admin-user.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { AdminUserService } from '../services/admin-user.service'

@ApiTags('admin-user')
@Controller(['admin/user', 'admin/users'])
@ApiBearerAuth('bearer')
@ApiExtraModels(BaseResponseDto, BasePaginationResponseDto, AdminUserDto, AdminUserInfoDto)
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Post('login')
  @ApiOperation({ summary: '管理员登录' })
  @ApiBody({ type: AdminLoginDto })
  @ApiOkResponse({
    description: '登录成功',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'string' },
        user: { $ref: getSchemaPath(AdminUserDto) },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: AdminLoginDto) {
    return this.adminUserService.login(body.username, body.password)
  }

  @Post('refresh')
  @ApiOperation({ summary: '刷新管理员访问令牌' })
  @ApiBody({ type: AdminRefreshDto })
  @ApiOkResponse({
    description: '刷新成功',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'string' },
        user: { $ref: getSchemaPath(AdminUserDto) },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: AdminRefreshDto) {
    return this.adminUserService.refresh(body.refreshToken)
  }

  @Get('info')
  @RequireAuth()
  @ReadAny(AppResource.ADMIN_USER)
  @ApiOperation({ summary: '获取当前登录管理员信息' })
  @ApiOkResponse({ description: '获取成功', type: AdminUserInfoDto })
  async info(@CurrentUser('id') adminId: string) {
    return this.adminUserService.getAdminInfo(adminId)
  }

  @Get()
  @RequireAuth()
  @ReadAny(AppResource.ADMIN_USER)
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码（从 1 开始）', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量', example: 20 })
  @ApiQuery({ name: 'keyword', required: false, type: String, description: '按用户名模糊搜索' })
  @ApiOperation({ summary: '获取管理员列表（分页）' })
  @ApiOkResponse({
    description: '获取列表成功',
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(AdminUserDto) },
            },
          },
        },
      ],
    },
  })
  async list(@Query() query: AdminUserListQueryDto) {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    return this.adminUserService.list({
      page,
      limit,
      keyword: query.keyword,
    })
  }

  @Get(':id')
  @RequireAuth()
  @ReadAny(AppResource.ADMIN_USER)
  @ApiOperation({ summary: '根据 ID 获取管理员详情' })
  @ApiOkResponse({ description: '获取成功', type: AdminUserDto })
  async findOne(@Param('id') id: string) {
    return this.adminUserService.findById(id)
  }

  @Post()
  @RequireAuth()
  @CreateAny(AppResource.ADMIN_USER)
  @Transactional()
  @ApiOperation({ summary: '创建管理员账号' })
  @ApiBody({ type: CreateAdminUserDto })
  @ApiCreatedResponse({ description: '创建成功', type: AdminUserDto })
  async create(@Body() body: CreateAdminUserDto) {
    return this.adminUserService.create(body)
  }

  @Put(':id')
  @RequireAuth()
  @UpdateAny(AppResource.ADMIN_USER)
  @Transactional()
  @ApiOperation({ summary: '更新管理员账号' })
  @ApiBody({ type: UpdateAdminUserDto })
  @ApiOkResponse({ description: '更新成功', type: AdminUserDto })
  async update(@Param('id') id: string, @Body() body: UpdateAdminUserDto) {
    return this.adminUserService.update(id, body)
  }

  @Delete(':id')
  @RequireAuth()
  @DeleteAny(AppResource.ADMIN_USER)
  @Transactional()
  @ApiOperation({ summary: '删除管理员账号' })
  @ApiOkResponse({ description: '删除成功' })
  async delete(@Param('id') id: string) {
    await this.adminUserService.delete(id)
  }
}

