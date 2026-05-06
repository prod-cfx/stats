import type { Prisma } from '@/prisma/prisma.types'

export const STRATEGY_ARCHIVE_REASON_USER_DELETE = 'USER_DELETE'

export function visibleStrategyInstanceWhere(
  where: Prisma.StrategyInstanceWhereInput,
): Prisma.StrategyInstanceWhereInput {
  return {
    ...where,
    archivedAt: null,
  }
}
