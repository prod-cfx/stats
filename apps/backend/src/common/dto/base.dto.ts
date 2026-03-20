import { ApiProperty } from '@nestjs/swagger'

export class BaseResponseDto<T> {
  @ApiProperty({
    description: '响应数据',
  })
  readonly data: T

  @ApiProperty({
    description: '提示信息',
    required: false,
    example: 'Success',
  })
  readonly message?: string

  constructor(data: T, message = 'Success') {
    this.data = data
    this.message = message
  }
}


