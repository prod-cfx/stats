import type { IndicatorSeriesQueryDto, IndicatorSnapshotQueryDto } from '../dto/internal-indicator-query.dto'
import { ErrorCode } from '@ai/shared'
import { Controller, Get, HttpStatus, Query } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { DomainException } from '@/common/exceptions/domain.exception'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂娉ㄥ叆 PrismaService
import { PrismaService } from '@/prisma/prisma.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂娉ㄥ叆 IndicatorValueRepository
import { IndicatorValueRepository } from '../repositories/indicator-value.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂娉ㄥ叆 IndicatorConfigService
import { IndicatorConfigService } from '../services/indicator-config.service'

@ApiTags('internal-indicators')
@Controller('internal/indicators')
export class InternalIndicatorsController {
  constructor(
    private readonly indicatorConfigService: IndicatorConfigService,
    private readonly indicatorValueRepository: IndicatorValueRepository,
    private readonly prisma: PrismaService,
  ) {}

  @Get('snapshot')
  @ApiOperation({ summary: '鑾峰彇鎸囧畾鏃跺埢鐨勬寚鏍囧揩鐓э紙渚?AI 浣跨敤锛? })
  @ApiOkResponse({ description: '鎸囨爣蹇収' })
  async getSnapshot(@Query() query: IndicatorSnapshotQueryDto) {
    const symbol = await this.getSymbol(query.symbol)
    const timeframe = mapTimeframe(query.timeframe)

    const runtimeConfigs = this.indicatorConfigService.getRuntimeConfigs(symbol.id, timeframe)
    const configIds =
      query.configIds && query.configIds.length
        ? runtimeConfigs.filter(c => query.configIds!.includes(c.id)).map(c => c.id)
        : runtimeConfigs.map(c => c.id)

    if (!configIds.length) {
      return {
        symbol: symbol.code,
        timeframe: query.timeframe,
        timestamp: query.at ?? null,
        values: {},
      }
    }

    const at = query.at ? new Date(query.at) : undefined

    const records = await this.indicatorValueRepository.getSnapshot({
      symbolId: symbol.id,
      timeframe,
      indicatorConfigIds: configIds,
      at,
    })

    const values: Record<string, number | null> = {}
    for (const record of records) {
      values[record.indicatorConfigId] =
        record.valueNumeric === null || record.valueNumeric === undefined ? null : Number(record.valueNumeric)
    }

    const timestamp = records.length ? records[records.length - 1]!.time.toISOString() : query.at ?? null

    return {
      symbol: symbol.code,
      timeframe: query.timeframe,
      timestamp,
      values,
    }
  }

  @Get('series')
  @ApiOperation({ summary: '鑾峰彇鎸囨爣鏃堕棿搴忓垪锛堜緵 AI 浣跨敤锛? })
  @ApiOkResponse({ description: '鎸囨爣鏃堕棿搴忓垪' })
  async getSeries(@Query() query: IndicatorSeriesQueryDto) {
    const symbol = await this.getSymbol(query.symbol)
    const timeframe = mapTimeframe(query.timeframe)

    const runtimeConfigs = this.indicatorConfigService.getRuntimeConfigs(symbol.id, timeframe)
    const configIds =
      query.configIds && query.configIds.length
        ? runtimeConfigs.filter(c => query.configIds!.includes(c.id)).map(c => c.id)
        : runtimeConfigs.map(c => c.id)

    if (!configIds.length) {
      return {
        symbol: symbol.code,
        timeframe: query.timeframe,
        points: [],
      }
    }

    const start = query.start ? new Date(query.start) : undefined
    const end = query.end ? new Date(query.end) : undefined

    const records = await this.indicatorValueRepository.getSeries({
      symbolId: symbol.id,
      timeframe,
      indicatorConfigIds: configIds,
      start,
      end,
      limit: query.limit,
    })

    const grouped = new Map<string, Record<string, number | null>>()

    for (const record of records) {
      const ts = record.time.toISOString()
      const existing = grouped.get(ts) ?? {}
      existing[record.indicatorConfigId] =
        record.valueNumeric === null || record.valueNumeric === undefined ? null : Number(record.valueNumeric)
      grouped.set(ts, existing)
    }

    const points = Array.from(grouped.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([timestamp, values]) => ({
        timestamp,
        values,
      }))

    return {
      symbol: symbol.code,
      timeframe: query.timeframe,
      points,
    }
  }

  private async getSymbol(code: string) {
    const client = this.prisma.getClient()
    const symbol = await client.symbol.findUnique({
      where: { code: code.trim().toUpperCase() },
      select: { id: true, code: true },
    })
    if (!symbol) {
      throw new DomainException('Symbol not found', {
        code: ErrorCode.MARKET_SYMBOL_NOT_FOUND,
        args: { symbol: code },
        status: HttpStatus.NOT_FOUND,
      })
    }
    return symbol
  }
}
