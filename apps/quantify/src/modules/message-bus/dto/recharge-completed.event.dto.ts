import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * 充值完成事件载荷
 * 当支付订单完成并成功入账后发布此事件
 */
export class RechargeCompletedEventDto {
  @ApiProperty({ description: '用户ID', example: 'user_123' })
  userId: string

  @ApiProperty({ description: '完整入账金额（基础+赠送）', example: '3300.000000' })
  amount: string

  @ApiProperty({ description: '基础积分金额', example: '3000.000000' })
  baseAmount: string

  @ApiProperty({ description: '赠送积分金额', example: '300.000000' })
  bonusAmount: string

  @ApiProperty({ description: '赠送百分比', example: 10 })
  bonusPercent: number

  @ApiProperty({ description: '套餐价格（美元）', example: '20.00' })
  priceUSD: string

  @ApiProperty({ description: '套餐标签', example: '进阶套餐' })
  packageLabel: string

  @ApiProperty({ description: '资产类型ID', example: 'asset_score' })
  assetTypeId: string

  @ApiProperty({ description: '支付渠道', example: 'WGQPAY' })
  channel: string

  @ApiProperty({ description: '源订单ID', example: 'order_abc123' })
  sourceId: string

  @ApiProperty({ description: '事件时间戳（ISO 8601）', example: '2025-10-01T12:00:00.000Z' })
  timestamp: string

  @ApiPropertyOptional({ description: '单位数量（用于活动统计）', example: 1, default: 1 })
  units?: number
}
