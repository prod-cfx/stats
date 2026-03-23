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
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import {
  OptionalAccessControl,
  ReadAny,
} from '@/modules/auth/decorators/access-control.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
// Nest 注入需要运行时引用 WhaleHoldingsService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { WhaleHoldingsService } from './whale-holdings.service'

/* eslint-enable perfectionist/sort-imports */

@ApiTags('鲸鱼持仓')
@ApiBearerAuth('bearer')
@ApiExtraModels(BasePaginationResponseDto, WhaleHoldingDto)
@Controller('whale-holdings')
export class WhaleHoldingsController {
  constructor(private readonly whaleHoldingsService: WhaleHoldingsService) {}

  @Get()
  @OptionalAccessControl()
  @ReadAny(AppResource.WHALE_TRACKING)
  @ApiOperation({
    summary: '获取当前鲸鱼持仓列表（基于 Hyperliquid Whale Position 快照）',
    description:
      '返回 Hyperliquid 平台上持仓价值超过指定阈值的鲸鱼实时持仓快照，每个用户+币种只有最新状态。',
  })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        { properties: { items: { type: 'array', items: { $ref: getSchemaPath(WhaleHoldingDto) } } } },
      ],
    },
  })
  async getWhaleHoldings(
    @Query() query: QueryWhaleHoldingsDto,
  ): Promise<BasePaginationResponseDto<WhaleHoldingDto>> {
    return this.whaleHoldingsService.getCurrentHoldings(query)
  }
}







