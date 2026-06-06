import { ApiProperty } from '@nestjs/swagger'

export class AdminDeleteResultResponseDto {
  @ApiProperty({ description: '是否删除成功', example: true })
  success!: boolean
}
