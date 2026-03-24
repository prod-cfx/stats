import type { BacktestRunInput } from './types/backtesting.types'
import { Transactional } from '@nestjs-cls/transactional'
import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestRunnerService } from './core/backtest-runner.service'
// eslint-disable-next-line ts/consistent-type-imports -- ValidationPipe 需要运行时类元数据
import { RunBacktestDto } from './dto/run-backtest.dto'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestJobsService } from './jobs/backtest-jobs.service'
import { BacktestCallerIdentityService } from './services/backtest-caller-identity.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestStrategyAdapterService } from './services/backtest-strategy-adapter.service'

@Controller('backtesting')
@UseGuards(ThrottlerGuard)
export class BacktestingController {
  constructor(
    private readonly runner: BacktestRunnerService,
    private readonly jobsService: BacktestJobsService,
    private readonly callerIdentityService: BacktestCallerIdentityService,
    private readonly strategyAdapter: BacktestStrategyAdapterService,
  ) {}

  @Transactional()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('run')
  async run(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: RunBacktestDto,
  ) {
    await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization)
    const strategy = await this.strategyAdapter.build(dto.strategy)
    return this.runner.run({ ...dto, strategy } as BacktestRunInput)
  }

  @Transactional()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('jobs')
  async createJob(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: RunBacktestDto,
  ) {
    await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization)
    const strategy = await this.strategyAdapter.build(dto.strategy)
    return this.jobsService.createJob({ ...dto, strategy } as BacktestRunInput)
  }

  @Get('jobs/:id')
  getJob(@Param('id') id: string) {
    return this.jobsService.getJob(id)
  }

  @Get('jobs/:id/result')
  getJobResult(@Param('id') id: string) {
    return this.jobsService.getJobResult(id)
  }
}
