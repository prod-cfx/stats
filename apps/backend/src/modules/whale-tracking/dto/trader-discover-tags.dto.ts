import { ApiProperty } from '@nestjs/swagger'

import { WhaleDiscoverTraderAiTagDto } from './responses/whale-discover.response.dto'

export class TraderDiscoverTagsResponseDto {
  @ApiProperty({
    description: 'Discover 视角下的鲸鱼标签文案，例如 $10M+ HYPERUNIT WHALE',
    required: false,
    nullable: true,
  })
  tag!: string | null

  @ApiProperty({
    description: 'Discover 视角下的 AI 标签列表',
    type: () => WhaleDiscoverTraderAiTagDto,
    isArray: true,
  })
  aiTags!: WhaleDiscoverTraderAiTagDto[]
}
