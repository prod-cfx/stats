import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Transaction } from '@/common/decorators/transaction.decorator'
import { CreateAny, DeleteAny, ReadAny, RequireAuth, UpdateAny } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
import { CreateAdminMenuDto, UpdateAdminMenuDto } from '../dto/admin-menu.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { AdminMenuService } from '../services/admin-menu.service'

@ApiTags('admin-menu')
@Controller(['admin/menu', 'admin/menus'])
@ApiBearerAuth('bearer')
@RequireAuth()
export class AdminMenuController {
  constructor(private readonly adminMenuService: AdminMenuService) {}

  @Get()
  @ReadAny(AppResource.ADMIN_MENU)
  @ApiOperation({ summary: '获取菜单树' })
  @ApiOkResponse({ description: '获取成功' })
  async findMenuTree() {
    return this.adminMenuService.findMenuTree()
  }

  @Get('flat')
  @ReadAny(AppResource.ADMIN_MENU)
  @ApiOperation({ summary: '获取菜单扁平化列表' })
  @ApiOkResponse({ description: '获取成功' })
  async findFlat() {
    return this.adminMenuService.findFlat()
  }

  @Get('permission')
  @ReadAny(AppResource.ADMIN_MENU)
  @ApiOperation({ summary: '获取当前管理员有权限的菜单和按钮列表' })
  @ApiOkResponse({ description: '获取成功' })
  async findPermissionMenus(@CurrentUser('id') adminId: string) {
    return this.adminMenuService.findPermissionMenus(adminId)
  }

  @Get(':id')
  @ReadAny(AppResource.ADMIN_MENU)
  @ApiOperation({ summary: '根据 ID 获取菜单详情' })
  @ApiOkResponse({ description: '获取成功' })
  async findById(@Param('id') id: string) {
    return this.adminMenuService.findById(id)
  }

  @Post()
  @CreateAny(AppResource.ADMIN_MENU)
  @Transaction()
  @ApiOperation({ summary: '创建菜单' })
  @ApiBody({ type: CreateAdminMenuDto })
  @ApiOkResponse({ description: '创建成功' })
  async create(@Body() dto: CreateAdminMenuDto) {
    return this.adminMenuService.create(dto)
  }

  @Put(':id')
  @UpdateAny(AppResource.ADMIN_MENU)
  @Transaction()
  @ApiOperation({ summary: '更新菜单' })
  @ApiBody({ type: UpdateAdminMenuDto })
  @ApiOkResponse({ description: '更新成功' })
  async update(@Param('id') id: string, @Body() dto: UpdateAdminMenuDto) {
    return this.adminMenuService.update(id, dto)
  }

  @Delete(':id')
  @DeleteAny(AppResource.ADMIN_MENU)
  @Transaction()
  @ApiOperation({ summary: '删除菜单（包含直接子菜单）' })
  @ApiOkResponse({ description: '删除成功' })
  async delete(@Param('id') id: string) {
    await this.adminMenuService.delete(id)
  }
}

