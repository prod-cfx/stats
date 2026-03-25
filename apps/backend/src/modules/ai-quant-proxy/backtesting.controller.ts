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
  ): Promise<unknown> {
    return this.service.getBacktestCapabilities(authorization)
  }

  @Post('jobs')
  async createJob(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    return this.service.createBacktestJob(authorization, body)
  }

  @Get('jobs/:id')
  async getJob(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.getBacktestJob(authorization, id)
  }

  @Get('jobs/:id/result')
  async getJobResult(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.getBacktestJobResult(authorization, id)
  }
}
