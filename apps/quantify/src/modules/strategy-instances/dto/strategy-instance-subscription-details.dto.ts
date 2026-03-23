import { ApiProperty } from '@nestjs/swagger'

/**
 * 订阅用户信息
 */
export class SubscriberInfoDto {
  @ApiProperty({ description: '用户 ID', example: 'c1234567890123456789abcd' })
  userId: string

  @ApiProperty({ description: '用户名', example: 'john_doe', required: false })
  username?: string

  @ApiProperty({ description: '用户邮箱', example: 'john@example.com', required: false })
  email?: string

  @ApiProperty({ description: '订阅状态', enum: ['active', 'paused', 'cancelled'], example: 'active' })
  status: string

  @ApiProperty({ description: '订阅金额 (USDT)', example: 1000.0 })
  subscriptionAmount: number

  @ApiProperty({ description: '当前仓位金额 (USDT)', example: 350.5 })
  currentPositionAmount: number

  @ApiProperty({ description: '持仓数量', example: 2 })
  openPositionsCount: number

  @ApiProperty({ description: '绑定的交易所账户 ID', required: false })
  exchangeAccountId?: string

  @ApiProperty({ description: '绑定的交易所名称', required: false })
  exchangeName?: string

  @ApiProperty({ description: '订阅时间' })
  subscribedAt: Date

  @ApiProperty({ description: '自定义参数', required: false })
  customParams?: Record<string, any>
}

/**
 * 策略实例订阅详情 DTO
 */
export class StrategyInstanceSubscriptionDetailsDto {
  @ApiProperty({ description: '策略实例 ID', example: 'c1234567890123456789abcd' })
  strategyInstanceId: string

  @ApiProperty({ description: '策略实例名称', example: 'BTC 趋势跟随策略 v1' })
  strategyInstanceName: string

  @ApiProperty({ description: '策略模板名称', example: 'BTC 趋势跟随' })
  strategyTemplateName: string

  @ApiProperty({ description: '订阅用户总数', example: 15 })
  totalSubscribers: number

  @ApiProperty({ description: '活跃订阅数', example: 12 })
  activeSubscribers: number

  @ApiProperty({ description: '暂停订阅数', example: 2 })
  pausedSubscribers: number

  @ApiProperty({ description: '已取消订阅数', example: 1 })
  cancelledSubscribers: number

  @ApiProperty({ description: '总订阅金额 (USDT)', example: 15000.0 })
  totalSubscriptionAmount: number

  @ApiProperty({ description: '当前总仓位金额 (USDT)', example: 4250.75 })
  totalCurrentPositionAmount: number

  @ApiProperty({ description: '平均仓位占比 (%)', example: 28.34 })
  averagePositionRatio: number

  @ApiProperty({ description: '总持仓数量', example: 23 })
  totalOpenPositions: number

  @ApiProperty({ 
    description: '订阅用户列表',
    type: [SubscriberInfoDto]
  })
  subscribers: SubscriberInfoDto[]

  @ApiProperty({ description: '订阅用户总数（用于分页）', example: 150 })
  totalSubscribersCount: number

  @ApiProperty({ description: '当前页码', example: 1 })
  page: number

  @ApiProperty({ description: '每页数量', example: 50 })
  limit: number

  @ApiProperty({ description: '最后更新时间' })
  lastUpdatedAt: Date
}
