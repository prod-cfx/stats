/* eslint-disable perfectionist/sort-imports -- 按语义分组导入，保持与其他模块一致 */

// DTO 必须使用值导入以保留运行时类型元数据，供 ValidationPipe 和 Swagger 使用
import { WhaleDiscoverResponseDto } from './dto/responses/whale-discover.response.dto'
import { Controller, Get } from '@nestjs/common'
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
}







