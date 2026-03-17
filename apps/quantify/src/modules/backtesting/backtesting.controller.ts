import type { BacktestRunInput } from './types/backtesting.types'
import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { RunBacktestDto } from './dto/run-backtest.dto'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestRunnerService } from './core/backtest-runner.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestJobsService } from './jobs/backtest-jobs.service'

@Controller('backtesting')
export class BacktestingController {
  constructor(
    private readonly runner: BacktestRunnerService,
    private readonly jobsService: BacktestJobsService,
  ) {}

  @Post('run')
  async run(@Body() dto: RunBacktestDto) {
    return this.runner.run(dto as BacktestRunInput)
  }

  @Post('jobs')
  createJob(@Body() dto: RunBacktestDto) {
    return this.jobsService.createJob(dto as BacktestRunInput)
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
