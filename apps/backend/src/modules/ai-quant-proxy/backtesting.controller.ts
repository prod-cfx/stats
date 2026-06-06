import type { BaseResponseDto } from '@/common/dto/base.dto'
import { Body, Controller, Get, Header, Headers, Inject, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { buildBaseResponseSchema } from '@/common/swagger/base-response-schema.helper'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { AuthRateLimitGuard } from '@/modules/auth/guards/auth-rate-limit.guard'
import { BacktestingCapabilitiesResponseDto } from './dto/backtesting-capabilities.response.dto'
import {
  BacktestingCreateJobRequestDto,
  BacktestingCreateJobResponseDto,
} from './dto/backtesting-create-job.dto'
import { BacktestingJobResponseDto } from './dto/backtesting-job.response.dto'
import { BacktestingReportResponseDto } from './dto/backtesting-report.response.dto'
import {
  BacktestingSymbolSupportRequestDto,
  BacktestingSymbolSupportResponseDto,
} from './dto/backtesting-symbol-support.dto'
import { AiQuantProxyService } from './ai-quant-proxy.service'

@ApiTags('backtesting')
@ApiBearerAuth('bearer')
@ApiExtraModels(
  BacktestingCreateJobRequestDto,
  BacktestingCreateJobResponseDto,
  BacktestingCapabilitiesResponseDto,
  BacktestingJobResponseDto,
  BacktestingReportResponseDto,
)
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
  @ApiOperation({ summary: 'Get backtesting capabilities through the backend proxy.' })
  @ApiHeader({ name: 'x-request-id', required: false })
  @ApiOkResponse({ schema: buildBaseResponseSchema(BacktestingCapabilitiesResponseDto) })
  async capabilities(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ): Promise<BaseResponseDto<BacktestingCapabilitiesResponseDto>> {
    return this.service.getBacktestCapabilities(authorization, requestId)
  }

  @Post('symbols/check')
  @ApiOperation({ summary: 'Check backtesting symbol support through the backend proxy.' })
  @ApiBody({ type: BacktestingSymbolSupportRequestDto })
  @ApiHeader({ name: 'x-request-id', required: false })
  @ApiOkResponse({ type: BacktestingSymbolSupportResponseDto })
  async checkSymbolSupport(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: BacktestingSymbolSupportRequestDto,
  ): Promise<BacktestingSymbolSupportResponseDto> {
    return this.service.checkBacktestSymbolSupport(userId, authorization, body as unknown as Record<string, unknown>, requestId)
  }

  @Post('jobs')
  @ApiOperation({ summary: 'Create a backtesting job through the backend proxy.' })
  @ApiBody({ type: BacktestingCreateJobRequestDto })
  @ApiHeader({ name: 'x-request-id', required: false })
  @ApiOkResponse({ schema: buildBaseResponseSchema(BacktestingCreateJobResponseDto) })
  async createJob(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: BacktestingCreateJobRequestDto,
  ): Promise<BaseResponseDto<BacktestingCreateJobResponseDto>> {
    return this.service.createBacktestJob(userId, authorization, body as unknown as Record<string, unknown>, requestId)
  }

  @Get('jobs/:id')
  @Header('Cache-Control', 'no-store, no-cache, max-age=0')
  @Header('Pragma', 'no-cache')
  @ApiOperation({ summary: 'Get a backtesting job status through the backend proxy.' })
  @ApiHeader({ name: 'x-request-id', required: false })
  @ApiOkResponse({ schema: buildBaseResponseSchema(BacktestingJobResponseDto) })
  async getJob(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Param('id') id: string,
  ): Promise<BaseResponseDto<BacktestingJobResponseDto>> {
    return this.service.getBacktestJob(userId, authorization, id, requestId)
  }

  @Get('jobs/:id/result')
  @Header('Cache-Control', 'no-store, no-cache, max-age=0')
  @Header('Pragma', 'no-cache')
  @ApiOperation({ summary: 'Get a backtesting job result through the backend proxy.' })
  @ApiHeader({ name: 'x-request-id', required: false })
  @ApiOkResponse({ schema: buildBaseResponseSchema(BacktestingReportResponseDto) })
  async getJobResult(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Param('id') id: string,
  ): Promise<BaseResponseDto<BacktestingReportResponseDto>> {
    return this.service.getBacktestJobResult(userId, authorization, id, requestId)
  }
}
