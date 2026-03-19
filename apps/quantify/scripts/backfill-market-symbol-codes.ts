import { PrismaClient } from '../generated/prisma'

interface SymbolRow {
  id: string
  code: string
}

interface BackfillPlanItem {
  id: string
  from: string
  to: string
}

interface BackfillOptions {
  apply: boolean
}

export const toSpotCode = (code: string): string | null => {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return null
  if (normalized.includes(':')) return null
  return `${normalized}:SPOT`
}

export const buildBackfillPlan = (rows: SymbolRow[]): BackfillPlanItem[] => {
  const updates: BackfillPlanItem[] = []
  for (const row of rows) {
    const next = toSpotCode(row.code)
    if (!next || next === row.code) continue
    updates.push({ id: row.id, from: row.code, to: next })
  }
  return updates
}

export const runBackfill = async (
  prisma: Pick<PrismaClient, '$transaction'> & {
    symbol: {
      findMany: (args: unknown) => Promise<SymbolRow[]>
      update: (args: unknown) => Promise<unknown>
    }
  },
  options: BackfillOptions,
) => {
  const rows = await prisma.symbol.findMany({
    select: { id: true, code: true },
  })

  const plan = buildBackfillPlan(rows)
  if (!options.apply) {
    return { scanned: rows.length, updated: 0, plan }
  }

  await prisma.$transaction(async tx => {
    for (const item of plan) {
      await tx.symbol.update({
        where: { id: item.id },
        data: { code: item.to },
      })
    }
  })

  return { scanned: rows.length, updated: plan.length, plan }
}

const parseArgs = (argv: string[]): BackfillOptions => {
  const apply = argv.includes('--apply')
  const dryRun = argv.includes('--dry-run')
  if (apply && dryRun) {
    throw new Error('不能同时使用 --apply 与 --dry-run')
  }
  return { apply }
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  const prisma = new PrismaClient()

  try {
    const result = await runBackfill(prisma, options)
    if (!options.apply) {
      console.log(`[dry-run] scanned=${result.scanned} pending=${result.plan.length}`)
      for (const item of result.plan) {
        console.log(`[dry-run] ${item.from} -> ${item.to}`)
      }
      return
    }

    console.log(`[apply] scanned=${result.scanned} updated=${result.updated}`)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`[backfill-market-symbol-codes] failed: ${(error as Error).message}`)
    process.exit(1)
  })
}
