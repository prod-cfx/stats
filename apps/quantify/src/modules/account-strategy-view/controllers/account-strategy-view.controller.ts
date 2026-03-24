import type { AccountStrategyDetailResponseDto } from '../dto/account-strategy-detail.response.dto'
import type { AccountStrategyListItemDto } from '../dto/account-strategy-list-item.dto'
import type { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { Transactional } from '@nestjs-cls/transactional'
import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common'
import { AccountStrategyActionDto } from '../dto/account-strategy-action.dto'
import { AccountStrategyDeployDto } from '../dto/account-strategy-deploy.dto'
import { AccountStrategyListQueryDto } from '../dto/account-strategy-list.query.dto'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { AccountStrategyCallerIdentityService } from '../services/account-strategy-caller-identity.service'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { AccountStrategyViewService } from '../services/account-strategy-view.service'

@Controller('account/ai-quant/strategies')
export class AccountStrategyViewController {
  // Keep DTOs as runtime values so Nest can emit decorator metadata for body/query binding.
  private static readonly dtoRefs = [
    AccountStrategyActionDto,
    AccountStrategyDeployDto,
    AccountStrategyListQueryDto,
  ]

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

  @Transactional()
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

  @Transactional()
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
