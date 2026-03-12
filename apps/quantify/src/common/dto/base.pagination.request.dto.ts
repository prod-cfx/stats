import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, Max, Min } from 'class-validator'
import { PAGINATION_CONSTANTS } from '../constants/pagination.constants'

export class BasePaginationRequestDto {
  @ApiProperty({
    description: '椤电爜锛堜粠 1 寮€濮嬶級',
    example: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt({ message: '椤电爜蹇呴』鏄暣鏁? })
  @Min(1, { message: '椤电爜蹇呴』澶т簬鎴栫瓑浜?1' })
  page: number = 1

  @ApiProperty({
    description: `姣忛〉鏁伴噺锛堟渶澶?${PAGINATION_CONSTANTS.MAX_PAGE_SIZE}锛塦,
    example: PAGINATION_CONSTANTS.DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: PAGINATION_CONSTANTS.MAX_PAGE_SIZE,
  })
  @Type(() => Number)
  @IsInt({ message: '姣忛〉鏁伴噺蹇呴』鏄暣鏁? })
  @Min(1, { message: '姣忛〉鏁伴噺蹇呴』澶т簬鎴栫瓑浜?1' })
  @Max(PAGINATION_CONSTANTS.MAX_PAGE_SIZE, {
    message: `姣忛〉鏁伴噺涓嶈兘瓒呰繃 ${PAGINATION_CONSTANTS.MAX_PAGE_SIZE}`,
  })
  limit: number = PAGINATION_CONSTANTS.DEFAULT_PAGE_SIZE
}
