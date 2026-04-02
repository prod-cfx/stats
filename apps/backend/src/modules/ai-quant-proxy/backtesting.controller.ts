import { Body, Controller, Get, Headers, Inject, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { AuthRateLimitGuard } from '@/modules/auth/guards/auth-rate-limit.guard'
import { AiQuantProxyService } from './ai-quant-proxy.service'

@ApiTags('backtesting')
@ApiBearerAuth('bearer')
@Auth()
@Controller('backtesting')
export class BacktestingProxyController {
  constructor(
    @Inject(AiQuantProxyService)
    private readonly service: AiQuantProxyService,
  ) {}

  @Get('capabilities')
  @UseGuards(AuthRateLimitGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async capabilities(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ): Promise<unknown> {
    return this.service.getBacktestCapabilities(authorization, requestId)
  }

  @Post('symbols/check')
  async checkSymbolSupport(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    return this.service.checkBacktestSymbolSupport(authorization, body, requestId)
  }

  @Post('jobs')
  async createJob(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    return this.service.createBacktestJob(authorization, body, requestId)
  }

  @Get('jobs/:id')
  async getJob(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.getBacktestJob(authorization, id, requestId)
  }

  @Get('jobs/:id/result')
  async getJobResult(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.getBacktestJobResult(authorization, id, requestId)
  }
}
