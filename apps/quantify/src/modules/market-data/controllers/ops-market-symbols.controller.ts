import { Body, Controller, Param, Post, Put } from '@nestjs/common'
import {
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
 
import { BaseResponseDto } from '@/common/dto/base.dto'
 
import { MarketSymbolDto } from '../dto/market-symbol.response.dto'
import { CreateMarketSymbolDto, UpdateMarketSymbolDto } from '../dto/ops-market-symbol.dto'
// eslint-disable-next-line ts/consistent-type-imports -- 用于依赖注入，不能使用 import type
import { MarketDataService } from '../services/market-data.service'

@ApiTags('ops-market-symbols')
@Controller('ops/market-symbols')
@ApiExtraModels(BaseResponseDto, MarketSymbolDto)
export class OpsMarketSymbolsController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Post()
  @ApiOperation({ summary: '创建交易对（运营接口）' })
  @ApiBody({ type: CreateMarketSymbolDto })
  @ApiOkResponse({
    description: '创建成功',
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(MarketSymbolDto) },
          },
        },
      ],
    },
  })
  async create(@Body() dto: CreateMarketSymbolDto) {
    // 直接返回实体，TransformInterceptor 会自动包装为 BaseResponseDto
    return this.marketDataService.createSymbol(dto)
  }

  @Put(':code')
  @ApiOperation({ summary: '更新交易对（运营接口）' })
  @ApiBody({ type: UpdateMarketSymbolDto })
  @ApiOkResponse({
    description: '更新成功',
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(MarketSymbolDto) },
          },
        },
      ],
    },
  })
  async update(@Param('code') code: string, @Body() dto: UpdateMarketSymbolDto) {
    // 直接返回实体，TransformInterceptor 会自动包装为 BaseResponseDto
    return this.marketDataService.updateSymbol(code, dto)
  }
}
