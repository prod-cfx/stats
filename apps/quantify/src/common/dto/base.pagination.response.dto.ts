import { ApiProperty } from '@nestjs/swagger'

export class BasePaginationResponseDto<T> {
  @ApiProperty({
    description: '鏁版嵁鎬婚噺',
    example: 120,
  })
  readonly total: number

  @ApiProperty({
    description: '褰撳墠椤电爜',
    example: 1,
  })
  readonly page: number

  @ApiProperty({
    description: '姣忛〉鏁伴噺',
    example: 20,
  })
  readonly limit: number

  @ApiProperty({
    description: '褰撳墠椤垫暟鎹垪琛?,
    type: [Object],
  })
  readonly items: T[]

  constructor(total: number, page: number, limit: number, items: T[]) {
    this.total = total
    this.page = page
    this.limit = limit
    this.items = items
  }
}
