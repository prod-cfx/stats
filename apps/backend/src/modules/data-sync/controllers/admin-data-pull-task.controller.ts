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
// DTO 必须使用值导入以保留运行时类型元数据，供 ValidationPipe 和 Swagger 使用
// eslint-disable-next-line ts/consistent-type-imports
import {
  AdminDataPullExecutionResponseDto,
  AdminDataPullTaskListQueryDto,
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

  @Get('registered-keys')
  @ReadAny(AppResource.DATA_PULL_TASK)
  @ApiOperation({ summary: '获取所有已注册的 Job key 列表' })
  @ApiOkResponse({
    description: '获取成功',
    schema: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          items: { type: 'string' },
          example: ['example-kline-1m', 'example-news-latest', 'coinglass-heatmap'],
        },
      },
    },
  })
  getRegisteredKeys() {
    return { keys: this.service.getRegisteredKeys() }
  }

  @Get('registered-jobs')
  @ReadAny(AppResource.DATA_PULL_TASK)
  @ApiOperation({ summary: '获取所有已注册的 Job 详细信息（包含 meta 配置格式说明）' })
  @ApiOkResponse({
    description: '获取成功',
    schema: {
      type: 'object',
      properties: {
        jobs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', example: 'coinglass-aggregated-liquidation' },
              name: { type: 'string', example: 'Coinglass 聚合清算数据' },
              metaSchema: {
                type: 'object',
                nullable: true,
                properties: {
                  description: { type: 'string' },
                  fields: { type: 'array' },
                  example: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
  })
  getRegisteredJobs() {
    return { jobs: this.service.getRegisteredJobs() }
  }

  @Get(':id/executions')
  @ReadAny(AppResource.DATA_PULL_TASK)
  @ApiOperation({ summary: '分页获取指定任务的执行历史' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码（从 1 开始）', example: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '每页数量',
    example: 20,
  })
  @ApiOkResponse({
    description: '获取执行历史成功',
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(AdminDataPullExecutionResponseDto) },
            },
          },
        },
      ],
    },
  })
  async listExecutions(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.service.listExecutions(id, Number(page) || 1, Number(limit) || 20)
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



