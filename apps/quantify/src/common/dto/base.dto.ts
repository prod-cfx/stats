import { ApiProperty } from '@nestjs/swagger'

export class BaseResponseDto<T> {
  @ApiProperty({
    description: '鍝嶅簲鏁版嵁',
  })
  readonly data: T

  @ApiProperty({
    description: '鎻愮ず淇℃伅',
    required: false,
    example: 'Success',
  })
  readonly message?: string

  constructor(data: T, message = 'Success') {
    this.data = data
    this.message = message
  }
}
