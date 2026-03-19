import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class GetAggregatedVolumeRequestDto extends BasePaginationRequestDto {
  @ApiProperty({
    description: '币种符号',
    example: 'BTC',
    required: true,
  })
  @IsString()
  symbol!: string

  @ApiProperty({
    description: '合约类型',
    example: 'PERPETUAL',
    enum: ['SPOT', 'PERPETUAL'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['SPOT', 'PERPETUAL'])
  instrumentType?: 'SPOT' | 'PERPETUAL'
}
