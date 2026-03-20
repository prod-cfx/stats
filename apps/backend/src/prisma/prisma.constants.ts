export interface PrismaModuleOptions {
  slowQueryMs?: number
  criticalSlowQueryMs?: number
  monitoredTables?: string[]
}

export const PRISMA_OPTIONS = 'PRISMA_OPTIONS'

