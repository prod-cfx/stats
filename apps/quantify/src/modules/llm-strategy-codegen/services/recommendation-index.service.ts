import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class RecommendationIndexService {
  private readonly logger = new Logger(RecommendationIndexService.name)

  async onSpecDescPersisted(payload: { versionId: string; specDesc: Record<string, unknown> }): Promise<void> {
    // MVP 闃舵鍙繚鐣欐帴鍙ｄ笌鏃ュ織锛屽悗缁彲鍦ㄦ鎺ュ叆鍚戦噺绱㈠紩
    this.logger.debug(`specDesc indexed (placeholder): versionId=${payload.versionId}`)
  }
}
