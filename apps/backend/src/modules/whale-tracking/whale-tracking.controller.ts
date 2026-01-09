/* eslint-disable perfectionist/sort-imports -- 按语义分组导入，保持与其他模块一致 */

// DTO 必须使用值导入以保留运行时类型元数据，供 ValidationPipe 和 Swagger 使用
import { WhaleDiscoverResponseDto } from './dto/responses/whale-discover.response.dto'
// eslint-disable-next-line ts/consistent-type-imports
import {
  QueryWhaleAddressPerformanceDto,
  WhaleAddressPerformanceResponseDto,
} from './dto/whale-address-performance.dto'
import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { OptionalAccessControl, ReadAny } from '@/modules/auth/decorators/access-control.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
// eslint-disable-next-line ts/consistent-type-imports
import { WhaleTrackingService } from './whale-tracking.service'

@ApiTags('whale-tracking')
@ApiBearerAuth('bearer')
@Controller('whale-tracking')
export class WhaleTrackingController {
  constructor(private readonly whaleTrackingService: WhaleTrackingService) {}

  @Get('discover')
  @OptionalAccessControl()
  @ReadAny(AppResource.WHALE_TRACKING)
  @ApiOperation({
    summary: '鲸鱼发现页 - 获取推荐鲸鱼与详情列表',
    description:
      '基于 Hyperliquid 鲸鱼预警数据，按最近一段时间的持仓价值与活跃度聚合出一批代表性鲸鱼地址，用于 discover 页面渲染。',
  })
  @ApiOkResponse({ type: WhaleDiscoverResponseDto })
  async getDiscover(): Promise<WhaleDiscoverResponseDto> {
    return this.whaleTrackingService.getDiscoverWhales()
  }

  @Get('traders/:address/performance')
  @OptionalAccessControl()
  @ReadAny(AppResource.WHALE_TRACKING)
  @ApiOperation({
    summary: '鲸鱼地址维度的历史交易与绩效统计',
    description:
      '基于 Hyperliquid Whale Alert 数据，对指定鲸鱼地址在给定时间窗口内的名义价值、方向分布等信息做聚合统计，并返回按币种与时间排序的预警明细。'
      + '当前返回的 PnL 与胜率字段为占位统计值，仅用于可视化与排序，不代表真实历史盈亏/胜率。',
  })
  @ApiOkResponse({ type: WhaleAddressPerformanceResponseDto })
  async getTraderPerformance(
    @Param('address') address: string,
    @Query() query: QueryWhaleAddressPerformanceDto,
  ): Promise<WhaleAddressPerformanceResponseDto> {
    return this.whaleTrackingService.getTraderPerformance(address, query)
  }
}







