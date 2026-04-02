import { ApiProperty } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base-pagination.request.dto'

export class AdminUserListQueryDto extends BasePaginationRequestDto {
  @ApiProperty({ description: '按用户名模糊搜索', required: false })
  @IsOptional()
  @IsString()
  keyword?: string
}


