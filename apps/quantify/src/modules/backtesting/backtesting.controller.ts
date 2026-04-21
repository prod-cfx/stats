import type { BacktestRunInput } from './types/backtesting.types'
import { ErrorCode } from '@ai/shared'
import { Body, Controller, Get, Headers, HttpStatus, Logger, Param, Post, UseGuards } from '@nestjs/common'
import {
  ApiExtraModels,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { BaseResponseDto } from '@/common/dto/base.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
import { buildBaseResponseSchema } from '@/common/swagger/base-response-schema.helper'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestRunnerService } from './core/backtest-runner.service'
// eslint-disable-next-line ts/consistent-type-imports -- ValidationPipe 需要运行时类元数据
import {
  BacktestCapabilitiesResponseDto,
  BacktestJobResponseDto,
  BacktestReportResponseDto,
  BacktestSymbolSupportResponseDto,
} from './dto/backtest.response.dto'
import { CheckBacktestSymbolDto } from './dto/check-backtest-symbol.dto'
// eslint-disable-next-line ts/consistent-type-imports -- ValidationPipe 需要运行时类元数据
import { RunBacktestDto } from './dto/run-backtest.dto'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestJobsService } from './jobs/backtest-jobs.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestCallerIdentityService } from './services/backtest-caller-identity.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestCapabilitiesService } from './services/backtest-capabilities.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestSnapshotLoaderService } from './services/backtest-snapshot-loader.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestSymbolSupportService } from './services/backtest-symbol-support.service'

@ApiTags('backtesting')
@Controller('backtesting')
@UseGuards(ThrottlerGuard)
@ApiExtraModels(
  BaseResponseDto,
  BacktestCapabilitiesResponseDto,
  BacktestJobResponseDto,
  BacktestReportResponseDto,
  BacktestSymbolSupportResponseDto,
)
export class BacktestingController {
  private readonly logger = new Logger(BacktestingController.name)

