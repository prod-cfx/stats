/* eslint-disable ts/consistent-type-imports -- NestJS 装饰器需要运行时导入以保留类型元数据 */
import { ErrorCode } from '@ai/shared'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, Patch, Post, Query } from '@nestjs/common'
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'

import { DomainException } from '@/common/exceptions/domain.exception'
import { SignalGeneratorService } from '@/modules/strategy-signals/services/signal-generator.service'

import { CreateStrategyInstanceDto } from '../dto/create-strategy-instance.dto'
import { StrategyInstanceListQueryDto } from '../dto/strategy-instance-list-query.dto'
import { StrategyInstanceResponseDto } from '../dto/strategy-instance-response.dto'
import { StrategyInstanceSubscriptionDetailsDto } from '../dto/strategy-instance-subscription-details.dto'
import { SubscriptionDetailsQueryDto } from '../dto/subscription-details-query.dto'
import {
  TestStrategyInstanceDto,
  TestStrategyInstanceResultDto,
} from '../dto/test-strategy-instance.dto'
import { UpdateStrategyInstanceDto } from '../dto/update-strategy-instance.dto'
import { StrategyInstancesService } from '../services/strategy-instances.service'

@ApiTags('ops/strategy-instances')
@ApiExtraModels(
  BasePaginationResponseDto,
  StrategyInstanceResponseDto,
  TestStrategyInstanceDto,
  TestStrategyInstanceResultDto,
)
@Controller('ops/strategy-instances')
export class OpsStrategyInstancesController {
  private readonly logger = new Logger(OpsStrategyInstancesController.name)

  constructor(
    private readonly instancesService: StrategyInstancesService,
    private readonly signalGenerator: SignalGeneratorService,
  ) {}

  @Post()
  @ApiOperation({ summary: '创建策略实例' })
  @ApiResponse({ status: 201, type: StrategyInstanceResponseDto })
  async create(
    @Body() dto: CreateStrategyInstanceDto,
  ): Promise<StrategyInstanceResponseDto> {
    return this.instancesService.createInstance(dto, dto.createdBy)
  }

  @Get()
  @ApiOperation({ summary: '获取策略实例列表' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(StrategyInstanceResponseDto) },
            },
          },
        },
      ],
    },
  })
  async list(
    @Query() query: StrategyInstanceListQueryDto,
  ): Promise<BasePaginationResponseDto<StrategyInstanceResponseDto>> {
    return this.instancesService.listInstances(query)
  }

  @Get(':id/subscriptions')
  @ApiOperation({ summary: '获取策略实例订阅详情' })
  @ApiResponse({ status: 200, type: StrategyInstanceSubscriptionDetailsDto })
  async getSubscriptionDetails(
    @Param('id') id: string,
    @Query() query: SubscriptionDetailsQueryDto,
  ): Promise<StrategyInstanceSubscriptionDetailsDto> {
    return this.instancesService.getInstanceSubscriptionDetails(
      id,
      query.page,
      query.limit,
    )
  }

  @Get(':id')
  @ApiOperation({ summary: '获取策略实例详情' })
  @ApiResponse({ status: 200, type: StrategyInstanceResponseDto })
  async detail(@Param('id') id: string): Promise<StrategyInstanceResponseDto> {
    return this.instancesService.getInstanceDetail(id)
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新策略实例' })
  @ApiResponse({ status: 200, type: StrategyInstanceResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStrategyInstanceDto,
  ): Promise<StrategyInstanceResponseDto> {
    return this.instancesService.updateInstance(id, dto, dto.updatedBy)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除策略实例（仅 draft 状态）' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.instancesService.deleteInstance(id)
  }

  @Get(':id/test-run/prefill')
  @ApiOperation({
    summary: '获取实例检查默认请求体（多 Leg 多周期自动填充）',
    description:
      '根据策略模板的 legs 和 dataRequirements，从行情表中拉取最近一段 K 线数据，按 multiLegData 结构返回，方便调用方快速填充调试参数。',
  })
  @ApiResponse({ status: 200, type: TestStrategyInstanceDto })
  async buildTestPayload(@Param('id') id: string): Promise<TestStrategyInstanceDto> {
    return this.instancesService.buildTestPayload(id)
  }

  @Post(':id/test-run')
  @ApiOperation({
    summary: '主动触发策略实例检查（调试用，不会产生真实信号）',
    description:
      '根据传入的市场数据执行关联策略模板的脚本，返回脚本结果及填充后的 Prompt，用于本地调试。',
  })
  @ApiResponse({ status: 200, type: TestStrategyInstanceResultDto })
  async testRun(
    @Param('id') id: string,
    @Body() dto: TestStrategyInstanceDto,
  ): Promise<TestStrategyInstanceResultDto> {
    return this.instancesService.testInstance(id, dto)
  }

  @Post(':id/generate-signal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '手动触发策略实例信号生成',
    description:
      '手动触发指定策略实例的信号生成流程。会根据当前市场数据执行策略脚本、调用 AI 并生成真实交易信号。' +
      '用于测试或紧急情况下手动触发信号生成。',
  })
  @ApiResponse({
    status: 200,
    description: '信号生成任务已触发',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: '信号生成任务已触发' },
        instanceId: { type: 'string', example: 'cmioxy4yg03zl3eh8gzvaaimd' },
      },
    },
  })
  async generateSignal(@Param('id') id: string): Promise<{ message: string; instanceId: string }> {
    this.logger.log(`运营接口手动触发策略实例 ${id} 的信号生成`)

    // 在返回前同步验证所有必须条件（status、mode、template、config 等）
    // 避免无效实例/禁用配置下误报成功，确保调用方获得准确的错误反馈
    try {
      await this.signalGenerator.validateManualTriggerTarget(id)
    }
    catch (error) {
      const message = (error as Error).message
      this.logger.warn(`手动触发验证失败: ${message}`)
      
      // 将验证错误映射为适当的 HTTP 状态码
      if (message.includes('not found')) {
        throw new DomainException('strategy_instance.not_found', {
          code: ErrorCode.NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        })
      }
      if (message.includes('disabled via configuration')) {
        throw new DomainException('strategy_instance.signal_generation_disabled', {
          code: ErrorCode.STRATEGY_INSTANCE_SIGNAL_DISABLED,
          status: HttpStatus.BAD_REQUEST,
        })
      }
      throw new DomainException('strategy_instance.signal_generation_failed', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    // 验证通过后，异步触发信号生成（不阻塞 AI 调用），手动触发时跳过 cooldown 检查
    setImmediate(() => {
      this.signalGenerator.generateSignalForInstance(id, { skipCooldown: true }).catch(error => {
        this.logger.error(`手动触发实例 ${id} 信号生成失败: ${error.message}`, error.stack)
      })
    })

    return {
      message: '信号生成任务已触发，请稍后查看信号列表',
      instanceId: id,
    }
  }
}
