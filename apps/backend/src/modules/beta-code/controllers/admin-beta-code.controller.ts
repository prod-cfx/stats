import { Transactional } from '@nestjs-cls/transactional'
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
import { CreateAny, ReadAny, RequireAuth, UpdateAny } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
import { BetaCodeResponseDto } from '../dto/beta-code.response.dto'
import { CreateBetaCodeBatchDto } from '../dto/create-beta-code-batch.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { QueryBetaCodeDto } from '../dto/query-beta-code.dto'
import { UpdateBetaCodeStatusDto } from '../dto/update-beta-code-status.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { BetaCodeService } from '../services/beta-code.service'

@ApiTags('admin-beta-codes')
@Controller('admin/beta-codes')
@ApiBearerAuth('bearer')
@RequireAuth()
@ApiExtraModels(BasePaginationResponseDto, BetaCodeResponseDto)
export class AdminBetaCodeController {
  constructor(private readonly betaCodeService: BetaCodeService) {}

  @Get()
  @ReadAny(AppResource.BETA_CODE)
  @ApiOperation({ summary: '分页获取内测码列表' })
  @ApiOkResponse({
    description: '获取列表成功',
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(BetaCodeResponseDto) },
            },
          },
        },
      ],
    },
  })
  async list(@Query() query: QueryBetaCodeDto) {
    return this.betaCodeService.list({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    })
  }

  @Post('batch')
  @CreateAny(AppResource.BETA_CODE)
  @Transactional()
  @ApiOperation({ summary: '批量生成内测码' })
  @ApiBody({ type: CreateBetaCodeBatchDto })
  @ApiOkResponse({ description: '生成成功', type: BetaCodeResponseDto, isArray: true })
  async createBatch(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreateBetaCodeBatchDto,
  ) {
    return this.betaCodeService.createBatch({
      count: dto.count,
      maxUsesPerCode: dto.maxUsesPerCode,
      adminId,
    })
  }

  @Put(':id/status')
  @UpdateAny(AppResource.BETA_CODE)
  @Transactional()
  @ApiOperation({ summary: '更新内测码状态' })
  @ApiBody({ type: UpdateBetaCodeStatusDto })
  @ApiOkResponse({ description: '更新成功', type: BetaCodeResponseDto })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBetaCodeStatusDto,
  ) {
    return this.betaCodeService.updateStatus(id, dto.isActive)
  }
}