  constructor(
    private readonly runner: BacktestRunnerService,
    private readonly jobsService: BacktestJobsService,
    private readonly callerIdentityService: BacktestCallerIdentityService,
    private readonly snapshotLoader: BacktestSnapshotLoaderService,
    private readonly capabilitiesService: BacktestCapabilitiesService,
    private readonly symbolSupportService: BacktestSymbolSupportService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('run')
  @ApiOperation({ summary: '同步执行一次回测' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiOkResponse({ type: BacktestReportResponseDto })
  async run(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-user-id') forwardedUserId: string | undefined,
    @Body() dto: RunBacktestDto,
  ) {
    const callerUserId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    const strategy = await this.resolveStrategy(dto, callerUserId)
    return this.runner.run({ ...dto, strategy, bars: dto.bars ?? [] } as BacktestRunInput)
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('jobs')
  @ApiOperation({ summary: '创建异步回测任务' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiHeader({ name: 'x-request-id', required: false })
  @ApiOkResponse({ schema: buildBaseResponseSchema(BacktestJobResponseDto) })
  async createJob(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-user-id') forwardedUserId: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() dto: RunBacktestDto,
  ) {
    let normalizedInput: BacktestRunInput | null = null
    try {
      const callerUserId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
      const strategy = await this.resolveStrategy(dto, callerUserId)
      normalizedInput = this.normalizeSnapshotTruthInput(dto, strategy)
      return this.jobsService.createJob(normalizedInput, callerUserId)
    } catch (error) {
      if (error instanceof DomainException) {
        throw error
      }
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `event=backtesting_create_job_failed requestId=${requestId ?? 'N/A'} symbols=${(normalizedInput?.symbols ?? dto.symbols).join(',')} strategyId=${normalizedInput?.strategy?.id ?? dto.strategy?.id ?? 'N/A'} reason=${message}`,
      )
      throw new DomainException('backtesting.job_temporarily_unavailable', {
        code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
        status: HttpStatus.SERVICE_UNAVAILABLE,
        args: {
          symbols: dto.symbols,
          strategyId: dto.strategy?.id,
          reasonMessage: message,
        },
      })
    }
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: '获取回测任务状态' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiOkResponse({ schema: buildBaseResponseSchema(BacktestJobResponseDto) })
  async getJob(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-user-id') forwardedUserId: string | undefined,
    @Param('id') id: string,
  ) {
    const callerUserId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.jobsService.getJob(id, callerUserId)
  }

  @Get('jobs/:id/result')
  @ApiOperation({ summary: '获取回测任务结果' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiOkResponse({ schema: buildBaseResponseSchema(BacktestReportResponseDto) })
  async getJobResult(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-user-id') forwardedUserId: string | undefined,
    @Param('id') id: string,
  ) {
    const callerUserId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.jobsService.getJobResult(id, callerUserId)
  }

  @Get('capabilities')
  @ApiOperation({ summary: '获取当前回测能力配置' })
  @ApiHeader({ name: 'x-request-id', required: false })
  @ApiOkResponse({ schema: buildBaseResponseSchema(BacktestCapabilitiesResponseDto) })
  async getCapabilities(
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    const startedAt = Date.now()
    try {
      this.logger.log(`event=backtesting_capabilities_request requestId=${requestId ?? 'N/A'}`)
      return await this.capabilitiesService.getCapabilities(requestId)
    } catch (error) {
      if (error instanceof DomainException) {
        throw error
      }
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `event=backtesting_capabilities_request_failed requestId=${requestId ?? 'N/A'} reason=${message} durationMs=${Date.now() - startedAt}`,
      )
      throw new DomainException('backtesting.capabilities_unavailable', {
        code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
        status: HttpStatus.SERVICE_UNAVAILABLE,
        args: { reasonMessage: message },
      })
    }
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('symbols/check')
  @ApiOperation({ summary: '检查回测标的是否受支持' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiHeader({ name: 'x-request-id', required: false })
  @ApiOkResponse({ schema: buildBaseResponseSchema(BacktestSymbolSupportResponseDto) })
  async checkSymbolSupport(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-user-id') forwardedUserId: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() dto: CheckBacktestSymbolDto,
  ) {
    await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    try {
      return await this.symbolSupportService.checkSupport({
        exchange: dto.exchange,
        marketType: dto.marketType,
        symbol: dto.symbol,
        baseTimeframe: dto.baseTimeframe,
      })
    } catch (error) {
      if (error instanceof DomainException) {
        throw error
      }
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `event=backtesting_symbol_support_failed requestId=${requestId ?? 'N/A'} exchange=${dto.exchange} symbol=${dto.symbol} reason=${message}`,
      )
      throw new DomainException('backtesting.symbol_support_temporarily_unavailable', {
        code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
        status: HttpStatus.SERVICE_UNAVAILABLE,
        args: {
          exchange: dto.exchange,
          symbol: dto.symbol,
          reasonMessage: message,
        },
      })
    }
  }

  private async resolveStrategy(dto: RunBacktestDto, userId: string) {
    const publishedSnapshotId = dto.strategy.publishedSnapshotId?.trim() ?? ''
    if (!publishedSnapshotId) {
      throw new DomainException('backtest.snapshot_required', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    return this.snapshotLoader.load({
      id: dto.strategy.id?.trim() ?? '',
      protocolVersion: dto.strategy.protocolVersion,
      publishedSnapshotId,
      userId,
    })
  }

  private normalizeSnapshotTruthInput(
    dto: RunBacktestDto,
    strategy: BacktestRunInput['strategy'],
  ): BacktestRunInput {
    const params = strategy.params as Record<string, unknown>
    const strategyStateTimeframes = (strategy as { stateTimeframes?: unknown }).stateTimeframes
    const symbol = typeof params.symbol === 'string' && params.symbol.trim()
      ? params.symbol.trim()
      : dto.symbols[0]
    const baseTimeframe = typeof params.timeframe === 'string' && params.timeframe.trim()
      ? params.timeframe.trim() as BacktestRunInput['baseTimeframe']
      : dto.baseTimeframe
    const stateTimeframes = Array.isArray(strategyStateTimeframes)
      ? strategyStateTimeframes as BacktestRunInput['stateTimeframes']
      : dto.stateTimeframes ?? []

    return {
      ...dto,
      symbols: symbol ? [symbol] : dto.symbols,
      baseTimeframe,
      stateTimeframes,
      strategy,
      bars: dto.bars ?? [],
    } as BacktestRunInput
  }
}
