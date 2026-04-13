import { Transactional } from '@nestjs-cls/transactional'
import {
  ApiExtraModels,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common'
import { AccountStrategyActionDto } from '../dto/account-strategy-action.dto'
import { AccountStrategyDetailResponseDto } from '../dto/account-strategy-detail.response.dto'
import { AccountStrategyDeployDto } from '../dto/account-strategy-deploy.dto'
import { AccountStrategyListItemDto } from '../dto/account-strategy-list-item.dto'
import { AccountStrategyListQueryDto } from '../dto/account-strategy-list-query.dto'
import { AccountStrategyUpdateExecutionLeverageDto } from '../dto/account-strategy-update-execution-leverage.dto'
import { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { AccountStrategyCallerIdentityService } from '../services/account-strategy-caller-identity.service'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { AccountStrategyViewService } from '../services/account-strategy-view.service'

@ApiTags('account-ai-quant-strategies')
@ApiExtraModels(BasePaginationResponseDto, AccountStrategyListItemDto, AccountStrategyDetailResponseDto)
@Controller('account/ai-quant/strategies')
export class AccountStrategyViewController {
  // Keep DTOs as runtime values so Nest can emit decorator metadata for body/query binding.
  private static readonly dtoRefs = [
    AccountStrategyActionDto,
    AccountStrategyDeployDto,
    AccountStrategyListQueryDto,
    AccountStrategyUpdateExecutionLeverageDto,
  ]

  constructor(
    private readonly service: AccountStrategyViewService,
    private readonly callerIdentityService: AccountStrategyCallerIdentityService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取当前用户的 AI Quant 策略列表' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(AccountStrategyListItemDto) },
            },
          },
        },
      ],
    },
  })
  async list(
    @Query() query: AccountStrategyListQueryDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ): Promise<BasePaginationResponseDto<AccountStrategyListItemDto>> {
    const userId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.service.listStrategies({
      ...query,
      userId,
    })
  }

  @Get(':id')
  @ApiOperation({ summary: '获取当前用户的 AI Quant 策略详情' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiOkResponse({ type: AccountStrategyDetailResponseDto })
  async detail(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ): Promise<AccountStrategyDetailResponseDto> {
    const userId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.service.getStrategyDetail(userId, id)
  }

  @Transactional()
  @Post(':id/actions')
  @ApiOperation({ summary: '对当前用户的 AI Quant 策略执行操作' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiOkResponse({ type: AccountStrategyDetailResponseDto })
  async action(
    @Param('id') id: string,
    @Body() dto: AccountStrategyActionDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ): Promise<AccountStrategyDetailResponseDto> {
    const userId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.service.performAction(id, {
      ...dto,
      userId,
    })
  }

  @Transactional()
  @Post('deploy')
  @ApiOperation({ summary: '部署当前用户的 AI Quant 策略' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiOkResponse({ type: AccountStrategyDetailResponseDto })
  async deploy(
    @Body() dto: AccountStrategyDeployDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ): Promise<AccountStrategyDetailResponseDto> {
    const userId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.service.deployStrategy({
      ...dto,
      userId,
    })
  }

  @Transactional()
  @Post(':id/execution/leverage')
  @ApiOperation({ summary: '更新当前用户 AI Quant 策略的部署杠杆' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiOkResponse({ type: AccountStrategyDetailResponseDto })
  async updateDeploymentLeverage(
    @Param('id') id: string,
    @Body() dto: AccountStrategyUpdateExecutionLeverageDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ): Promise<AccountStrategyDetailResponseDto> {
    const userId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.service.updateDeploymentLeverage(id, {
      ...dto,
      userId,
    })
  }

  @Transactional()
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '删除当前用户的 AI Quant 策略' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiNoContentResponse({ description: '删除成功' })
  async remove(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ): Promise<void> {
    const userId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.service.deleteStrategy(userId, id)
  }
}
