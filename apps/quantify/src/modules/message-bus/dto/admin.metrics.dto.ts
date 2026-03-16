import { ApiProperty } from '@nestjs/swagger'

export class OutboxMetricsDto {
  @ApiProperty({ example: 12, description: '本进程累计领取的消息数' })
  claimed!: number

  @ApiProperty({ example: 10, description: '本进程累计成功派发的消息数' })
  sent!: number

  @ApiProperty({ example: 1, description: '本进程累计重试标记次数' })
  retry!: number

  @ApiProperty({ example: 1, description: '本进程累计标记为死信的消息数' })
  dead!: number

  @ApiProperty({ example: 280, description: '平均派发耗时（毫秒，成功样本）' })
  dispatchLatencyAvgMs!: number

  @ApiProperty({ example: 10, description: '用于计算平均时延的成功派发次数' })
  dispatchCount!: number
}

export class MessageBusMetricsSnapshotDto {
  @ApiProperty({ type: OutboxMetricsDto })
  outbox!: OutboxMetricsDto

  @ApiProperty({ example: '2025-09-04T03:30:00.000Z', description: '快照生成时间（ISO 字符串）' })
  timestamp!: string
}
