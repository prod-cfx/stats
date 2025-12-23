import { ApiProperty } from '@nestjs/swagger'

export class UserProfileResponseDto {
  @ApiProperty({ description: 'User ID', example: 'user_123' })
  id: string

  @ApiProperty({ description: 'Email', example: 'user@example.com' })
  email: string

  @ApiProperty({ description: 'Nickname', example: 'John Doe', required: false, nullable: true })
  nickname?: string | null

  @ApiProperty({ description: 'Avatar URL', example: 'https://example.com/avatar.png', required: false })
  avatarUrl?: string | null

  @ApiProperty({ description: 'Whether email is verified', example: true })
  emailVerified: boolean

  @ApiProperty({ description: 'Whether the user is a guest account', example: false })
  isGuest: boolean

  @ApiProperty({
    description: 'User roles',
    type: [String],
    example: ['user'],
  })
  roles: string[]

  @ApiProperty({
    description: 'User creation time',
    example: '2025-01-01T00:00:00.000Z',
  })
  createdAt: Date

  @ApiProperty({
    description: 'Last update time',
    example: '2025-01-02T00:00:00.000Z',
  })
  updatedAt: Date
}


