import type { AccountStrategyActionDto } from '../dto/account-strategy-action.dto'
import type { AccountStrategyDeployDto } from '../dto/account-strategy-deploy.dto'
import type { AccountStrategyDetailResponseDto } from '../dto/account-strategy-detail.response.dto'
import type { AccountStrategyListItemDto } from '../dto/account-strategy-list-item.dto'
import type { AccountStrategyListQueryDto } from '../dto/account-strategy-list.query.dto'
import type { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { Transactional } from '@nestjs-cls/transactional'
import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common'
import { MissingUserIdentityException, UserIdMismatchException } from '../exceptions'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { AccountStrategyViewService } from '../services/account-strategy-view.service'

@Controller('account/ai-quant/strategies')
export class AccountStrategyViewController {
  constructor(private readonly service: AccountStrategyViewService) {}

  @Get()
  async list(
    @Query() query: AccountStrategyListQueryDto,
    @Headers('x-user-id') headerUserId?: string,
  ): Promise<BasePaginationResponseDto<AccountStrategyListItemDto>> {
    const userId = this.resolveUserId(headerUserId, query.userId)
    return this.service.listStrategies({
      ...query,
      userId,
    })
  }

  @Get(':id')
  async detail(
    @Param('id') id: string,
    @Query('userId') queryUserId?: string,
    @Headers('x-user-id') headerUserId?: string,
  ): Promise<AccountStrategyDetailResponseDto> {
    const userId = this.resolveUserId(headerUserId, queryUserId)
    return this.service.getStrategyDetail(userId, id)
  }

  @Transactional()
  @Post(':id/actions')
  async action(
    @Param('id') id: string,
    @Body() dto: AccountStrategyActionDto,
    @Headers('x-user-id') headerUserId?: string,
  ): Promise<AccountStrategyDetailResponseDto> {
    const userId = this.resolveUserId(headerUserId, dto.userId)
    return this.service.performAction(id, {
      ...dto,
      userId,
    })
  }

  @Transactional()
  @Post('deploy')
  async deploy(
    @Body() dto: AccountStrategyDeployDto,
    @Headers('x-user-id') headerUserId?: string,
  ): Promise<AccountStrategyDetailResponseDto> {
    const userId = this.resolveUserId(headerUserId, dto.userId)
    return this.service.deployStrategy({
      ...dto,
      userId,
    })
  }

  private resolveUserId(headerUserId?: string, requestedUserId?: string): string {
    const authUserId = this.normalizeUserId(headerUserId)
    const inputUserId = this.normalizeUserId(requestedUserId)

    if (!authUserId && !inputUserId) {
      throw new MissingUserIdentityException()
    }

    if (authUserId && inputUserId && authUserId !== inputUserId) {
      throw new UserIdMismatchException({ authUserId, inputUserId })
    }

    return authUserId ?? inputUserId!
  }

  private normalizeUserId(value?: string): string | null {
    if (!value) return null
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }
}
