/**
 * 持仓量数据模块使用示例
 * 
 * 本文件展示了如何在不同场景下使用 OpenInterest 模块
 */

import type { CreateOpenInterestDto } from '../dto/open-interest.dto'
import type { OpenInterestService } from '../open-interest.service'
import { Injectable } from '@nestjs/common'

@Injectable()
export class OpenInterestUsageExample {
  constructor(private readonly openInterestService: OpenInterestService) {}

  /**
   * 示例 1: 创建单条持仓量数据
   */
  async example1_CreateSingleRecord() {
    const data: CreateOpenInterestDto = {
      exchange: 'All',
      symbol: 'BTC',
      open_interest_usd: 57437891724.5572,
      open_interest_quantity: 659557.3064,
      open_interest_by_stable_coin_margin: 48920274435.15,
      open_interest_quantity_by_coin_margin: 97551.2547,
      open_interest_quantity_by_stable_coin_margin: 562006.0517,
      open_interest_change_percent_5m: 0.34,
      open_interest_change_percent_15m: 0.59,
      open_interest_change_percent_30m: 1.42,
      open_interest_change_percent_1h: 2.27,
      open_interest_change_percent_4h: 2.95,
      open_interest_change_percent_24h: 0.9,
      data_timestamp: new Date().toISOString(),
    }

    const result = await this.openInterestService.upsert(data)
    console.log('创建/更新成功:', result.id)
    return result
  }

  /**
   * 示例 2: 批量创建多个币种的持仓量数据
   */
  async example2_BatchCreateMultipleSymbols() {
    const symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP']
    const timestamp = new Date().toISOString()

    const dataList: CreateOpenInterestDto[] = symbols.map((symbol, index) => ({
      exchange: 'All',
      symbol,
      open_interest_usd: 10000000000 * (index + 1),
      open_interest_quantity: 100000 * (index + 1),
      open_interest_by_stable_coin_margin: 8000000000 * (index + 1),
      open_interest_quantity_by_coin_margin: 20000 * (index + 1),
      open_interest_quantity_by_stable_coin_margin: 80000 * (index + 1),
      open_interest_change_percent_5m: 0.34,
      open_interest_change_percent_15m: 0.59,
      open_interest_change_percent_30m: 1.42,
      open_interest_change_percent_1h: 2.27,
      open_interest_change_percent_4h: 2.95,
      open_interest_change_percent_24h: 0.9,
      data_timestamp: timestamp,
    }))

    const results = await this.openInterestService.batchUpsert(dataList)
    console.log(`批量创建成功: ${results.length} 条记录`)
    return results
  }

  /**
   * 示例 3: 获取最新的 BTC 持仓量数据
   */
  async example3_GetLatestBTCData() {
    const latest = await this.openInterestService.getLatest('All', 'BTC')
    
    if (latest) {
      console.log('BTC 最新持仓量:', {
        价值: `$${Number(latest.openInterestUsd).toLocaleString()}`,
        数量: Number(latest.openInterestQuantity).toLocaleString(),
        变化24h: `${latest.openInterestChangePercent24h}%`,
        时间: latest.dataTimestamp,
      })
    }

    return latest
  }

  /**
   * 示例 4: 查询指定时间范围的持仓量数据
   */
  async example4_QueryTimeRange() {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const result = await this.openInterestService.query({
      symbol: 'BTC',
      exchange: 'All',
      startTime: oneDayAgo.toISOString(),
      endTime: now.toISOString(),
      page: 1,
      limit: 100,
    } as any)

    console.log(`查询到 ${result.data.length} 条记录，总共 ${result.total} 条`)
    return result
  }

  /**
   * 示例 5: 获取 BTC 24小时持仓量统计
   */
  async example5_Get24HourStats() {
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000)

    const stats = await this.openInterestService.getStats(
      'BTC',
      startTime,
      endTime,
    )

    if (stats) {
      console.log('BTC 24小时持仓量统计:', {
        最高: `$${stats.max.toLocaleString()}`,
        最低: `$${stats.min.toLocaleString()}`,
        平均: `$${stats.avg.toLocaleString()}`,
        当前: `$${stats.latest.toLocaleString()}`,
        变化: `$${stats.change.toLocaleString()}`,
        变化率: `${stats.changePercent.toFixed(2)}%`,
        数据点: stats.dataPoints,
      })
    }

