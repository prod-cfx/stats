import type { MessageEvent } from '@nestjs/common'
import type { Observable } from 'rxjs'
import type { LlmOpsTestLogEvent } from '../llm-ops-test-log.events'
import { Body, Controller, Delete, Get, Logger, Param, Post, Put, Query, Sse } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- 需要用于依赖注入，不能使用 import type
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { filter, fromEvent, map, merge, of } from 'rxjs'

import { BaseResponseDto } from '@/common/dto/base.dto'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { createHeartbeatStream } from '@/common/utils/sse.utils'

import { CreateLlmStrategyInstanceDto } from '../dto/create-llm-strategy-instance.dto'
import { LlmStrategyInstanceListQueryDto } from '../dto/llm-strategy-instance-list.query.dto'
import { LlmStrategyInstanceResponseDto } from '../dto/llm-strategy-instance.response.dto'
import { LlmStrategyRunResponseDto } from '../dto/llm-strategy-run.response.dto'
import { LlmStrategyRunsListQueryDto } from '../dto/llm-strategy-runs-list.query.dto'
import { UpdateLlmStrategyInstanceDto } from '../dto/update-llm-strategy-instance.dto'
import { LLM_OPS_TEST_LOG_EVENT } from '../llm-ops-test-log.events'
// eslint-disable-next-line ts/consistent-type-imports -- 需要用于依赖注入，不能使用 import type
import { LlmOrchestratedEngineV3 } from '../llm-orchestrated-engine-v3.service'
// eslint-disable-next-line ts/consistent-type-imports -- 需要用于依赖注入，不能使用 import type
import { LlmStrategyInstancesService } from '../services/llm-strategy-instances.service'
// eslint-disable-next-line ts/consistent-type-imports -- 需要用于依赖注入，不能使用 import type
import { LlmStrategyRunsService } from '../services/llm-strategy-runs.service'

@ApiTags('ops-llm-strategy-instances')
@Controller('ops/llm-strategy-instances')
@ApiExtraModels(
  BaseResponseDto,
  BasePaginationResponseDto,
  LlmStrategyInstanceResponseDto,
  LlmStrategyInstanceListQueryDto,
  CreateLlmStrategyInstanceDto,
  UpdateLlmStrategyInstanceDto,
  LlmStrategyRunResponseDto,
  LlmStrategyRunsListQueryDto,
)
export class OpsLlmStrategyInstancesController {
  private readonly logger = new Logger(OpsLlmStrategyInstancesController.name)

