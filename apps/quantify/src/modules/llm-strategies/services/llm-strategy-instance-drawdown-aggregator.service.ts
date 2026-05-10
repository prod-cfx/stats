import { Injectable, Logger } from '@nestjs/common'
import { LlmStrategyInstanceDrawdownRepository } from '../repositories/llm-strategy-instance-drawdown.repository'

/**
 * Phase 5 S7 follow-up (#1058) — live drawdown aggregator。
 *
 * caller R3 决策 A_new：drawdownPct 已迁到 `strategy_instances`（per-user single tenant）。
 * 在 settlement after-commit 路径被触发，重算受影响的 StrategyInstance.drawdownPct。
 * 异常时主动 invalidate（写 NULL）防 stale 高值导致的 fail-OPEN（critic M3）。
 *
 * In-flight dedupe（critic W1）：单进程内同一 accountId 重入时 short-circuit；跨进程不去重，
 * 由后续 Bull queue follow-up issue 兜底。
 *
 * 注：类名仍带 "LlmStrategyInstance" 是因为 module wiring 历史位置（避免 strategy-instances ↔
 * accounts 循环依赖）；实际写入目标已是 StrategyInstance。
 */
@Injectable()
export class LlmStrategyInstanceDrawdownAggregatorService {
  private readonly logger = new Logger(LlmStrategyInstanceDrawdownAggregatorService.name)
  private readonly inFlight = new Set<string>()

  constructor(
    private readonly repo: LlmStrategyInstanceDrawdownRepository,
  ) {}

  /**
   * 重算指定 account 影响到的所有 active instance 的 drawdownPct。
   * fire-and-forget 路径：任何失败都 swallow + 主动 invalidate；不向上抛。
   */
  async recomputeForAccount(accountId: string): Promise<void> {
    if (this.inFlight.has(accountId)) {
      this.logger.debug(`recomputeForAccount(${accountId}) already in flight, skipping`)
      return
    }
    this.inFlight.add(accountId)
    try {
      const instances = await this.repo.findInstancesAffectedByAccount(accountId)
      if (instances.length === 0) {
        this.logger.debug(`No active LlmStrategyInstance affected by account ${accountId}`)
        return
      }

      for (const { id: instanceId } of instances) {
        try {
          const drawdownPct = await this.repo.aggregateInstanceDrawdown(instanceId)
          await this.repo.writeInstanceDrawdown(instanceId, drawdownPct)
        } catch (error) {
          // 单 instance 失败：主动 invalidate 该 instance（设为 NULL → fail-closed），
          // 不影响后续 instance 的处理
          await this.safeInvalidate(instanceId, error)
        }
      }
    } catch (error) {
      // 顶层 throw（如 findInstancesAffectedByAccount 本身失败）：
      // 无法定位具体 instance，仅日志告警；下次 settlement 触发时会重试
      this.logger.error(
        `recomputeForAccount(${accountId}) failed at top-level: ${(error as Error).message}`,
        (error as Error).stack,
      )
    } finally {
      this.inFlight.delete(accountId)
    }
  }

  /**
   * 重算指定 instance 的 drawdownPct（不通过 account 反查，直接定位 instance）。
   * 适用于 subscription 状态变更（active ↔ cancelled / paused）的场景：
   * 取消订阅后该用户不再贡献，但 instance 仍可能有其他 active subs；需直接重算该 instance
   * 而不是通过 account → instances 路径（recomputeForAccount 仅查 active subs，cancel 后失效）。
   */
  async recomputeForInstance(instanceId: string): Promise<void> {
    try {
      const drawdownPct = await this.repo.aggregateInstanceDrawdown(instanceId)
      await this.repo.writeInstanceDrawdown(instanceId, drawdownPct)
    } catch (error) {
      await this.safeInvalidate(instanceId, error)
    }
  }

  /**
   * 安全 invalidate：写 NULL 防 stale 高值；自身异常吞掉防递归 throw（critic R-5）。
   */
  private async safeInvalidate(instanceId: string, originalError: unknown): Promise<void> {
    const errMsg = (originalError as Error)?.message ?? String(originalError)
    this.logger.warn(`Invalidating drawdownPct for instance ${instanceId} due to error: ${errMsg}`)
    try {
      await this.repo.writeInstanceDrawdown(instanceId, null)
    } catch (invalidateError) {
      this.logger.error(
        `safeInvalidate(${instanceId}) failed: ${(invalidateError as Error).message}`,
        (invalidateError as Error).stack,
      )
    }
  }
}
