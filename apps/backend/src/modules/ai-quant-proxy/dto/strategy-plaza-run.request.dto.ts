import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class StrategyPlazaRunRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  runRequestId!: string
}
