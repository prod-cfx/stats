import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AdminDataPullTaskController } from './admin-data-pull-task.controller'

describe('AdminDataPullTaskController transaction boundaries', () => {
  const source = readFileSync(resolve(__dirname, 'admin-data-pull-task.controller.ts'), 'utf8')

  it('does not wrap manual trigger in one HTTP transaction', () => {
    const triggerSection = source.slice(
      source.indexOf('@Post(\':id/trigger\')'),
      source.indexOf('@Post(\':id/interrupt\')'),
    )

    expect(triggerSection).not.toContain('@Transactional()')
  })
})

describe('AdminDataPullTaskController query handling', () => {
  it('passes validated execution pagination query to the service', async () => {
    const service = { listExecutions: jest.fn().mockResolvedValue({ items: [], total: 0 }) }
    const controller = new AdminDataPullTaskController(service as never)

    await controller.listExecutions(42, { page: 2, limit: 5 })

    expect(service.listExecutions).toHaveBeenCalledWith(42, 2, 5)
  })
})
