import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
