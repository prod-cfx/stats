/* eslint-disable ts/consistent-type-imports -- NestJS decorators require runtime imports for metadata */
import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiHeader, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger'
import { buildBaseResponseSchema } from '@/common/swagger/base-response-schema.helper'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { AiQuantProxyService } from './ai-quant-proxy.service'
import { AccountAiQuantStrategyDetailResponseDto } from './dto/account-ai-quant-strategy.response.dto'
import {
  StrategyPlazaDisplayMetricsResponseDto,
  StrategyPlazaEditSessionResponseDto,
  StrategyPlazaTemplateResponseDto,
} from './dto/strategy-plaza.response.dto'
import { StrategyPlazaRunRequestDto } from './dto/strategy-plaza-run.request.dto'

@ApiTags('strategy-plaza')
@ApiExtraModels(
  AccountAiQuantStrategyDetailResponseDto,
  StrategyPlazaDisplayMetricsResponseDto,
  StrategyPlazaTemplateResponseDto,
  StrategyPlazaEditSessionResponseDto,
)
@Controller('strategy-plaza/templates')
export class StrategyPlazaProxyController {
  constructor(
    private readonly service: AiQuantProxyService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Publicly list strategy plaza templates through the backend proxy.' })
  @ApiOkResponse({
    description: 'Strategy plaza template list proxied from quantify.',
    schema: {
      type: 'object',
      required: ['data'],
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(StrategyPlazaTemplateResponseDto) },
        },
        message: { type: 'string', example: 'Success' },
      },
    },
  })
  async list(): Promise<StrategyPlazaTemplateResponseDto[]> {
    return this.service.listStrategyPlazaTemplates()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Publicly get strategy plaza template detail through the backend proxy.' })
  @ApiOkResponse({
    description: 'Strategy plaza template detail proxied from quantify.',
    schema: buildBaseResponseSchema(StrategyPlazaTemplateResponseDto),
  })
  async detail(@Param('id') id: string): Promise<StrategyPlazaTemplateResponseDto> {
    return this.service.getStrategyPlazaTemplateDetail(id)
  }

  @Post(':id/run')
  @Auth()
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run a strategy plaza template through the backend proxy.' })
  @ApiHeader({ name: 'authorization', required: true })
  @ApiOkResponse({
    description: 'Created or resolved AI Quant strategy detail.',
    schema: buildBaseResponseSchema(AccountAiQuantStrategyDetailResponseDto),
  })
  async run(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() dto: StrategyPlazaRunRequestDto,
  ): Promise<AccountAiQuantStrategyDetailResponseDto> {
    return this.service.runStrategyPlazaTemplate(userId, authorization, id, {
      runRequestId: dto.runRequestId,
    })
  }

  @Post(':id/edit-session')
  @Auth()
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a strategy plaza edit session through the backend proxy.' })
  @ApiHeader({ name: 'authorization', required: true })
  @ApiOkResponse({
    description: 'Created AI Quant edit session.',
    schema: buildBaseResponseSchema(StrategyPlazaEditSessionResponseDto),
  })
  async editSession(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): Promise<StrategyPlazaEditSessionResponseDto> {
    return this.service.startStrategyPlazaEditSession(userId, authorization, id)
  }
}
