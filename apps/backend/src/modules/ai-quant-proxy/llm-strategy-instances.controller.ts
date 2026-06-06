import type { AiQuantProxyService } from './ai-quant-proxy.service'
import type { LlmStrategyInstanceListQueryDto } from './dto/llm-strategy-instance-list-query.dto'
import type { LlmStrategyInstanceSignalsQueryDto } from './dto/llm-strategy-instance-signals-query.dto'
import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger'
import { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { OptionalJwtAuthGuard } from '@/modules/auth/guards/optional-jwt-auth.guard'
import { AiQuantProxyService as AiQuantProxyServiceToken } from './ai-quant-proxy.service'
import { LlmStrategyInstanceResponseDto } from './dto/llm-strategy-instance.response.dto'
import { LlmStrategyInstanceSignalResponseDto } from './dto/llm-strategy-instance-signal.response.dto'

function buildPaginatedSchema(itemDto: unknown) {
  return {
    allOf: [
      { $ref: getSchemaPath(BasePaginationResponseDto) },
      {
        properties: {
          items: { type: 'array' as const, items: { $ref: getSchemaPath(itemDto as never) } },
        },
      },
    ],
  }
}

@ApiTags('llm-strategy-instances')
@ApiExtraModels(
  BasePaginationResponseDto,
  LlmStrategyInstanceResponseDto,
  LlmStrategyInstanceSignalResponseDto,
)
@UseGuards(OptionalJwtAuthGuard)
@Controller('llm-strategy-instances')
export class LlmStrategyInstancesController {
  constructor(
    @Inject(AiQuantProxyServiceToken)
    private readonly service: AiQuantProxyService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List LLM strategy instances through the backend proxy.' })
  @ApiOkResponse({ schema: buildPaginatedSchema(LlmStrategyInstanceResponseDto) })
  async list(
    @CurrentUser('id') userId: string | undefined,
    @Query() query: LlmStrategyInstanceListQueryDto,
  ): Promise<BasePaginationResponseDto<LlmStrategyInstanceResponseDto>> {
    return this.service.listLlmInstances(userId, {
      page: query.page,
      limit: query.limit,
      llmModel: query.llmModel,
      strategyId: query.strategyId,
    })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get LLM strategy instance detail through the backend proxy.' })
  @ApiOkResponse({ schema: { $ref: getSchemaPath(LlmStrategyInstanceResponseDto) } })
  async detail(
    @CurrentUser('id') userId: string | undefined,
    @Param('id') id: string,
  ): Promise<LlmStrategyInstanceResponseDto> {
    return this.service.getLlmInstanceDetail(id, userId)
  }

  @Get(':id/signals')
  @ApiBearerAuth('bearer')
  @Auth()
  @ApiOperation({ summary: 'List LLM strategy instance signals through the backend proxy.' })
  @ApiOkResponse({ schema: buildPaginatedSchema(LlmStrategyInstanceSignalResponseDto) })
  async signals(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Query() query: LlmStrategyInstanceSignalsQueryDto,
  ): Promise<BasePaginationResponseDto<LlmStrategyInstanceSignalResponseDto>> {
    return this.service.listLlmInstanceSignals(userId, id, {
      page: query.page,
      limit: query.limit,
    })
  }
}
