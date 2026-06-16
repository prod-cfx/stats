import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Public } from '@/modules/auth/decorators/public.decorator'
// eslint-disable-next-line ts/consistent-type-imports
import { HealthService } from './health.service'

const healthResponseSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'object',
      properties: {
        service: { type: 'string', example: 'backend' },
        status: { type: 'string', example: 'ok', enum: ['ok', 'degraded', 'down'] },
        timestamp: { type: 'string', example: '2025-11-15T14:00:00.000Z' },
      },
    },
    message: {
      type: 'string',
      example: 'Success',
    },
  },
}

@ApiTags('Health')
@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: '健康检查' })
  @ApiResponse({
    status: 200,
    description: '服务健康状态',
    schema: healthResponseSchema,
  })
  health() {
    return this.healthService.getHealth()
  }

  @Get('live')
  @ApiOperation({ summary: '存活检查' })
  @ApiResponse({
    status: 200,
    description: '进程存活状态',
    schema: healthResponseSchema,
  })
  live() {
    return this.healthService.getLiveHealth()
  }

  @Get('ready')
  @ApiOperation({ summary: '就绪检查' })
  @ApiResponse({
    status: 200,
    description: '服务依赖就绪状态',
    schema: healthResponseSchema,
  })
  @ApiResponse({
    status: 503,
    description: '服务依赖未就绪或应用正在停机',
  })
  ready() {
    return this.healthService.getReadyHealth()
  }
}
