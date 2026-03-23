import type { IndicatorSeriesQueryDto, IndicatorSnapshotQueryDto } from '../dto/internal-indicator-query.dto'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时注入 IndicatorConfigService
import { IndicatorConfigService } from '../services/indicator-config.service'

@ApiTags('internal-indicators')
@Controller('internal/indicators')
export class InternalIndicatorsController {
  constructor(
    private readonly indicatorConfigService: IndicatorConfigService,
  ) {}

  @Get('snapshot')
  @ApiOperation({ summary: '获取指定时刻的指标快照（供 AI 使用）' })
  @ApiOkResponse({ description: '指标快照' })
  async getSnapshot(@Query() query: IndicatorSnapshotQueryDto) {
    const symbol = await this.indicatorConfigService.getSymbolByCode(query.symbol)
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

    const records = await this.indicatorConfigService.getIndicatorSnapshot({
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
  @ApiOperation({ summary: '获取指标时间序列（供 AI 使用）' })
  @ApiOkResponse({ description: '指标时间序列' })
  async getSeries(@Query() query: IndicatorSeriesQueryDto) {
    const symbol = await this.indicatorConfigService.getSymbolByCode(query.symbol)
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

    const records = await this.indicatorConfigService.getIndicatorSeries({
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
}
