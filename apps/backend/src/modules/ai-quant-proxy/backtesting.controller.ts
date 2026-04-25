import { Body, Controller, Get, Headers, Inject, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { buildBaseResponseSchema } from '@/common/swagger/base-response-schema.helper'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { AuthRateLimitGuard } from '@/modules/auth/guards/auth-rate-limit.guard'
import {
  BacktestingCreateJobRequestDto,
  BacktestingCreateJobResponseDto,
} from './dto/backtesting-create-job.dto'
import {
  BacktestingSymbolSupportRequestDto,
  BacktestingSymbolSupportResponseDto,
} from './dto/backtesting-symbol-support.dto'
import { AiQuantProxyService } from './ai-quant-proxy.service'

@ApiTags('backtesting')
@ApiBearerAuth('bearer')
@ApiExtraModels(BacktestingCreateJobRequestDto, BacktestingCreateJobResponseDto)
@Auth()
@Controller('backtesting')
export class BacktestingProxyController {
  constructor(
    @Inject(AiQuantProxyService)
    private readonly service: AiQuantProxyService,
  ) {}

  @Get('capabilities')
  @UseGuards(AuthRateLimitGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async capabilities(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ): Promise<unknown> {
    return this.service.getBacktestCapabilities(authorization, requestId)
  }

  @Post('symbols/check')
  @ApiBody({ type: BacktestingSymbolSupportRequestDto })
  @ApiHeader({ name: 'x-request-id', required: false })
  @ApiOkResponse({ type: BacktestingSymbolSupportResponseDto })
  async checkSymbolSupport(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: BacktestingSymbolSupportRequestDto,
  ): Promise<unknown> {
    return this.service.checkBacktestSymbolSupport(userId, authorization, body as unknown as Record<string, unknown>, requestId)
  }

  @Post('jobs')
  @ApiBody({ type: BacktestingCreateJobRequestDto })
  @ApiHeader({ name: 'x-request-id', required: false })
  @ApiOkResponse({ schema: buildBaseResponseSchema(BacktestingCreateJobResponseDto) })
  async createJob(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: BacktestingCreateJobRequestDto,
  ): Promise<unknown> {
    return this.service.createBacktestJob(userId, authorization, body as unknown as Record<string, unknown>, requestId)
  }

  @Get('jobs/:id')
  async getJob(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.getBacktestJob(userId, authorization, id, requestId)
  }

  @Get('jobs/:id/result')
  async getJobResult(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.getBacktestJobResult(userId, authorization, id, requestId)
  }
}
