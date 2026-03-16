import type { BacktestReport, BacktestRunInput, Bar, SignalIntent } from '../types/backtesting.types'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { TheoreticalExecutionModel } from '../execution/theoretical-execution.model'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PortfolioLedgerServiceFactory } from '../portfolio/portfolio-ledger.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestReporterService } from '../report/backtest-reporter.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { StateEngineService } from '../state/state-engine.service'

@Injectable()
export class BacktestRunnerService {
  constructor(
    private readonly executionModel: TheoreticalExecutionModel,
    private readonly ledgerFactory: PortfolioLedgerServiceFactory,
    private readonly reporterService: BacktestReporterService,
    private readonly stateEngine: StateEngineService,
  ) {}

  async run(input: BacktestRunInput): Promise<BacktestReport> {
    const ledger = this.ledgerFactory.create(input.initialCash)
    const reporter = this.reporterService.create()

    const baseBars = input.bars
      .filter(bar => bar.timeframe === input.baseTimeframe)
      .sort((a, b) => a.closeTime - b.closeTime)

    const stateBars = input.bars
      .filter(bar => input.stateTimeframes.includes(bar.timeframe))
      .sort((a, b) => a.closeTime - b.closeTime)

    let stateCursor = 0

    for (const bar of baseBars) {
      while (stateCursor < stateBars.length && stateBars[stateCursor].closeTime <= bar.closeTime) {
        const sBar = stateBars[stateCursor]
        this.stateEngine.upsert({
          symbol: sBar.symbol,
          timeframe: sBar.timeframe,
          ts: sBar.closeTime,
          values: {
            close: sBar.close,
            open: sBar.open,
            high: sBar.high,
            low: sBar.low,
            volume: sBar.volume,
          },
        })
        stateCursor += 1
      }

      const snapshot = ledger.snapshot()
      const position = ledger.getPosition(bar.symbol)
      const htfState = this.stateEngine.getLatestByTimeframes(bar.symbol, input.stateTimeframes)
      const intent = await input.strategy.fn({
        ts: bar.closeTime,
        symbol: bar.symbol,
        baseTimeframeBar: bar,
        htfState,
        position,
        portfolio: {
          cash: snapshot.cash,
          equity: snapshot.equity,
          usedMargin: snapshot.usedMargin,
          realizedPnl: snapshot.realizedPnl,
        },
        params: input.strategy.params,
      })

      const normalized = this.normalizeIntent(intent, position.qty)
      if (normalized === 0) {
        ledger.markToMarket({ [bar.symbol]: bar.close })
        reporter.pushEquity(bar.closeTime, ledger.snapshot().equity)
        continue
      }

      const side: 'BUY' | 'SELL' = normalized > 0 ? 'BUY' : 'SELL'
      const fill = this.executionModel.fill(bar, side, Math.abs(normalized), input.execution, intent.reason)
      const events = ledger.applyFill(fill)
      events.forEach((event) => {
        if (event.type === 'OPEN') {
          reporter.onTradeOpen({
            symbol: event.symbol,
            ts: event.ts,
            price: event.price,
            side: event.side,
            qty: event.qty,
            fee: event.fee,
            reason: intent.reason,
          })
          return
        }

        reporter.onTradeClose({
          symbol: event.symbol,
          ts: event.ts,
          price: event.price,
          side: event.side,
          qty: event.qty,
          fee: event.fee,
          pnl: event.pnl ?? 0,
          reason: intent.reason,
        })
      })

      ledger.markToMarket({ [bar.symbol]: bar.close })
      reporter.pushEquity(bar.closeTime, ledger.snapshot().equity)
    }

    const report = reporter.toReport(input.initialCash)
    const snapshot = ledger.snapshot()
    const openPositions = Object.values(snapshot.positions).map(pos => ({
      symbol: pos.symbol,
      qty: pos.qty,
      avgEntryPrice: pos.avgEntryPrice,
      unrealizedPnl: pos.unrealizedPnl,
    }))

    this.stateEngine.reset()

    return {
      ...report,
      openPositions,
    }
  }

  private normalizeIntent(intent: SignalIntent, currentQty: number): number {
    switch (intent.type) {
      case 'TARGET_POSITION':
        return intent.targetQty - currentQty
      case 'OPEN_LONG':
        return Math.abs(intent.qty)
      case 'OPEN_SHORT':
        return -Math.abs(intent.qty)
      case 'CLOSE':
        return currentQty === 0 ? 0 : -Math.sign(currentQty) * (intent.qty ?? Math.abs(currentQty))
      case 'NOOP':
      default:
        return 0
    }
  }
}

export function createBar(input: Partial<Bar> & Pick<Bar, 'symbol' | 'timeframe' | 'closeTime'>): Bar {
  return {
    openTime: input.openTime ?? input.closeTime - 1,
    open: input.open ?? 100,
    high: input.high ?? 100,
    low: input.low ?? 100,
    close: input.close ?? 100,
    volume: input.volume ?? 0,
    ...input,
  }
}
