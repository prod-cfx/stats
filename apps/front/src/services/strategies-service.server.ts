import type { StrategiesPageData, StrategyDetail } from '@/types/strategies'
import { mapLlmStrategyInstanceToDetail, mapLlmStrategyInstanceToStrategy } from '@/lib/mappers'
import { fetchLlmStrategyInstanceDetailServer, fetchLlmStrategyInstancesServer } from '@/lib/server-api'

/**
 * 获取策略列表页面数据（服务端）
 * 使用 cookies token，支持 SSR
 * ⚠️ 仅在 Server Components 中使用
 */
export async function getStrategiesPageDataServer(): Promise<StrategiesPageData> {
  const response = await fetchLlmStrategyInstancesServer({ page: 1, limit: 20 })
  
  const strategies = response.items?.map(mapLlmStrategyInstanceToStrategy) || []
  
  return {
    title: 'AI 策略',
    subtitle: '展示当前正在运行的官方 AI 策略，后续可扩展为开放策略市场。',
    strategies,
  }
}

/**
 * 获取策略详情（服务端）
 * 使用 cookies token，支持 SSR
 * ⚠️ 仅在 Server Components 中使用
 */
export async function getStrategyDetailServer(id: string): Promise<StrategyDetail> {
  const dto = await fetchLlmStrategyInstanceDetailServer(id)
  return mapLlmStrategyInstanceToDetail(dto)
}
