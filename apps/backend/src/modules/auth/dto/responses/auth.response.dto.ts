import { ApiProperty } from '@nestjs/swagger'

import { UserProfileResponseDto } from './user-profile.response.dto'

export class AuthResponseDto {
  @ApiProperty({ description: '访问令牌', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string

  @ApiProperty({ description: '用户信息', type: () => UserProfileResponseDto })
  user!: UserProfileResponseDto
}

