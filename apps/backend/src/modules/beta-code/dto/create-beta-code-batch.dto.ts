import { ApiProperty } from '@nestjs/swagger'
import { IsInt, Max, Min } from 'class-validator'

export class CreateBetaCodeBatchDto {
  @ApiProperty({ description: '生成数量', minimum: 1, maximum: 500 })
  @IsInt()
  @Min(1)
  @Max(500)
  count!: number

  @ApiProperty({ description: '每个内测码可用次数', minimum: 1, maximum: 1000 })
  @IsInt()
  @Min(1)
  @Max(1000)
  maxUsesPerCode!: number
}
