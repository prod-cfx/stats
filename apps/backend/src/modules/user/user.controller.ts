/* eslint-disable ts/consistent-type-imports */
import type { UserProfileResponseDto } from '@/modules/auth/dto/responses/user-profile.response.dto'

import { ErrorCode } from '@ai/shared'
import { Controller, Get, HttpStatus, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger'

import { DomainException } from '@/common/exceptions/domain.exception'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { UserProfileResponseDto as UserProfileResponseSchema } from '@/modules/auth/dto/responses/user-profile.response.dto'
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard'
import { UserService } from './user.service'

@Controller('users')
@ApiTags('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: UserProfileResponseSchema })
  async me(@CurrentUser('id') userId: string): Promise<UserProfileResponseDto> {
    const profile = await this.userService.findProfileById(userId)
    if (!profile) {
      throw new DomainException('User not found', {
        code: ErrorCode.USER_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    return {
      id: profile.id,
      email: profile.email,
      nickname: profile.nickname ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      emailVerified: profile.emailVerified,
      isGuest: profile.isGuest,
      roles: profile.roles,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    }
  }
}
/* eslint-enable ts/consistent-type-imports */
