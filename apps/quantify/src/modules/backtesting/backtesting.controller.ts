import type { BacktestRunInput } from './types/backtesting.types'
import { ErrorCode } from '@ai/shared'
import { Body, Controller, Get, Headers, HttpStatus, Logger, Param, Post, UseGuards } from '@nestjs/common'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestRunnerService } from './core/backtest-runner.service'
// eslint-disable-next-line ts/consistent-type-imports -- ValidationPipe 需要运行时类元数据
import { RunBacktestDto } from './dto/run-backtest.dto'
// eslint-disable-next-line ts/consistent-type-imports -- ValidationPipe 需要运行时类元数据
import { CheckBacktestSymbolDto } from './dto/check-backtest-symbol.dto'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestJobsService } from './jobs/backtest-jobs.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestCallerIdentityService } from './services/backtest-caller-identity.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestCapabilitiesService } from './services/backtest-capabilities.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestStrategyAdapterService } from './services/backtest-strategy-adapter.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestSymbolSupportService } from './services/backtest-symbol-support.service'

@Controller('backtesting')
@UseGuards(ThrottlerGuard)
export class BacktestingController {
  private readonly logger = new Logger(BacktestingController.name)

  constructor(
    private readonly runner: BacktestRunnerService,
    private readonly jobsService: BacktestJobsService,
    private readonly callerIdentityService: BacktestCallerIdentityService,
    private readonly strategyAdapter: BacktestStrategyAdapterService,
    private readonly capabilitiesService: BacktestCapabilitiesService,
    private readonly symbolSupportService: BacktestSymbolSupportService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('run')
  async run(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: RunBacktestDto,
  ) {
    await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization)
    const strategy = await this.strategyAdapter.build(dto.strategy)
    return this.runner.run({ ...dto, strategy, bars: dto.bars ?? [] } as BacktestRunInput)
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('jobs')
  async createJob(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() dto: RunBacktestDto,
  ) {
    try {
      const callerUserId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization)
      const strategy = await this.strategyAdapter.build(dto.strategy)
      return this.jobsService.createJob({ ...dto, strategy, bars: dto.bars ?? [] } as BacktestRunInput, callerUserId)
    } catch (error) {
      if (error instanceof DomainException) {
        throw error
      }
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `event=backtesting_create_job_failed requestId=${requestId ?? 'N/A'} symbols=${dto.symbols.join(',')} strategyId=${dto.strategy?.id ?? 'N/A'} reason=${message}`,
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
  async getJob(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    const callerUserId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization)
    return this.jobsService.getJob(id, callerUserId)
  }

  @Get('jobs/:id/result')
  async getJobResult(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    const callerUserId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization)
    return this.jobsService.getJobResult(id, callerUserId)
  }

  @Get('capabilities')
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
  async checkSymbolSupport(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() dto: CheckBacktestSymbolDto,
  ) {
    await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization)
    try {
      return await this.symbolSupportService.checkSupport(dto.exchange, dto.symbol)
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
}
