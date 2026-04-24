/* eslint-disable ts/consistent-type-imports -- NestJS decorators require runtime imports for metadata */
import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { ApiExtraModels, ApiHeader, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger'
import { BaseResponseDto } from '@/common/dto/base.dto'
import { buildBaseResponseSchema } from '@/common/swagger/base-response-schema.helper'
import { AccountStrategyDetailResponseDto } from '@/modules/account-strategy-view/dto/account-strategy-detail.response.dto'
import { CallerIdentityService } from '@/modules/llm-strategy-codegen/services/caller-identity.service'
import { RunStrategyPlazaTemplateDto } from '../dto/run-strategy-plaza-template.dto'
import { StrategyPlazaEditSessionResponseDto } from '../dto/strategy-plaza-edit-session.response.dto'
import { StrategyPlazaTemplateResponseDto } from '../dto/strategy-plaza-template.response.dto'
import { OfficialStrategyPlazaTemplateService } from '../services/official-strategy-plaza-template.service'
import { StrategyPlazaEditSessionService } from '../services/strategy-plaza-edit-session.service'
import { StrategyPlazaRunService } from '../services/strategy-plaza-run.service'

@ApiTags('strategy-plaza')
@ApiExtraModels(
  BaseResponseDto,
  StrategyPlazaTemplateResponseDto,
  AccountStrategyDetailResponseDto,
  StrategyPlazaEditSessionResponseDto,
)
@Controller('strategy-plaza/templates')
export class StrategyPlazaController {
  constructor(
    private readonly templates: OfficialStrategyPlazaTemplateService,
    private readonly runService: StrategyPlazaRunService,
    private readonly editSessionService: StrategyPlazaEditSessionService,
    private readonly callerIdentityService: CallerIdentityService,
  ) {}

  @Get()
  @ApiOperation({ summary: '公开获取策略广场官方模板列表' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['data'],
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(StrategyPlazaTemplateResponseDto) },
        },
        message: {
          type: 'string',
          example: 'Success',
        },
      },
    },
  })
  async list(): Promise<StrategyPlazaTemplateResponseDto[]> {
    return this.templates.list().map(template => new StrategyPlazaTemplateResponseDto(template))
  }

  @Get(':id')
  @ApiOperation({ summary: '公开获取策略广场官方模板详情' })
  @ApiOkResponse({ schema: buildBaseResponseSchema(StrategyPlazaTemplateResponseDto) })
  async detail(@Param('id') id: string): Promise<StrategyPlazaTemplateResponseDto> {
    return new StrategyPlazaTemplateResponseDto(this.templates.getRequired(id))
  }

  @Post(':id/run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '运行策略广场官方模板' })
  @ApiHeader({ name: 'authorization', required: true, description: 'Bearer JWT，用于解析当前用户身份' })
  @ApiHeader({
    name: 'x-user-id',
    required: false,
    description: '仅用于服务间转发校验；如提供，必须与 JWT 用户一致',
  })
  @ApiOkResponse({ schema: buildBaseResponseSchema(AccountStrategyDetailResponseDto) })
  async run(
    @Param('id') id: string,
    @Body() dto: RunStrategyPlazaTemplateDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ): Promise<AccountStrategyDetailResponseDto> {
    const userId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.runService.runTemplate({
      userId,
      templateId: id,
      runRequestId: dto.runRequestId,
    })
  }

  @Post(':id/edit-session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '基于策略广场官方模板创建 AI Quant 编辑会话' })
  @ApiHeader({ name: 'authorization', required: true, description: 'Bearer JWT，用于解析当前用户身份' })
  @ApiHeader({
    name: 'x-user-id',
    required: false,
    description: '仅用于服务间转发校验；如提供，必须与 JWT 用户一致',
  })
  @ApiOkResponse({ schema: buildBaseResponseSchema(StrategyPlazaEditSessionResponseDto) })
  async editSession(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ): Promise<StrategyPlazaEditSessionResponseDto> {
    const userId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.editSessionService.startEditSession({
      userId,
      templateId: id,
    })
  }
}
