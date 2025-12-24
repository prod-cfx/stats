import type { AdminDataPullTaskListQueryDto } from '../dto/admin-data-pull-task.dto'
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common'
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
import { BaseResponseDto } from '@/common/dto/base.dto'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { CreateAny, DeleteAny, ReadAny, RequireAuth, UpdateAny } from '@/modules/auth/decorators/access-control.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
import {
  AdminDataPullTaskResponseDto,
  CreateAdminDataPullTaskDto,
  UpdateAdminDataPullTaskDto,
} from '../dto/admin-data-pull-task.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { AdminDataPullTaskService } from '../services/admin-data-pull-task.service'

@ApiTags('admin-data-pull-tasks')
@Controller('admin/data-pull-tasks')
@ApiBearerAuth('bearer')
@RequireAuth()
@ApiExtraModels(BaseResponseDto, BasePaginationResponseDto, AdminDataPullTaskResponseDto)
export class AdminDataPullTaskController {
  constructor(private readonly service: AdminDataPullTaskService) {}

  @Get()
  @ReadAny(AppResource.DATA_PULL_TASK)
  @ApiOperation({ summary: '分页获取数据拉取任务列表' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码（从 1 开始）', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量', example: 20 })
  @ApiQuery({ name: 'key', required: false, type: String, description: '按 key 模糊搜索' })
  @ApiQuery({ name: 'name', required: false, type: String, description: '按名称模糊搜索' })
  @ApiQuery({ name: 'enabled', required: false, type: Boolean, description: '是否启用' })
  @ApiOkResponse({
    description: '获取列表成功',
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(AdminDataPullTaskResponseDto) },
            },
          },
        },
      ],
    },
  })
  async list(@Query() query: AdminDataPullTaskListQueryDto) {
    return this.service.list(query)
  }

  @Get(':id')
  @ReadAny(AppResource.DATA_PULL_TASK)
  @ApiOperation({ summary: '根据 ID 获取任务详情' })
  @ApiOkResponse({ description: '获取成功', type: AdminDataPullTaskResponseDto })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findById(id)
  }

  @Post()
  @CreateAny(AppResource.DATA_PULL_TASK)
  @ApiOperation({ summary: '创建数据拉取任务' })
  @ApiBody({ type: CreateAdminDataPullTaskDto })
  @ApiOkResponse({ description: '创建成功', type: AdminDataPullTaskResponseDto })
  async create(@Body() dto: CreateAdminDataPullTaskDto) {
    return this.service.create(dto)
  }

  @Put(':id')
  @UpdateAny(AppResource.DATA_PULL_TASK)
  @ApiOperation({ summary: '更新数据拉取任务' })
  @ApiBody({ type: UpdateAdminDataPullTaskDto })
  @ApiOkResponse({ description: '更新成功', type: AdminDataPullTaskResponseDto })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAdminDataPullTaskDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @DeleteAny(AppResource.DATA_PULL_TASK)
  @ApiOperation({ summary: '删除数据拉取任务' })
  @ApiOkResponse({ description: '删除成功' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.service.delete(id)
    return { success: true }
  }
}


