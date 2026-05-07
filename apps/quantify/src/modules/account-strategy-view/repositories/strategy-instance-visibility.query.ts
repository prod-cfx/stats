import type { Prisma } from '@/prisma/prisma.types'

export const STRATEGY_ARCHIVE_REASON_USER_DELETE = 'USER_DELETE'

/**
 * 用户可见过滤：仅排除已归档（archivedAt）实例。
 *
 * view-only 实例（viewOnlyAt 非空）仍然 visible —— 在「我的策略」列表里展示
 * 为只读，用户可以查看详情，但不会再参与重新运行 / plaza 复用。
 *
 * 适用：列表 / 详情 / 删除入口的查找。
 */
export function visibleStrategyInstanceWhere(
  where: Prisma.StrategyInstanceWhereInput,
): Prisma.StrategyInstanceWhereInput {
  return {
    ...where,
    archivedAt: null,
  }
}

/**
 * 可运行过滤：同时排除 archived 与 view-only。
 *
 * 用户主动把策略转为只读 = 显式表达「不再运行这个策略」。plaza 再次运行
 * 与 account 部署复用都不应再命中已只读的实例，否则用户会通过策略广场
 * 「再次运行」把已归档/只读的策略复活，违反规格。
 *
 * 适用：plaza 复用、deploy reuse 等"复活"路径的查找。
 *
 * **必须与 partial unique 索引保持同步：**
 * `apps/quantify/prisma/schema/migrations/20260507031812_strategy_instance_unique_excludes_view_only/migration.sql`
 * 中的 `uniq_strategy_instance_runnable_template_model_name` 索引使用相同
 * 的 `WHERE archived_at IS NULL AND view_only_at IS NULL` 谓词。未来如果
 * 新增一列「软退役」状态（如 `pausedAt`），helper 与索引必须同步增加该
 * 字段，否则 plaza/deploy 复用会再次撞 P2002。本同步关系受
 * strategy-plaza-official-snapshot.repository.spec.ts 的字段断言保护。
 */
export function runnableStrategyInstanceWhere(
  where: Prisma.StrategyInstanceWhereInput,
): Prisma.StrategyInstanceWhereInput {
  return {
    ...where,
    archivedAt: null,
    viewOnlyAt: null,
  }
}
