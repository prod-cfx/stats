/* eslint-disable perfectionist/sort-imports -- 按 NestJS 语义分组导入，避免自动排序影响可读性 */

import {
  Controller,
  Get,
  HttpStatus,
  Query,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { BaseResponseDto } from '@/common/dto/base.dto'
import {
  ReadAny,
  RequireAuth,
} from '@/modules/auth/decorators/access-control.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
// DTO 必须用值导入以保留运行时元数据
// eslint-disable-next-line ts/consistent-type-imports
import {
  CryptoStockQuoteResponseDto,
  GetLatestCryptoStockQuotesQueryDto,
} from './dto/crypto-stock-quote.dto'
// Nest 注入需要运行时引用 Service
// eslint-disable-next-line ts/consistent-type-imports
import { CryptoStockQuotesService } from './crypto-stock-quotes.service'

const baseResponseSchema = (dataSchema: Record<string, unknown>) => ({
  allOf: [
    { $ref: getSchemaPath(BaseResponseDto) },
    {
      properties: {
        data: dataSchema,
      },
    },
  ],
})

@ApiTags('crypto-stock-quotes')
@ApiBearerAuth()
@Controller('crypto-stock-quotes')
export class CryptoStockQuotesController {
  constructor(private readonly service: CryptoStockQuotesService) {}

  @Get('latest')
  @RequireAuth()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({
    summary: '获取加密相关股票的最新报价列表',
    description:
      '返回每个股票代码（symbol）的最新一条报价记录，可通过 symbols 过滤特定标的',
  })
  @ApiQuery({
    name: 'symbols',
    required: false,
    description: '股票代码列表，使用英文逗号分隔，例如：MSTR,COIN,MARA',
    example: 'MSTR,COIN,MARA',
  })
  @ApiQuery({
    name: 'source',
    required: false,
    description: '数据源标识，例如：BBX；为空时使用默认数据源',
    example: 'BBX',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '查询成功',
    schema: baseResponseSchema({
      type: 'array',
      items: {
        $ref: getSchemaPath(CryptoStockQuoteResponseDto),
      },
    }),
  })
  async getLatest(@Query() query: GetLatestCryptoStockQuotesQueryDto) {
    const data = await this.service.getLatestQuotes(query.symbols ?? null, query.source)
    return new BaseResponseDto(data)
  }
}


