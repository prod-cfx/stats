import { ApiProperty } from '@nestjs/swagger'

/**
 * 璁㈤槄鐢ㄦ埛淇℃伅
 */
export class SubscriberInfoDto {
  @ApiProperty({ description: '鐢ㄦ埛 ID', example: 'c1234567890123456789abcd' })
  userId: string

  @ApiProperty({ description: '鐢ㄦ埛鍚?, example: 'john_doe', required: false })
  username?: string

  @ApiProperty({ description: '鐢ㄦ埛閭', example: 'john@example.com', required: false })
  email?: string

  @ApiProperty({ description: '璁㈤槄鐘舵€?, enum: ['active', 'paused', 'cancelled'], example: 'active' })
  status: string

  @ApiProperty({ description: '璁㈤槄閲戦 (USDT)', example: 1000.0 })
  subscriptionAmount: number

  @ApiProperty({ description: '褰撳墠浠撲綅閲戦 (USDT)', example: 350.5 })
  currentPositionAmount: number

  @ApiProperty({ description: '鎸佷粨鏁伴噺', example: 2 })
  openPositionsCount: number

  @ApiProperty({ description: '缁戝畾鐨勪氦鏄撴墍璐︽埛 ID', required: false })
  exchangeAccountId?: string

  @ApiProperty({ description: '缁戝畾鐨勪氦鏄撴墍鍚嶇О', required: false })
  exchangeName?: string

  @ApiProperty({ description: '璁㈤槄鏃堕棿' })
  subscribedAt: Date

  @ApiProperty({ description: '鑷畾涔夊弬鏁?, required: false })
  customParams?: Record<string, any>
}

/**
 * 绛栫暐瀹炰緥璁㈤槄璇︽儏 DTO
 */
export class StrategyInstanceSubscriptionDetailsDto {
  @ApiProperty({ description: '绛栫暐瀹炰緥 ID', example: 'c1234567890123456789abcd' })
  strategyInstanceId: string

  @ApiProperty({ description: '绛栫暐瀹炰緥鍚嶇О', example: 'BTC 瓒嬪娍璺熼殢绛栫暐 v1' })
  strategyInstanceName: string

  @ApiProperty({ description: '绛栫暐妯℃澘鍚嶇О', example: 'BTC 瓒嬪娍璺熼殢' })
  strategyTemplateName: string

  @ApiProperty({ description: '璁㈤槄鐢ㄦ埛鎬绘暟', example: 15 })
  totalSubscribers: number

  @ApiProperty({ description: '娲昏穬璁㈤槄鏁?, example: 12 })
  activeSubscribers: number

  @ApiProperty({ description: '鏆傚仠璁㈤槄鏁?, example: 2 })
  pausedSubscribers: number

  @ApiProperty({ description: '宸插彇娑堣闃呮暟', example: 1 })
  cancelledSubscribers: number

  @ApiProperty({ description: '鎬昏闃呴噾棰?(USDT)', example: 15000.0 })
  totalSubscriptionAmount: number

  @ApiProperty({ description: '褰撳墠鎬讳粨浣嶉噾棰?(USDT)', example: 4250.75 })
  totalCurrentPositionAmount: number

  @ApiProperty({ description: '骞冲潎浠撲綅鍗犳瘮 (%)', example: 28.34 })
  averagePositionRatio: number

  @ApiProperty({ description: '鎬绘寔浠撴暟閲?, example: 23 })
  totalOpenPositions: number

  @ApiProperty({
    description: '璁㈤槄鐢ㄦ埛鍒楄〃',
    type: [SubscriberInfoDto]
  })
  subscribers: SubscriberInfoDto[]

  @ApiProperty({ description: '璁㈤槄鐢ㄦ埛鎬绘暟锛堢敤浜庡垎椤碉級', example: 150 })
  totalSubscribersCount: number

  @ApiProperty({ description: '褰撳墠椤电爜', example: 1 })
  currentPage: number

  @ApiProperty({ description: '姣忛〉鏁伴噺', example: 50 })
  pageSize: number

  @ApiProperty({ description: '鏈€鍚庢洿鏂版椂闂? })
  lastUpdatedAt: Date
}
