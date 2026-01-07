/* eslint-disable perfectionist/sort-imports -- 按语义分组导入 DTO 与 Service，避免自动排序影响可读性与元数据推断 */

// DTO 必须使用值导入以保留运行时类型元数据，供 ValidationPipe 和 Swagger 使用
// eslint-disable-next-line ts/consistent-type-imports
import { QueryWhaleHoldingsDto, WhaleHoldingDto } from './dto/whale-holdings.dto'
import {
  Controller,
  Get,
  Query,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { ReadAny, RequireAuth } from '@/modules/auth/decorators/access-control.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
// Nest 注入需要运行时引用 WhaleHoldingsService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { WhaleHoldingsService } from './whale-holdings.service'

/* eslint-enable perfectionist/sort-imports */

@ApiTags('鲸鱼持仓')
@ApiBearerAuth('bearer')
@Controller('whale-holdings')
export class WhaleHoldingsController {
  constructor(private readonly whaleHoldingsService: WhaleHoldingsService) {}

  @Get()
  @RequireAuth()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({
    summary: '获取当前鲸鱼持仓列表（基于 Hyperliquid Whale Alert 数据）',
    description:
      '以 (user_address, symbol) 维度选取最新一条开仓记录，近似表示当前持仓，仅返回名义价值较大的鲸鱼持仓。',
  })
  @ApiOkResponse({ type: WhaleHoldingDto, isArray: true })
  async getWhaleHoldings(
    @Query() query: QueryWhaleHoldingsDto,
  ): Promise<WhaleHoldingDto[]> {
    return this.whaleHoldingsService.getCurrentHoldings(query)
  }
}


