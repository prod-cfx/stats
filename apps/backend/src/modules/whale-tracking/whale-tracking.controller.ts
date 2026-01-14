/* eslint-disable perfectionist/sort-imports -- 按语义分组导入，保持与其他模块一致 */

// DTO 必须使用值导入以保留运行时类型元数据，供 ValidationPipe 和 Swagger 使用
import { WhaleDiscoverResponseDto } from './dto/responses/whale-discover.response.dto'
// eslint-disable-next-line ts/consistent-type-imports
import {
  QueryWhaleAddressPerformanceDto,
  WhaleAddressPerformanceResponseDto,
} from './dto/whale-address-performance.dto'
// eslint-disable-next-line ts/consistent-type-imports
import {
  QueryTraderSnapshotDto,
  TraderSnapshotResponseDto,
} from './dto/trader-snapshot.dto'
// eslint-disable-next-line ts/consistent-type-imports
import {
  QueryTraderPositionsDto,
  TraderPositionsResponseDto,
} from './dto/trader-positions.dto'
// eslint-disable-next-line ts/consistent-type-imports
import {
  QueryTraderOpenOrdersDto,
  TraderOpenOrdersResponseDto,
} from './dto/trader-open-orders.dto'
import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { EthereumAddressPipe } from '@/common/pipes/ethereum-address.pipe'
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
    @Param('address', EthereumAddressPipe) address: string,
    @Query() query: QueryWhaleAddressPerformanceDto,
  ): Promise<WhaleAddressPerformanceResponseDto> {
    return this.whaleTrackingService.getTraderPerformance(address, query)
  }

  @Get('traders/:address/snapshot')
  @OptionalAccessControl()
  @ReadAny(AppResource.WHALE_TRACKING)
  @ApiOperation({
    summary: '获取鲸鱼交易者账户快照',
    description:
      '通过 Hyperliquid API 实时查询指定地址的账户快照数据，包括永续合约账户状态（账户价值、保证金使用率、杠杆倍数、未实现盈亏）与现货余额汇总。'
      + '数据直接来源于 Hyperliquid 清算所状态，默认缓存 5 秒。',
  })
  @ApiOkResponse({ type: TraderSnapshotResponseDto })
  async getTraderSnapshot(
    @Param('address', EthereumAddressPipe) address: string,
    @Query() query: QueryTraderSnapshotDto,
  ): Promise<TraderSnapshotResponseDto> {
    return this.whaleTrackingService.getTraderSnapshot(address, query)
  }

  @Get('traders/:address/positions')
  @OptionalAccessControl()
  @ReadAny(AppResource.WHALE_TRACKING)
  @ApiOperation({
    summary: '获取鲸鱼交易者持仓详情',
    description:
      '通过 Hyperliquid API 实时查询指定地址的持仓详情，包括永续合约持仓（币种、方向、数量、入场价、标记价、清算价、未实现盈亏、杠杆信息）'
      + '与现货余额（币种、总量、锁定量、可用量、价值）。支持按类型筛选（perp/spot/all），默认缓存 5 秒。',
  })
  @ApiOkResponse({ type: TraderPositionsResponseDto })
  async getTraderPositions(
    @Param('address', EthereumAddressPipe) address: string,
    @Query() query: QueryTraderPositionsDto,
  ): Promise<TraderPositionsResponseDto> {
    return this.whaleTrackingService.getTraderPositions(address, query)
  }

  @Get('traders/:address/open-orders')
  @OptionalAccessControl()
  @ReadAny(AppResource.WHALE_TRACKING)
  @ApiOperation({
    summary: '获取鲸鱼交易者挂单列表',
    description:
      '通过 Hyperliquid API 实时查询指定地址的当前挂单列表，包括订单 ID、币种、方向、类型、限价、数量、订单价值、创建时间等信息。'
      + '支持按币种筛选，默认缓存 5 秒。',
  })
  @ApiOkResponse({ type: TraderOpenOrdersResponseDto })
  async getTraderOpenOrders(
    @Param('address', EthereumAddressPipe) address: string,
    @Query() query: QueryTraderOpenOrdersDto,
  ): Promise<TraderOpenOrdersResponseDto> {
    return this.whaleTrackingService.getTraderOpenOrders(address, query)
  }
}







