import type { MessageEvent } from '@nestjs/common'
import type { Observable } from 'rxjs'
import type { WhaleTradeDto } from '../dto/whale-trade.dto'
import { Controller, Logger, Sse } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { interval, map, merge, mergeMap, switchMap } from 'rxjs'
import { createHeartbeatStream } from '@/common/utils/sse.utils'
import { OptionalAccessControl, ReadAny } from '@/modules/auth/decorators/access-control.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
// eslint-disable-next-line ts/consistent-type-imports
import { WhaleAlertService } from '../whale-alert.service'

@ApiTags('whale-alerts')
@ApiBearerAuth('bearer')
@Controller('whale-alerts')
export class WhaleAlertStreamController {
  private readonly logger = new Logger(WhaleAlertStreamController.name)

  constructor(private readonly whaleAlertService: WhaleAlertService) {}

  @Sse('realtime-stream')
  @OptionalAccessControl()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({ summary: '订阅 Hyperliquid 鲸鱼成交实时推送' })
  getRealtimeStream(): Observable<MessageEvent> {
    let lastQueryTime = new Date(Date.now() - 10_000).toISOString()

    const dataStream$ = interval(2000).pipe(
      switchMap(async (): Promise<WhaleTradeDto[]> => {
        try {
          const result = await this.whaleAlertService.getWhaleTrades({
            since: lastQueryTime,
            limit: 50,
            page: 1,
          })
          lastQueryTime = new Date().toISOString()
          return result.items
        } catch (err) {
          this.logger.warn(`Whale alerts query failed: ${err instanceof Error ? err.message : String(err)}`)
          return []
        }
      }),
      mergeMap((alerts: WhaleTradeDto[]) => alerts),
      map((alert: WhaleTradeDto) => ({ data: alert } as MessageEvent)),
    )

    return merge(dataStream$, createHeartbeatStream(15_000, 'whale-alerts'))
  }
}
