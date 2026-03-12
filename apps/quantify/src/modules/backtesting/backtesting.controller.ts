import type { RunBacktestDto } from './dto/run-backtest.dto'
import type { BacktestRunInput } from './types/backtesting.types'
import { Body, Controller, Post } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { BacktestRunnerService } from './core/backtest-runner.service'

@Controller('backtesting')
export class BacktestingController {
  constructor(private readonly runner: BacktestRunnerService) {}

  @Post('run')
  async run(@Body() dto: RunBacktestDto) {
    return this.runner.run(dto as BacktestRunInput)
  }
}
