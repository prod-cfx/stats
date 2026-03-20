import type { WhaleNotificationInboxService } from '../services/whale-notification-inbox.service'
import { Controller, Get, HttpCode, Inject, Patch, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { WhaleNotificationInboxResponseDto } from '../dto/whale-notification-inbox.response.dto'
import { WhaleNotificationInboxService as WhaleNotificationInboxServiceToken } from '../services/whale-notification-inbox.service'

@ApiTags('whale-notification')
@ApiBearerAuth('bearer')
@Auth()
@Controller('whale-notification/notifications')
export class WhaleNotificationInboxController {
  constructor(
    @Inject(WhaleNotificationInboxServiceToken)
    private readonly service: WhaleNotificationInboxService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取当前用户通知收件箱' })
  @ApiOkResponse({ type: WhaleNotificationInboxResponseDto, isArray: true })
  async list(@CurrentUser('id') userId: string): Promise<WhaleNotificationInboxResponseDto[]> {
    return this.service.list(userId)
  }

  @Patch(':id/read')
  @ApiOperation({ summary: '标记单条通知已读' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: { success: { type: 'boolean', example: true } },
        },
        message: { type: 'string', example: 'Success' },
      },
    },
  })
  async markRead(@CurrentUser('id') userId: string, @Param('id') id: string): Promise<{ success: boolean }> {
    await this.service.markRead(userId, id)
    return { success: true }
  }

  @Post('read-all')
  @HttpCode(200)
  @ApiOperation({ summary: '标记当前用户全部通知已读' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: { success: { type: 'boolean', example: true } },
        },
        message: { type: 'string', example: 'Success' },
      },
    },
  })
  async markAllRead(@CurrentUser('id') userId: string): Promise<{ success: boolean }> {
    await this.service.markAllRead(userId)
    return { success: true }
  }

  @Get('unread-count')
  @ApiOperation({ summary: '获取当前用户未读通知数量' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: { unread: { type: 'number', example: 3 } },
        },
        message: { type: 'string', example: 'Success' },
      },
    },
  })
  async unreadCount(@CurrentUser('id') userId: string): Promise<{ unread: number }> {
    const unread = await this.service.unreadCount(userId)
    return { unread }
  }
}
