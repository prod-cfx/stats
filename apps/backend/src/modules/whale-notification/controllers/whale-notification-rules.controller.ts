import type { WhaleNotificationRule } from '@prisma/client'
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { CreateWhaleNotificationRuleDto } from '../dto/create-whale-notification-rule.dto'
import { UpdateWhaleNotificationRuleDto } from '../dto/update-whale-notification-rule.dto'
import { WhaleNotificationRuleResponseDto } from '../dto/whale-notification-rule.response.dto'
import { WhaleNotificationRulesService } from '../services/whale-notification-rules.service'

@ApiTags('whale-notification')
@ApiBearerAuth('bearer')
@Auth()
@Controller('whale-notification/rules')
export class WhaleNotificationRulesController {
  constructor(private readonly service: WhaleNotificationRulesService) {}

  @Get()
  @ApiOperation({ summary: '获取当前用户的巨鲸通知规则' })
  @ApiOkResponse({ type: WhaleNotificationRuleResponseDto, isArray: true })
  async list(@CurrentUser('id') userId: string): Promise<WhaleNotificationRuleResponseDto[]> {
    const rows = await this.service.listByUser(userId)
    return rows.map(row => this.toResponse(row))
  }

  @Post()
  @ApiOperation({ summary: '创建巨鲸通知规则' })
  @ApiOkResponse({ type: WhaleNotificationRuleResponseDto })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWhaleNotificationRuleDto,
  ): Promise<WhaleNotificationRuleResponseDto> {
    const row = await this.service.create(userId, dto)
    return this.toResponse(row)
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新巨鲸通知规则' })
  @ApiOkResponse({ type: WhaleNotificationRuleResponseDto })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWhaleNotificationRuleDto,
  ): Promise<WhaleNotificationRuleResponseDto> {
    const row = await this.service.update(userId, id, dto)
    return this.toResponse(row)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除巨鲸通知规则' })
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
  async delete(@CurrentUser('id') userId: string, @Param('id') id: string): Promise<{ success: boolean }> {
    await this.service.delete(userId, id)
    return { success: true }
  }

  private toResponse(row: WhaleNotificationRule): WhaleNotificationRuleResponseDto {
    return {
      id: row.id,
      type: row.type,
      address: row.whaleAddress ?? undefined,
      symbol: row.symbol ?? undefined,
      thresholdUsd: Number(row.thresholdUsd),
      note: row.note ?? undefined,
      channels: {
        web: row.channelWeb,
        email: row.channelEmail,
        telegram: row.channelTelegram,
      },
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }
}
