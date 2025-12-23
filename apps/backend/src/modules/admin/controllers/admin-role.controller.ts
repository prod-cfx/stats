import type { AdminRoleListQueryDto } from '../dto/admin-role-list.dto'
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { Transaction } from '@/common/decorators/transaction.decorator'
import { BaseResponseDto } from '@/common/dto/base.dto'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { CreateAny, DeleteAny, ReadAny, RequireAuth, UpdateAny } from '@/modules/auth/decorators/access-control.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
import { CreateAdminRoleDto, UpdateAdminRoleDto } from '../dto/admin-role.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { AdminRoleService } from '../services/admin-role.service'

@ApiTags('admin-role')
@Controller(['admin/role', 'admin/roles'])
@ApiBearerAuth('bearer')
@RequireAuth()
@ApiExtraModels(BaseResponseDto, BasePaginationResponseDto)
export class AdminRoleController {
  constructor(private readonly adminRoleService: AdminRoleService) {}

  @Get()
  @ReadAny(AppResource.ROLE)
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码（从 1 开始）', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量', example: 20 })
  @ApiQuery({ name: 'name', required: false, type: String, description: '按角色名称模糊搜索' })
  @ApiQuery({ name: 'code', required: false, type: String, description: '按角色编码模糊搜索' })
  @ApiOperation({ summary: '获取角色列表（分页）' })
  @ApiOkResponse({
    description: '获取列表成功',
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  code: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  menuPermissions: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  featurePermissions: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  apiPermissions: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      ],
    },
  })
  async list(@Query() query: AdminRoleListQueryDto) {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    return this.adminRoleService.list({
      page,
      limit,
      name: query.name,
      code: query.code,
    })
  }

  @Get(':id')
  @ReadAny(AppResource.ROLE)
  @ApiOperation({ summary: '获取角色详情' })
  @ApiOkResponse({ description: '获取成功' })
  async findOne(@Param('id') id: string) {
    return this.adminRoleService.findById(id)
  }

  @Post()
  @CreateAny(AppResource.ROLE)
  @Transaction()
  @ApiOperation({ summary: '创建角色' })
  @ApiBody({ type: CreateAdminRoleDto })
  @ApiOkResponse({ description: '创建成功' })
  async create(@Body() dto: CreateAdminRoleDto) {
    return this.adminRoleService.create(dto)
  }

  @Put(':id')
  @UpdateAny(AppResource.ROLE)
  @Transaction()
  @ApiOperation({ summary: '更新角色' })
  @ApiBody({ type: UpdateAdminRoleDto })
  @ApiOkResponse({ description: '更新成功' })
  async update(@Param('id') id: string, @Body() dto: UpdateAdminRoleDto) {
    return this.adminRoleService.update(id, dto)
  }

  @Delete(':id')
  @DeleteAny(AppResource.ROLE)
  @Transaction()
  @ApiOperation({ summary: '删除角色' })
  @ApiOkResponse({ description: '删除成功' })
  async delete(@Param('id') id: string) {
    await this.adminRoleService.delete(id)
  }
}

