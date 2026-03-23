import type { AccountStrategyActionDto } from '../dto/account-strategy-action.dto'
import type { AccountStrategyDeployDto } from '../dto/account-strategy-deploy.dto'
import type { AccountStrategyDetailResponseDto } from '../dto/account-strategy-detail.response.dto'
import type { AccountStrategyListItemDto } from '../dto/account-strategy-list-item.dto'
import type { AccountStrategyListQueryDto } from '../dto/account-strategy-list.query.dto'
import type { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { AccountStrategyCallerIdentityService } from '../services/account-strategy-caller-identity.service'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { AccountStrategyViewService } from '../services/account-strategy-view.service'

@Controller('account/ai-quant/strategies')
export class AccountStrategyViewController {
  constructor(
    private readonly service: AccountStrategyViewService,
    private readonly callerIdentityService: AccountStrategyCallerIdentityService,
  ) {}

  @Get()
  async list(
    @Query() query: AccountStrategyListQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<BasePaginationResponseDto<AccountStrategyListItemDto>> {
    const userId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization)
    return this.service.listStrategies({
      ...query,
      userId,
    })
  }

  @Get(':id')
  async detail(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ): Promise<AccountStrategyDetailResponseDto> {
    const userId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization)
    return this.service.getStrategyDetail(userId, id)
  }

  @Post(':id/actions')
  async action(
    @Param('id') id: string,
    @Body() dto: AccountStrategyActionDto,
    @Headers('authorization') authorization?: string,
  ): Promise<AccountStrategyDetailResponseDto> {
    const userId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization)
    return this.service.performAction(id, {
      ...dto,
      userId,
    })
  }

  @Post('deploy')
  async deploy(
    @Body() dto: AccountStrategyDeployDto,
    @Headers('authorization') authorization?: string,
  ): Promise<AccountStrategyDetailResponseDto> {
    const userId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization)
    return this.service.deployStrategy({
      ...dto,
      userId,
    })
  }
}