  constructor(
    private readonly instancesService: LlmStrategyInstancesService,
    private readonly runsService: LlmStrategyRunsService,
    private readonly orchestratedEngine: LlmOrchestratedEngineV3,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get()
  @ApiOperation({ summary: '分页查询LLM策略实例' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: '页码（从 1 开始）',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '每页数量',
    example: 20,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['running', 'paused', 'stopped'],
    description: '按实例状态筛选',
  })
  @ApiQuery({
    name: 'strategyId',
    required: false,
    type: String,
    description: '按策略ID筛选',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    type: String,
    description: '自定义排序字段，例如 createdAt:desc',
  })
  @ApiOkResponse({
    description: '获取成功',
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(LlmStrategyInstanceResponseDto) },
            },
          },
        },
      ],
    },
  })
  async list(
    @Query() query: LlmStrategyInstanceListQueryDto,
  ) {
    const result = await this.instancesService.list(query)
    return {
      ...result,
      items: result.items.map(item => new LlmStrategyInstanceResponseDto(item)),
    }
  }

  @Get(':id')
  @ApiOperation({ summary: '获取LLM策略实例详情' })
  @ApiOkResponse({ description: '获取成功', type: LlmStrategyInstanceResponseDto })
  async detail(
    @Param('id') id: string,
  ) {
    const instance = await this.instancesService.getDetail(id)
    return new LlmStrategyInstanceResponseDto(instance)
  }

  @Post()
  @ApiOperation({ summary: '创建LLM策略实例' })
  @ApiBody({ description: '创建LLM策略实例请求体', type: CreateLlmStrategyInstanceDto })
  @ApiOkResponse({ description: '创建成功', type: LlmStrategyInstanceResponseDto })
  async create(
    @Body() body: CreateLlmStrategyInstanceDto,
  ) {
    const instance = await this.instancesService.create(body, body.createdBy ?? 'system')
    return new LlmStrategyInstanceResponseDto(instance)
  }

  @Put(':id')
  @ApiOperation({ summary: '更新LLM策略实例' })
  @ApiBody({ description: '更新LLM策略实例请求体', type: UpdateLlmStrategyInstanceDto })
  @ApiOkResponse({ description: '更新成功', type: LlmStrategyInstanceResponseDto })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateLlmStrategyInstanceDto,
  ) {
    const instance = await this.instancesService.update(id, body, body.updatedBy ?? 'system')
    return new LlmStrategyInstanceResponseDto(instance)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除LLM策略实例' })
  async delete(
    @Param('id') id: string,
  ) {
    await this.instancesService.delete(id)
    return { success: true }
  }

  @Get(':id/runs')
  @ApiOperation({ summary: '获取实例的运行历史记录' })
  @ApiOkResponse({
    description: '获取成功',
    schema: {
      type: 'array',
      items: { $ref: getSchemaPath(LlmStrategyRunResponseDto) },
    },
  })
  async listRuns(
    @Param('id') id: string,
    @Query() query: LlmStrategyRunsListQueryDto,
  ) {
    const runs = await this.runsService.listRecentByInstance(id, query.limit)
    return runs.map(run => new LlmStrategyRunResponseDto(run))
  }

  @Post(':id/test-run')
  @ApiOperation({
    summary: '手动测试运行 LLM 策略实例（忽略调度与冷却限制）',
    description:
      '立即触发一次针对指定 LLM 策略实例的完整分析流程，用于联调和验证，不考虑 scheduleCron、冷却时间和每小时运行次数限制。',
  })
  @ApiOkResponse({
    description: '本次测试对应的运行记录',
    type: LlmStrategyRunResponseDto,
  })
  async testRun(
    @Param('id') id: string,
    @Query('operatorId') operatorId: string,
  ) {
    // 这里会在 LlmOrchestratedEngineV3 中打出详细的 [OPS_TEST] 日志
    // 方便在服务日志中实时观察测试过程
    const result = await this.orchestratedEngine.runForInstance(
      id,
      operatorId,
      {
        triggerSource: 'ops_test',
      },
      {
        skipGuards: true,
      },
    )

    const run = await this.runsService.getDetail(result.runId)
    return new LlmStrategyRunResponseDto(run)
  }

  @ApiOperation({
    summary: '测试运行实时日志（SSE）',
    description:
      '通过 Server-Sent Events 实时推送指定实例的测试日志，仅包含当前 operatorId 触发的测试记录。',
  })
  @Sse(':id/test-log/stream')
  streamTestLogs(
    @Param('id') id: string,
    @Query('operatorId') operatorId: string,
  ): Observable<MessageEvent> {
    this.logger.log(`[SSE] Operator ${operatorId} connected to test log stream for instance ${id}`)

    const initialEvent: MessageEvent = {
      data: {
        instanceId: id,
        operatorId,
        level: 'info',
        message: '日志流已连接，等待触发测试运行……',
        timestamp: new Date().toISOString(),
      },
    }

    const heartbeat$ = createHeartbeatStream(15000, `heartbeat-${id}`).pipe(
      map(event => {
        this.logger.debug(`[SSE] Heartbeat for instance ${id}`)
        return event
      }),
    )

    const logs$ = fromEvent<LlmOpsTestLogEvent>(this.eventEmitter, LLM_OPS_TEST_LOG_EVENT).pipe(
      filter(event => event.instanceId === id && event.operatorId === operatorId),
      map(event => {
        const payload = this.sanitizeLogEvent(event)
        this.logger.debug(`[SSE] Sending test log event: ${payload.message}`)
        return { data: payload } as MessageEvent
      }),
    )

    return merge(of(initialEvent), logs$, heartbeat$)
  }

  private sanitizeLogEvent(event: LlmOpsTestLogEvent) {
    const sanitizedMessage = event.message.replace(/\s+/g, ' ').trim().slice(0, 400)

    return {
      instanceId: event.instanceId,
      operatorId: event.operatorId,
      runId: event.runId,
      level: event.level,
      timestamp: event.timestamp,
      message: sanitizedMessage,
      // 将结构化 meta 一并透出给调用方，便于更丰富的诊断；对字符串字段做长度截断以防日志过大
      meta: this.sanitizeLogMeta(event.meta),
    }
  }

  private sanitizeLogMeta(meta?: Record<string, unknown> | null): Record<string, unknown> | undefined {
    if (!meta) return undefined

    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(meta)) {
      if (typeof value === 'string') {
        sanitized[key] = value.slice(0, 200)
      }
      else {
        sanitized[key] = value
      }
    }
    return sanitized
  }

  @Get('runs/:runId')
  @ApiOperation({ summary: '获取运行记录详情' })
  @ApiOkResponse({ description: '获取成功', type: LlmStrategyRunResponseDto })
  async getRunDetail(
    @Param('runId') runId: string,
  ) {
    const run = await this.runsService.getDetail(runId)
    return new LlmStrategyRunResponseDto(run)
  }
}
