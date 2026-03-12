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
// eslint-disable-next-line ts/consistent-type-imports -- 鐢ㄤ簬渚濊禆娉ㄥ叆锛屼笉鑳戒娇鐢?import type
import { MarketDataService } from '../services/market-data.service'

@ApiTags('ops-market-symbols')
@Controller('ops/market-symbols')
@ApiExtraModels(BaseResponseDto, MarketSymbolDto)
export class OpsMarketSymbolsController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Post()
  @ApiOperation({ summary: '鍒涘缓浜ゆ槗瀵癸紙杩愯惀鎺ュ彛锛? })
  @ApiBody({ type: CreateMarketSymbolDto })
  @ApiOkResponse({
    description: '鍒涘缓鎴愬姛',
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
    // 鐩存帴杩斿洖瀹炰綋锛孴ransformInterceptor 浼氳嚜鍔ㄥ寘瑁呬负 BaseResponseDto
    return this.marketDataService.createSymbol(dto)
  }

  @Put(':code')
  @ApiOperation({ summary: '鏇存柊浜ゆ槗瀵癸紙杩愯惀鎺ュ彛锛? })
  @ApiBody({ type: UpdateMarketSymbolDto })
  @ApiOkResponse({
    description: '鏇存柊鎴愬姛',
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
    // 鐩存帴杩斿洖瀹炰綋锛孴ransformInterceptor 浼氳嚜鍔ㄥ寘瑁呬负 BaseResponseDto
    return this.marketDataService.updateSymbol(code, dto)
  }
}
