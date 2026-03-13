import type { LlmStrategyRun } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'

import { LlmStrategyRunNotFoundException } from '../exceptions/llm-strategy-run-not-found.exception'
// eslint-disable-next-line ts/consistent-type-imports -- 闇€瑕佺敤浜庝緷璧栨敞鍏ワ紝涓嶈兘浣跨敤 import type
import { LlmStrategyRunsRepository } from '../repositories/llm-strategy-runs.repository'

@Injectable()
export class LlmStrategyRunsService {
  constructor(
    private readonly repository: LlmStrategyRunsRepository,
  ) {}

  async getDetail(id: string): Promise<LlmStrategyRun> {
    const record = await this.repository.findById(id)
    if (!record) {
      throw new LlmStrategyRunNotFoundException({ runId: id })
    }
    return record
  }

  async listRecentByInstance(
    instanceId: string,
    limit = 20,
  ): Promise<LlmStrategyRun[]> {
    return this.repository.listRecentByInstance(instanceId, limit)
  }
}
