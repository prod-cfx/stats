import type { AiQuantProxyService } from './ai-quant-proxy.service'
import { Body, Controller, Delete, Get, Headers, Inject, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiHeader, ApiOkResponse, ApiOperation, ApiQuery, ApiTags, getSchemaPath } from '@nestjs/swagger'
import { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
import { buildBaseResponseSchema } from '@/common/swagger/base-response-schema.helper'
import { parseBooleanQuery } from '@/common/utils/parse-boolean-query'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { AiQuantProxyService as AiQuantProxyServiceToken } from './ai-quant-proxy.service'
import { AccountAiQuantActionRequestDto } from './dto/account-ai-quant-action.request.dto'
import { AccountAiQuantDeployRequestDto } from './dto/account-ai-quant-deploy.request.dto'
import { AccountAiQuantListQueryDto } from './dto/account-ai-quant-list-query.dto'
import {
  AccountAiQuantStrategyDetailResponseDto,
  AccountAiQuantStrategyListItemResponseDto,
} from './dto/account-ai-quant-strategy.response.dto'
import { AccountAiQuantUpdateExecutionLeverageRequestDto } from './dto/account-ai-quant-update-execution-leverage.request.dto'

@ApiTags('account-ai-quant')
@ApiBearerAuth('bearer')
@ApiExtraModels(
  BasePaginationResponseDto,
  AccountAiQuantStrategyListItemResponseDto,
  AccountAiQuantStrategyDetailResponseDto,
)
@Auth()
@Controller('account/ai-quant/strategies')
export class AccountAiQuantStrategiesController {
  // Keep DTOs as runtime values so Nest can emit metadata for validation/binding.
  private static readonly dtoRefs = [
    AccountAiQuantActionRequestDto,
    AccountAiQuantDeployRequestDto,
    AccountAiQuantListQueryDto,
    AccountAiQuantUpdateExecutionLeverageRequestDto,
  ]

  constructor(
    @Inject(AiQuantProxyServiceToken)
    private readonly service: AiQuantProxyService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List the authenticated user AI Quant strategies through the backend proxy.' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(AccountAiQuantStrategyListItemResponseDto) },
            },
          },
        },
      ],
    },
  })
  async list(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Query() query: AccountAiQuantListQueryDto,
  ): Promise<unknown> {
    return this.service.listAccountStrategies(userId, authorization, {
      page: query.page,
      limit: query.limit,
      status: query.status,
      subscribedOnly: query.subscribedOnly,
      excludeDraft: query.excludeDraft,
    })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get AI Quant strategy detail through the backend proxy.' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiOkResponse({ schema: buildBaseResponseSchema(AccountAiQuantStrategyDetailResponseDto) })
  async detail(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.getAccountStrategyDetail(userId, authorization, id)
  }

  @Post(':id/actions')
  @ApiOperation({ summary: 'Perform AI Quant strategy actions through the backend proxy.' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiOkResponse({ schema: buildBaseResponseSchema(AccountAiQuantStrategyDetailResponseDto) })
  async action(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() dto: AccountAiQuantActionRequestDto,
  ): Promise<unknown> {
    return this.service.performAccountStrategyAction(userId, authorization, id, {
      action: dto.action,
    })
  }

  @Post('deploy')
  @ApiOperation({ summary: 'Deploy an AI Quant strategy through the backend proxy.' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiOkResponse({ schema: buildBaseResponseSchema(AccountAiQuantStrategyDetailResponseDto) })
  async deploy(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: AccountAiQuantDeployRequestDto,
  ): Promise<unknown> {
    return this.service.deployAccountStrategy(userId, authorization, {
      name: dto.name,
      deployRequestId: dto.deployRequestId,
      publishedSnapshotId: dto.publishedSnapshotId,
      exchangeAccountId: dto.exchangeAccountId,
      exchangeAccountName: dto.exchangeAccountName,
      deploymentExecutionConfig: dto.deploymentExecutionConfig,
    })
  }

  @Get('deploy-requests/:deployRequestId/result')
  @ApiOperation({ summary: 'Get AI Quant deploy result through the backend proxy.' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['data'],
      properties: {
        data: {
          oneOf: [
            { $ref: getSchemaPath(AccountAiQuantStrategyDetailResponseDto) },
            { type: 'null' },
          ],
        },
        message: {
          type: 'string',
        },
      },
    },
  })
  async deployResult(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Param('deployRequestId') deployRequestId: string,
  ): Promise<unknown> {
    return this.service.getDeployResult(userId, authorization, deployRequestId)
  }

  @Post(':id/execution/leverage')
  @ApiOperation({ summary: 'Update deployed AI Quant leverage through the backend proxy.' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiOkResponse({ schema: buildBaseResponseSchema(AccountAiQuantStrategyDetailResponseDto) })
  async updateExecutionLeverage(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() dto: AccountAiQuantUpdateExecutionLeverageRequestDto,
  ): Promise<unknown> {
    return this.service.updateAccountStrategyExecutionLeverage(userId, authorization, id, {
      leverage: dto.leverage,
    })
  }

  @Delete(':id')
  @ApiQuery({
    name: 'deleteStoppedStrategy',
    required: false,
    type: 'boolean',
    description: '为 true 时同时归档策略记录；缺省/false 仅归档关联会话并把策略转为只读',
  })
  async remove(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Query('deleteStoppedStrategy') deleteStoppedStrategyRaw?: string,
  ): Promise<void> {
    const deleteStoppedStrategy = parseBooleanQuery(deleteStoppedStrategyRaw)
    return this.service.deleteAccountStrategy(userId, authorization, id, { deleteStoppedStrategy })
  }
}
