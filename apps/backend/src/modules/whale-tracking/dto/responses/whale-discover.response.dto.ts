import { ApiProperty } from '@nestjs/swagger'

export type WhaleDiscoverAiTagKey = 'bullWarGod' | 'swingKing' | 'smartTrader' | 'treasuryKeeper' | 'twitterKol'

export class WhaleDiscoverTraderAiTagDto {
  @ApiProperty({
    description: 'AI 标签 key，用于前端 i18n 映射',
    enum: ['bullWarGod', 'swingKing', 'smartTrader', 'treasuryKeeper', 'twitterKol'],
  })
  key!: WhaleDiscoverAiTagKey

  @ApiProperty({ description: '文本颜色（十六进制或 CSS 颜色值）' })
  color!: string

  @ApiProperty({ description: '背景颜色（十六进制或 CSS 颜色值）' })
  bgColor!: string

  @ApiProperty({
    description: '描述文案对应的 i18n key，可选',
    enum: ['bullWarGod', 'swingKing', 'smartTrader', 'treasuryKeeper', 'twitterKol'],
    required: false,
  })
  descriptionKey?: WhaleDiscoverAiTagKey
}

export class WhaleDiscoverTraderDto {
  @ApiProperty({ description: '卡片展示变体：推荐卡片或详情卡片', enum: ['recommended', 'detail'] })
  variant!: 'recommended' | 'detail'

  @ApiProperty({ description: '鲸鱼地址（链上地址）' })
  address!: string

  @ApiProperty({
    description: '可选的社交/昵称 handle，例如 @machibigbrother',
    required: false,
    nullable: true,
  })
  handle?: string | null

  @ApiProperty({
    description: '推荐卡片右上角的小标签，例如 $10B HYPERUNIT WHALE',
    required: false,
    nullable: true,
  })
  tag?: string | null

  @ApiProperty({
    description:
      '总持仓名义价值（USD），基于最近一段时间内 Hyperliquid whale alert 数据的名义金额聚合，不代表账户实际资产净值',
  })
  totalValueUsd!: number

  @ApiProperty({
    description:
      '实现盈亏（USD）。当前实现为基于名义价值和多空方向推导的占位统计值，仅用于排序与可视化，不代表真实历史 PnL。',
  })
  pnlUsd!: number

  @ApiProperty({
    description: '盈亏标签 key，用于前端展示对应时间维度',
    enum: ['realizedPnl', 'realizedPnl1m'],
    required: false,
  })
  pnlLabelKey?: 'realizedPnl' | 'realizedPnl1m'

  @ApiProperty({
    description: '成交笔数（近一段时间内的鲸鱼预警条数）',
    required: false,
  })
  trades?: number

  @ApiProperty({
    description: '涉及的标的数量（近一段时间内出现过持仓预警的币种个数）',
    required: false,
  })
  positions?: number

  @ApiProperty({
    description:
      '胜率百分比（0-100）。当前实现为基于多空方向占比的占位算法，仅用于 discover 视图展示，不代表真实历史胜率。',
  })
  winRatePct!: number

  @ApiProperty({
    description: '胜率标签 key，用于前端展示对应时间维度',
    enum: ['winRate', 'winRate1m'],
    required: false,
  })
  winRateLabelKey?: 'winRate' | 'winRate1m'

  @ApiProperty({ description: '头像圆圈的主色调' })
  avatarColor!: string

  @ApiProperty({
    description: 'AI 风格标签列表（可选）',
    type: () => WhaleDiscoverTraderAiTagDto,
    isArray: true,
    required: false,
  })
  aiTags?: WhaleDiscoverTraderAiTagDto[]
}

export class WhaleDiscoverResponseDto {
  @ApiProperty({
    description: '推荐鲸鱼列表，用于页面顶部推荐卡片',
    type: () => WhaleDiscoverTraderDto,
    isArray: true,
  })
  recommended!: WhaleDiscoverTraderDto[]

  @ApiProperty({
    description: '鲸鱼详情列表，用于下方网格展示',
    type: () => WhaleDiscoverTraderDto,
    isArray: true,
  })
  details!: WhaleDiscoverTraderDto[]
}







