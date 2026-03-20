import { ApiProperty } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class AdminRoleListQueryDto extends BasePaginationRequestDto {
  @ApiProperty({ description: '按角色名称模糊搜索', required: false })
  @IsOptional()
  @IsString()
  name?: string

  @ApiProperty({ description: '按角色编码模糊搜索', required: false })
  @IsOptional()
  @IsString()
  code?: string
}


