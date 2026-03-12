import type { MessageEvent } from '@nestjs/common'
import type { Observable } from 'rxjs'
import type { LlmOpsTestLogEvent } from '../llm-ops-test-log.events'
import { Body, Controller, Delete, Get, Logger, Param, Post, Put, Query, Sse } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- 闇€瑕佺敤浜庝緷璧栨敞鍏ワ紝涓嶈兘浣跨敤 import type
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
// eslint-disable-next-line ts/consistent-type-imports -- 闇€瑕佺敤浜庝緷璧栨敞鍏ワ紝涓嶈兘浣跨敤 import type
import { LlmOrchestratedEngineV3 } from '../llm-orchestrated-engine-v3.service'
// eslint-disable-next-line ts/consistent-type-imports -- 闇€瑕佺敤浜庝緷璧栨敞鍏ワ紝涓嶈兘浣跨敤 import type
import { LlmStrategyInstancesService } from '../services/llm-strategy-instances.service'
// eslint-disable-next-line ts/consistent-type-imports -- 闇€瑕佺敤浜庝緷璧栨敞鍏ワ紝涓嶈兘浣跨敤 import type
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
  @ApiOperation({ summary: '鍒嗛〉鏌ヨLLM绛栫暐瀹炰緥' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: '椤电爜锛堜粠 1 寮€濮嬶級',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '姣忛〉鏁伴噺',
    example: 20,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['running', 'paused', 'stopped'],
    description: '鎸夊疄渚嬬姸鎬佺瓫閫?,
  })
  @ApiQuery({
    name: 'strategyId',
    required: false,
    type: String,
    description: '鎸夌瓥鐣D绛涢€?,
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    type: String,
    description: '鑷畾涔夋帓搴忓瓧娈碉紝渚嬪 createdAt:desc',
  })
  @ApiOkResponse({
    description: '鑾峰彇鎴愬姛',
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
  @ApiOperation({ summary: '鑾峰彇LLM绛栫暐瀹炰緥璇︽儏' })
  @ApiOkResponse({ description: '鑾峰彇鎴愬姛', type: LlmStrategyInstanceResponseDto })
  async detail(
    @Param('id') id: string,
  ) {
    const instance = await this.instancesService.getDetail(id)
    return new LlmStrategyInstanceResponseDto(instance)
  }

  @Post()
  @ApiOperation({ summary: '鍒涘缓LLM绛栫暐瀹炰緥' })
  @ApiBody({ description: '鍒涘缓LLM绛栫暐瀹炰緥璇锋眰浣?, type: CreateLlmStrategyInstanceDto })
  @ApiOkResponse({ description: '鍒涘缓鎴愬姛', type: LlmStrategyInstanceResponseDto })
  async create(
    @Body() body: CreateLlmStrategyInstanceDto,
  ) {
    const instance = await this.instancesService.create(body, body.createdBy ?? 'system')
    return new LlmStrategyInstanceResponseDto(instance)
  }

  @Put(':id')
  @ApiOperation({ summary: '鏇存柊LLM绛栫暐瀹炰緥' })
  @ApiBody({ description: '鏇存柊LLM绛栫暐瀹炰緥璇锋眰浣?, type: UpdateLlmStrategyInstanceDto })
  @ApiOkResponse({ description: '鏇存柊鎴愬姛', type: LlmStrategyInstanceResponseDto })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateLlmStrategyInstanceDto,
  ) {
    const instance = await this.instancesService.update(id, body, body.updatedBy ?? 'system')
    return new LlmStrategyInstanceResponseDto(instance)
  }

  @Delete(':id')
  @ApiOperation({ summary: '鍒犻櫎LLM绛栫暐瀹炰緥' })
  async delete(
    @Param('id') id: string,
  ) {
    await this.instancesService.delete(id)
    return { success: true }
  }

  @Get(':id/runs')
  @ApiOperation({ summary: '鑾峰彇瀹炰緥鐨勮繍琛屽巻鍙茶褰? })
  @ApiOkResponse({
    description: '鑾峰彇鎴愬姛',
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
    summary: '鎵嬪姩娴嬭瘯杩愯 LLM 绛栫暐瀹炰緥锛堝拷鐣ヨ皟搴︿笌鍐峰嵈闄愬埗锛?,
    description:
      '绔嬪嵆瑙﹀彂涓€娆￠拡瀵规寚瀹?LLM 绛栫暐瀹炰緥鐨勫畬鏁村垎鏋愭祦绋嬶紝鐢ㄤ簬鑱旇皟鍜岄獙璇侊紝涓嶈€冭檻 scheduleCron銆佸喎鍗存椂闂村拰姣忓皬鏃惰繍琛屾鏁伴檺鍒躲€?,
  })
  @ApiOkResponse({
    description: '鏈娴嬭瘯瀵瑰簲鐨勮繍琛岃褰?,
    type: LlmStrategyRunResponseDto,
  })
  async testRun(
    @Param('id') id: string,
    @Query('operatorId') operatorId: string,
  ) {
    // 杩欓噷浼氬湪 LlmOrchestratedEngineV3 涓墦鍑鸿缁嗙殑 [OPS_TEST] 鏃ュ織
    // 鏂逛究鍦ㄦ湇鍔℃棩蹇椾腑瀹炴椂瑙傚療娴嬭瘯杩囩▼
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
    summary: '娴嬭瘯杩愯瀹炴椂鏃ュ織锛圫SE锛?,
    description:
      '閫氳繃 Server-Sent Events 瀹炴椂鎺ㄩ€佹寚瀹氬疄渚嬬殑娴嬭瘯鏃ュ織锛屼粎鍖呭惈褰撳墠 operatorId 瑙﹀彂鐨勬祴璇曡褰曘€?,
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
        message: '鏃ュ織娴佸凡杩炴帴锛岀瓑寰呰Е鍙戞祴璇曡繍琛屸€︹€?,
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
      // 灏嗙粨鏋勫寲 meta 涓€骞堕€忓嚭缁欒皟鐢ㄦ柟锛屼究浜庢洿涓板瘜鐨勮瘖鏂紱瀵瑰瓧绗︿覆瀛楁鍋氶暱搴︽埅鏂互闃叉棩蹇楄繃澶?
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
  @ApiOperation({ summary: '鑾峰彇杩愯璁板綍璇︽儏' })
  @ApiOkResponse({ description: '鑾峰彇鎴愬姛', type: LlmStrategyRunResponseDto })
  async getRunDetail(
    @Param('runId') runId: string,
  ) {
    const run = await this.runsService.getDetail(runId)
    return new LlmStrategyRunResponseDto(run)
  }
}
