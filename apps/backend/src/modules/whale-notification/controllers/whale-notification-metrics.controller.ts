import type { WhaleNotificationMetricsService } from '../services/whale-notification-metrics.service'
import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

@ApiTags('WhaleNotification')
@Controller('whale-notification/metrics')
export class WhaleNotificationMetricsController {
  constructor(private readonly metricsService: WhaleNotificationMetricsService) {}

  @Get()
  @ApiOperation({ summary: 'Whale 通知基础指标' })
  @ApiResponse({
    status: 200,
    description: 'Whale 通知流程计数器',
  })
  metrics() {
    return { data: this.metricsService.snapshot(), message: 'Success' }
  }
}
