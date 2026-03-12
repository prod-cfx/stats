import { Test } from '@nestjs/testing'
import { BacktestingModule } from './backtesting.module'

describe('backtestingModule', () => {
  it('should compile module', async () => {
    const mod = await Test.createTestingModule({ imports: [BacktestingModule] }).compile()
    expect(mod).toBeDefined()
  })
})
