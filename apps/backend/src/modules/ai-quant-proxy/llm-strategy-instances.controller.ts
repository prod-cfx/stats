import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { OptionalJwtAuthGuard } from '@/modules/auth/guards/optional-jwt-auth.guard'
import { AiQuantProxyService } from './ai-quant-proxy.service'
import { LlmStrategyInstanceListQueryDto } from './dto/llm-strategy-instance-list.query.dto'
import { LlmStrategyInstanceSignalsQueryDto } from './dto/llm-strategy-instance-signals.query.dto'

@ApiTags('llm-strategy-instances')
@UseGuards(OptionalJwtAuthGuard)
@Controller('llm-strategy-instances')
export class LlmStrategyInstancesController {
  constructor(private readonly service: AiQuantProxyService) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string | undefined,
    @Query() query: LlmStrategyInstanceListQueryDto,
  ): Promise<unknown> {
    return this.service.listLlmInstances(userId, {
      page: query.page,
      limit: query.limit,
      llmModel: query.llmModel,
      strategyId: query.strategyId,
    })
  }

  @Get(':id')
  async detail(
    @CurrentUser('id') userId: string | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.getLlmInstanceDetail(id, userId)
  }

  @Get(':id/signals')
  @ApiBearerAuth('bearer')
  @Auth()
  async signals(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Query() query: LlmStrategyInstanceSignalsQueryDto,
  ): Promise<unknown> {
    return this.service.listLlmInstanceSignals(userId, id, {
      page: query.page,
      limit: query.limit,
    })
  }
}
