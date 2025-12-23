/**
 * 数据映射函数 - 将后端 DTO 转换为前端展示类型
 */

import type { schemas } from '@ai/api-contracts'
import type { LlmSubscriptionResponse, UserLlmStrategyInstanceResponse, TradingSignalResponse } from '@/lib/api'
import type { StrategyItem } from '@/types/my-strategies'
import type { ActionItem, Strategy, StrategyDetail } from '@/types/strategies'

// 使用 API contracts 的类型，避免手动定义导致类型漂移
type Infer<T> = T extends { _output: infer O } ? O : never

export type UserStrategyInstanceDto = Infer<typeof schemas.UserStrategyInstanceResponseDto>
export type SubscriptionDto = Infer<typeof schemas.SubscriptionResponseDto>

// 常量配置
export const STRATEGY_DEFAULTS = {
  ICON: '/images/strategy-trend.svg',
  RISK_LEVEL: 'Medium' as const,
  EMPTY_METRIC: '待加载',
} as const

/**
 * 将后端策略实例 DTO 转换为前端策略卡片类型
 */
export function mapStrategyInstanceToStrategy(dto: UserStrategyInstanceDto): Strategy {
  // 计算运行天数
  const runningDays = dto.startedAt
    ? Math.floor((Date.now() - new Date(dto.startedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  return {
    id: dto.id,
    name: dto.name,
    tags: [dto.llmModel, dto.strategyTemplateName || ''].filter(Boolean),
    description: dto.description || dto.strategyTemplateDescription || '暂无描述',
    icon: getStrategyIcon(dto.strategyTemplateName),
    stats: {
      monthlyReturn: '+0.0%', // TODO: 需要从性能指标接口获取
      maxDrawdown: '-0.0%', // TODO: 需要从性能指标接口获取
    },
    meta: {
      runningDays,
      followers: 0, // TODO: 需要从统计接口获取
      assetsUnderManagement: '0 USDT', // TODO: 需要从统计接口获取
    },
    riskLevel: STRATEGY_DEFAULTS.RISK_LEVEL,
  }
}

/**
 * 将后端策略实例 DTO 转换为前端策略详情类型
 */
export function mapStrategyInstanceToDetail(dto: UserStrategyInstanceDto): StrategyDetail {
  const baseStrategy = mapStrategyInstanceToStrategy(dto)

  return {
    ...baseStrategy,
    fullSubtitle: dto.description || '把它当成一个 7x24 小时在线的「AI 交易员」。',
    tagsDetailed: {
      category: 'AI 策略',
      market: dto.strategyTemplateName || '多市场',
      risk: '风险: 中',
    },
    modelTip: `模型版本: ${dto.llmModel} · 实例: ${dto.name}`,
    chart: {
      totalYield: '+0.0%',
      maxDrawdown: '-0.0%',
      annualYield: '+0.0%',
      winRate: '0.0%',
    },
    intro: {
      title: 'AI 决策逻辑简介',
      description: dto.description || '展示模型如何识别趋势并下单。',
      items: [
        `· 模型：${dto.llmModel}`,
        '· 输入：行情数据、资金费率、持仓量、盘口深度、情绪指标。',
        '· 识别：判断市场状态并给出置信度。',
        '· 风控：单笔亏损上限控制，日最大回撤自动停机。',
        '· 解释：每次开平仓都有「AI 决策理由」。',
      ],
    },
    recentActions: [], // 默认空数组，实际由信号接口填充
    isSubscribed: dto.isSubscribed, // 当前用户是否已订阅该策略
  }
}

/**
 * 将后端（用户侧）LLM 策略实例 DTO 转换为前端策略卡片类型
 */
export function mapLlmStrategyInstanceToStrategy(dto: UserLlmStrategyInstanceResponse): Strategy {
  const runningDays = dto.createdAt
    ? Math.floor((Date.now() - new Date(dto.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  return {
    id: dto.id,
    name: dto.name,
    tags: [dto.llmModel, dto.strategyName || ''].filter(Boolean),
    description: dto.description || dto.strategyDescription || '暂无描述',
    icon: getStrategyIcon(dto.strategyName),
    stats: {
      monthlyReturn: '+0.0%',
      maxDrawdown: '-0.0%',
    },
    meta: {
      runningDays,
      followers: 0,
      assetsUnderManagement: '0 USDT',
    },
    riskLevel: STRATEGY_DEFAULTS.RISK_LEVEL,
    // 保留 isSubscribed 状态（登录用户有值，匿名用户为 undefined）
    isSubscribed: dto.isSubscribed,
  }
}

/**
 * 将后端（用户侧）LLM 策略实例 DTO 转换为前端策略详情类型
 */
export function mapLlmStrategyInstanceToDetail(dto: UserLlmStrategyInstanceResponse): StrategyDetail {
  const baseStrategy = mapLlmStrategyInstanceToStrategy(dto)

  const description =
    dto.description || dto.strategyDescription || '展示模型如何识别趋势并下单。'

  return {
    ...baseStrategy,
    // 与列表卡片描述保持一致，优先展示策略本身的描述
    fullSubtitle: description,
    tagsDetailed: {
      category: 'AI 策略',
      market: dto.strategyName || '多市场',
      risk: '风险: 中',
    },
    modelTip: `模型版本: ${dto.llmModel} · 实例: ${dto.name}`,
    chart: {
      totalYield: '+0.0%',
      maxDrawdown: '-0.0%',
      annualYield: '+0.0%',
      winRate: '0.0%',
    },
    intro: {
      title: 'AI 决策逻辑简介',
      // 使用同一份描述，避免详情页与卡片信息不一致
      description,
      items: [
        `· 模型：${dto.llmModel}`,
        '· 输入：行情数据、资金费率、持仓量、盘口深度、情绪指标。',
        '· 识别：判断市场状态并给出置信度。',
        '· 风控：单笔亏损上限控制，日最大回撤自动停机。',
        '· 解释：每次开平仓都有「AI 决策理由」。',
      ],
    },
    recentActions: [],
    isSubscribed: dto.isSubscribed,
  }
}

/**
 * 将交易信号转换为前端展示用的最近行为记录
 */
export function mapTradingSignalsToRecentActions(
  signals: TradingSignalResponse[],
): ActionItem[] {
  return signals.map((signal) => {
    const isNoPositionChange =
      (!signal.positionSizeQuote || signal.positionSizeQuote === '0') &&
      !!signal.aiReasoning &&
      /观望|未满足.*开仓|未满足.*平仓|未满足.*条件/.test(signal.aiReasoning)

    const actionType: ActionItem['actionType'] =
      isNoPositionChange
        ? 'partial'
        : signal.signalType === 'ENTRY'
          ? 'open'
          : signal.signalType === 'EXIT'
            ? 'close'
            : 'partial'

    const action =
      isNoPositionChange
        ? '观望'
        : signal.signalType === 'ENTRY'
          ? '开仓'
          : signal.signalType === 'EXIT'
            ? '平仓'
            : signal.signalType === 'ADJUSTMENT'
              ? '调整仓位'
              : '提示'

    const direction: ActionItem['direction'] =
      signal.direction === 'BUY' || signal.direction === 'CLOSE_SHORT'
        ? 'Long'
        : 'Short'

    // 杠杆展示：优先从 metadata 中读取，否则用仓位比例或占位
    const leverageFromMeta = typeof signal.metadata?.leverage === 'string'
      ? signal.metadata.leverage
      : typeof signal.metadata?.leverage === 'number'
        ? `${signal.metadata.leverage}x`
        : undefined

    const margin =
      leverageFromMeta ??
      (signal.positionSizeRatio ? `${Number(signal.positionSizeRatio) * 100}%` : '—')

    return {
      time: signal.publishedAt,
      action,
      actionType,
      future: signal.symbolCode || signal.symbolId,
      margin,
      direction,
      amount: signal.positionSizeQuote ?? '0',
      price: signal.entryPrice ?? '—',
      reason: signal.aiReasoning ?? '无 AI 决策说明',
    }
  })
}

/**
 * 将后端订阅 DTO 转换为前端"我的策略"表格项
 */
export function mapSubscriptionToStrategyItem(
  subscription: SubscriptionDto | LlmSubscriptionResponse,
  options?: {
    icon?: string
    fund?: string
    pnl?: string
    amount?: number
  }
): StrategyItem {
  const statusMap = {
    active: { state: 'active' as const, text: '跟随中' },
    paused: { state: 'paused' as const, text: '已暂停' },
    cancelled: { state: 'error' as const, text: '已终止' },
  }

  const { state, text } = statusMap[subscription.status] || statusMap.active

  // 从 pnl 字符串中提取正负号
  const pnlValue = options?.pnl?.startsWith('+') ? '+' : options?.pnl?.startsWith('-') ? '-' : '+'

  return {
    id: subscription.id,
    llmStrategyInstanceId: 'llmStrategyInstanceId' in subscription
      ? subscription.llmStrategyInstanceId
      : subscription.strategyInstanceId,
    name: 'llmStrategyInstanceName' in subscription
      ? subscription.llmStrategyInstanceName
      : subscription.strategyInstanceName,
    subName: subscription.exchangeName || '未绑定交易所',
    icon: options?.icon || '/images/strategy-trend.svg',
    account: subscription.exchangeName || '未绑定',
    accountSub: subscription.exchangeAccountId?.slice(-8) || '-',
    fund: options?.fund || '0.00',
    pnl: options?.pnl || '0.00 (+0.00%)',
    pnlValue,
    amount: options?.amount || 0,
    state,
    stateText: text,
  }
}

/**
 * 根据策略模板名称选择合适的图标
 */
export function getStrategyIcon(templateName?: string): string {
  if (!templateName) return '/images/strategy-trend.svg'

  const name = templateName.toLowerCase()
  if (name.includes('trend')) return '/images/strategy-trend.svg'
  if (name.includes('swing')) return '/images/strategy-swing.svg'
  if (name.includes('arb')) return '/images/strategy-arb.svg'

  return '/images/strategy-trend.svg'
}

/**
 * 格式化日期为相对时间
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  if (days < 30) return `${Math.floor(days / 7)} 周前`
  return `${Math.floor(days / 30)} 月前`
}
