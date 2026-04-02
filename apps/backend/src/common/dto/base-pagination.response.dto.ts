import { ApiProperty } from '@nestjs/swagger'

export class BasePaginationResponseDto<T> {
  @ApiProperty({
    description: '数据总量',
    example: 120,
  })
  readonly total: number

  @ApiProperty({
    description: '当前页码',
    example: 1,
  })
  readonly page: number

  @ApiProperty({
    description: '每页数量',
    example: 20,
  })
  readonly limit: number

  @ApiProperty({
    description: '当前页数据列表',
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


