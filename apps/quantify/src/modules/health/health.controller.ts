import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
// eslint-disable-next-line ts/consistent-type-imports
import { HealthService } from './health.service'

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: '鍋ュ悍妫€鏌? })
  @ApiResponse({
    status: 200,
    description: '鏈嶅姟鍋ュ悍鐘舵€?,
    schema: {
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
    },
  })
  health() {
    return this.healthService.getHealth()
  }
}
