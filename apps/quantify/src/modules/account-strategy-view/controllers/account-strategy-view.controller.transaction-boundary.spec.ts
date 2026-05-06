import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('accountStrategyViewController transaction boundary', () => {
  it('does not wrap deploy endpoint with controller-level transaction', () => {
    const source = readFileSync(join(__dirname, 'account-strategy-view.controller.ts'), 'utf8')

    expect(source).not.toMatch(/@Transactional\(\)\s*@Post\('deploy'\)/)
    expect(source).toMatch(/@Transactional\(\)\s*@Post\(':id\/actions'\)/)
    expect(source).toMatch(/@Transactional\(\)\s*@Post\(':id\/execution\/leverage'\)/)
    // DELETE 不再使用 controller 级 @Transactional()：service.deleteStrategy 内部
    // 用 txHost.withTransaction 把归档写操作包成事务，把 tradingService 远程
    // HTTP I/O（getOpenOrders）留在事务外，遵循「事务中禁止外部 I/O」。
    expect(source).not.toMatch(/@Transactional\(\)\s*@Delete\(':id'\)/)
  })
})
