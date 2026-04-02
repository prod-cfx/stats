import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const quantifyRoot = join(__dirname, '../..')
const schemaPath = join(quantifyRoot, 'prisma/schema/backtesting_jobs.prisma')
const migrationPath = join(
  quantifyRoot,
  'prisma/schema/migrations/20260401120000_add_backtest_jobs_persistence/migration.sql',
)

describe('backtest job schema alignment', () => {
  it('keeps Prisma model status type aligned with the persisted migration column type', () => {
    const schema = readFileSync(schemaPath, 'utf8')
    const migration = readFileSync(migrationPath, 'utf8')

    const migrationStoresStatusAsText = migration.includes('"status" TEXT NOT NULL')
    const schemaUsesStringStatus = /status\s+String\b/.test(schema)

    expect(migrationStoresStatusAsText).toBe(true)
    expect(schemaUsesStringStatus).toBe(true)
  })
})