    return stats
  }

  /**
   * 示例 6: 比较多个交易所的持仓量
   */
  async example6_CompareExchanges() {
    const exchanges = ['Binance', 'OKX', 'Bybit', 'Deribit']
    const symbol = 'BTC'

    const results = await Promise.all(
      exchanges.map(exchange =>
        this.openInterestService.getLatest(exchange, symbol),
      ),
    )

    const comparison = exchanges.map((exchange, index) => ({
      exchange,
      openInterestUsd: results[index]
        ? Number(results[index].openInterestUsd)
        : 0,
      change24h: results[index]
        ? Number(results[index].openInterestChangePercent24h)
        : 0,
    }))

    // 按持仓量排序
    comparison.sort((a, b) => b.openInterestUsd - a.openInterestUsd)

    console.log(`${symbol} 各交易所持仓量对比:`)
    comparison.forEach(item => {
      console.log(
        `${item.exchange}: $${item.openInterestUsd.toLocaleString()} (${item.change24h}%)`,
      )
    })

    return comparison
  }

  /**
   * 示例 7: 检测持仓量异常变化
   */
  async example7_DetectAnomalies() {
    const symbols = ['BTC', 'ETH', 'SOL']
    const threshold = 5 // 5% 变化阈值

    const anomalies = []

    for (const symbol of symbols) {
      const latest = await this.openInterestService.getLatest('All', symbol)

      if (!latest) continue

      const change24h = Number(latest.openInterestChangePercent24h) || 0

      if (Math.abs(change24h) > threshold) {
        console.warn(`⚠️ ${symbol} 持仓量异常变化: ${change24h.toFixed(2)}%`)

        anomalies.push({ symbol, change24h })

        // 这里可以触发告警、发送通知等
        // 例如: await this.sendAlert(symbol, change24h)
      }
    }

    return anomalies
  }

  /**
   * 示例 8: 生成持仓量趋势报告
   */
  async example8_GenerateTrendReport() {
    const symbols = ['BTC', 'ETH', 'SOL', 'BNB']
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000) // 7天

    const report = await Promise.all(
      symbols.map(async symbol => {
        const stats = await this.openInterestService.getStats(
          symbol,
          startTime,
          endTime,
        )

        return {
          symbol,
          stats,
          trend: stats
            ? stats.changePercent > 0
              ? '📈 上升'
              : stats.changePercent < 0
                ? '📉 下降'
                : '➡️ 持平'
            : '⚠️ 无数据',
        }
      }),
    )

    console.log('=== 7天持仓量趋势报告 ===')
    report.forEach(item => {
      console.log(`${item.symbol}: ${item.trend}`)
      if (item.stats) {
        console.log(
          `  变化: ${item.stats.change.toLocaleString()} (${item.stats.changePercent.toFixed(2)}%)`,
        )
      }
    })

    return report
  }

  /**
   * 示例 9: 实时监控持仓量变化
   * @returns 返回取消监控的函数
   */
  async example9_RealTimeMonitoring(): Promise<() => void> {
    const symbol = 'BTC'
    const interval = 5 * 60 * 1000 // 5分钟

    // 获取初始数据
    let previousData = await this.openInterestService.getLatest('All', symbol)

    // 定期检查更新
    const intervalId = setInterval(async () => {
      const currentData = await this.openInterestService.getLatest(
        'All',
        symbol,
      )

      if (!currentData || !previousData) return

      const change =
        Number(currentData.openInterestUsd) -
        Number(previousData.openInterestUsd)
      const changePercent =
        (change / Number(previousData.openInterestUsd)) * 100

      console.log(`${symbol} 持仓量更新:`)
      console.log(
        `  当前: $${Number(currentData.openInterestUsd).toLocaleString()}`,
      )
      console.log(
        `  变化: $${change.toLocaleString()} (${changePercent.toFixed(2)}%)`,
      )

      previousData = currentData
    }, interval)

    // 返回清理函数，用于停止监控
    return () => {
      clearInterval(intervalId)
      console.log(`已停止 ${symbol} 的持仓量监控`)
    }
  }
}

/**
 * API 调用示例
 */
export class OpenInterestAPIExamples {
  /**
   * 使用 fetch 调用 API 的示例
   */
  static async fetchExamples() {
    const baseURL = 'http://localhost:3000/open-interest'

    // 1. 创建持仓量数据
    const _createResponse = await fetch(baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer YOUR_JWT_TOKEN',
      },
      body: JSON.stringify({
        exchange: 'All',
        symbol: 'BTC',
        open_interest_usd: 57437891724.5572,
        open_interest_quantity: 659557.3064,
        // ... 其他字段
        data_timestamp: new Date().toISOString(),
      }),
    })

    // 2. 查询持仓量数据
    const queryParams = new URLSearchParams({
      symbol: 'BTC',
      exchange: 'All',
      limit: '100',
    })
    const queryResponse = await fetch(`${baseURL}?${queryParams}`)
    const queryData = await queryResponse.json()

    // 3. 获取最新数据
    const latestResponse = await fetch(`${baseURL}/latest/All/BTC`)
    const latestData = await latestResponse.json()

    // 4. 获取统计数据
    const statsParams = new URLSearchParams({
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date().toISOString(),
    })
    const statsResponse = await fetch(`${baseURL}/stats/BTC?${statsParams}`)
    const statsData = await statsResponse.json()

    return { queryData, latestData, statsData }
  }
}
