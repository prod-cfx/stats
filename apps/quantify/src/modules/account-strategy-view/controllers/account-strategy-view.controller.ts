import type { AccountStrategyActionDto } from '../dto/account-strategy-action.dto'
import type { AccountStrategyDetailResponseDto } from '../dto/account-strategy-detail.response.dto'
import type { AccountStrategyListItemDto } from '../dto/account-strategy-list-item.dto'
import type { AccountStrategyListQueryDto } from '../dto/account-strategy-list.query.dto'
import type { AccountStrategyViewService } from '../services/account-strategy-view.service'
import type { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'

@Controller('account/ai-quant/strategies')
export class AccountStrategyViewController {
  constructor(private readonly service: AccountStrategyViewService) {}

  @Get()
  async list(
    @Query() query: AccountStrategyListQueryDto,
  ): Promise<BasePaginationResponseDto<AccountStrategyListItemDto>> {
    return this.service.listStrategies(query)
  }

  @Get(':id')
  async detail(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ): Promise<AccountStrategyDetailResponseDto> {
    return this.service.getStrategyDetail(userId, id)
  }

  @Post(':id/actions')
  async action(
    @Param('id') id: string,
    @Body() dto: AccountStrategyActionDto,
  ): Promise<AccountStrategyDetailResponseDto> {
    return this.service.performAction(id, dto)
  }
}
