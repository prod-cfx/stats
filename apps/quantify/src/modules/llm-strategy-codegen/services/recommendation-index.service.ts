import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class RecommendationIndexService {
  private readonly logger = new Logger(RecommendationIndexService.name)

  async onSpecDescPersisted(payload: { versionId: string; specDesc: Record<string, unknown> }): Promise<void> {
    // MVP 阶段只保留接口与日志，后续可在此接入向量索引
    this.logger.debug(`specDesc indexed (placeholder): versionId=${payload.versionId}`)
  }
}
