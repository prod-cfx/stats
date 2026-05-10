import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

/**
 * Phase 5 S7 follow-up (#1058) — drawdown 聚合写入 repository。
 *
 * caller R3 决策 A_new：drawdownPct 字段已迁到 `strategy_instances`（per-user single tenant），
 * 不再写 `llm_strategy_instances`。signal-generator 消费的是 StrategyInstance，直接 join
 * 路径：`UserStrategyAccount` → `(userId, strategyId == strategyTemplateId)` → `StrategyInstance`。
 *
 * 公式与 backtest-strategy-adapter.service.ts:117 / account-strategy-view.service.ts:1970 同源：
 *   per_account_dd = GREATEST(0, (peak_equity - equity) / peak_equity * 100)  -- peak_equity > 0
 *
 * 注：文件名/类名仍带 "LlmStrategyInstance" 是因为 module wiring 历史位置（避免
 * strategy-instances ↔ accounts 循环依赖）；实际作用域已是所有 StrategyInstance。
 */
@Injectable()
export class LlmStrategyInstanceDrawdownRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
  ) {}

  /**
   * 通过 accountId 反查所有受其影响的 StrategyInstance（per-user single tenant）。
   *
   * Join 路径：
   *   UserStrategyAccount(id=accountId)
   *     -> (userId, strategyId)
   *     -> StrategyInstance where strategyTemplateId=acct.strategyId AND createdBy=acct.userId
   *
   * 注：archived_at IS NULL 排除已归档 instance；status 不限（draft/running/paused/stopped 都可 hold drawdown 快照）
   */
  async findInstancesAffectedByAccount(accountId: string): Promise<{ id: string }[]> {
    const rows = await this.txHost.tx.$queryRaw<Array<{ id: string }>>`
      SELECT DISTINCT i.id
      FROM user_strategy_accounts a
      JOIN strategy_instances i
        ON i.strategy_template_id = a.strategy_id
       AND i.created_by = a.user_id
      WHERE a.id = ${accountId}
        AND i.archived_at IS NULL
    `
    return rows
  }

  /**
   * 计算指定 instance 的 drawdownPct（per-user single tenant；无可用数据返回 null）。
   *
   * 仅纳入 (userId == instance.created_by, strategyId == instance.strategy_template_id) 对应的
   * UserStrategyAccount 且 peakEquity > 0 / equity NOT NULL。无匹配账户 → 返回 null（让 consumer 走 fail-closed）。
   */
  async aggregateInstanceDrawdown(instanceId: string): Promise<number | null> {
    const rows = await this.txHost.tx.$queryRaw<Array<{ dd: number | null }>>`
      SELECT GREATEST(
        0,
        ((a.peak_equity - a.equity) / a.peak_equity) * 100
      )::DOUBLE PRECISION AS dd
      FROM strategy_instances i
      JOIN user_strategy_accounts a
        ON a.user_id = i.created_by
       AND a.strategy_id = i.strategy_template_id
      WHERE i.id = ${instanceId}
        AND a.peak_equity IS NOT NULL
        AND a.peak_equity > 0
        AND a.equity IS NOT NULL
      LIMIT 1
    `
    return rows[0]?.dd ?? null
  }

  /**
   * 写回 instance.drawdownPct + lastDrawdownRecalcAt + 可选 peakEquity 快照。
   * value=null 时也写入（让 fail-closed 路径生效）；recalcAt 始终写当前时间用于哨兵观察。
   */
  async writeInstanceDrawdown(
    instanceId: string,
    drawdownPct: number | null,
    peakEquity?: import('@/prisma/prisma.types').Prisma.Decimal | null,
  ): Promise<void> {
    await this.txHost.tx.strategyInstance.update({
      where: { id: instanceId },
      data: {
        drawdownPct,
        lastDrawdownRecalcAt: new Date(),
        ...(peakEquity !== undefined ? { peakEquity } : {}),
      },
    })
  }
}
