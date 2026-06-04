import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { NestFactory } from '@nestjs/core'
import { loadEnvironment } from '@net/config'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { applyQuantifyEnvOverrides } from './config/quantify-env'
import { BacktestingWorkerModule } from './modules/backtesting/backtesting-worker.module'
import { BacktestRecoveryService } from './modules/backtesting/jobs/backtest-recovery.service'
import 'reflect-metadata'

function findWorkspaceRoot(startDir: string): string {
  let current = startDir
  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) {
      return current
    }
    const parent = dirname(current)
    if (parent === current) {
      return startDir
    }
    current = parent
  }
}

async function bootstrap() {
  process.chdir(findWorkspaceRoot(__dirname))
  loadEnvironment()
  applyQuantifyEnvOverrides()

  const app = await NestFactory.createApplicationContext(BacktestingWorkerModule, {
    bufferLogs: process.env.NEST_BUFFER_LOGS !== 'false',
  })
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER)
  app.useLogger(logger)
  app.enableShutdownHooks()

  await app.get(BacktestRecoveryService).recoverStaleJobs()
  process.stdout.write('Quantify backtest worker ready\n')
  logger.log('Quantify backtest worker ready')
}

bootstrap()
