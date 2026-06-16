import { ApiProperty } from '@nestjs/swagger'

import { UserProfileResponseDto } from './user-profile.response.dto'

export class AuthResponseDto {
  @ApiProperty({ description: '访问令牌', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string

  @ApiProperty({ description: '刷新令牌', required: false })
  refreshToken?: string

  @ApiProperty({ description: '访问令牌过期时间（字符串，例如 30m）', required: false })
  expiresIn?: string

  @ApiProperty({ description: '用户信息', type: () => UserProfileResponseDto })
  user!: UserProfileResponseDto
}
