import { ErrorCode } from '@ai/shared'
import { Transactional } from '@nestjs-cls/transactional'
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import {
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { AccountsService } from './accounts.service'
import { AccountDetailQueryDto } from './dto/account-detail-query.dto'
import { CreateStrategyAccountDto } from './dto/create-strategy-account.dto'
import { GenerateDailyReportDto } from './dto/generate-daily-report.dto'
import { LedgerEntryResponseDto } from './dto/ledger-entry.response.dto'
import { LedgerQueryDto } from './dto/ledger-query.dto'
import { MutateBalanceDto } from './dto/mutate-balance.dto'
import { StrategyAccountResponseDto } from './dto/strategy-account.response.dto'
import { StrategyAccountListQueryDto } from './dto/strategy-account-list-query.dto'
import { StrategyPnlDailyQueryDto } from './dto/strategy-pnl-daily-query.dto'
import { StrategyPnlDailyResponseDto } from './dto/strategy-pnl-daily.response.dto'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { StrategyPnlReportService } from './strategy-pnl-report.service'

@ApiTags('accounts')
@ApiExtraModels(
  BasePaginationResponseDto,
  StrategyAccountResponseDto,
  LedgerEntryResponseDto,
  StrategyPnlDailyResponseDto,
)
@Controller('accounts/strategy-accounts')
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly strategyPnlReportService: StrategyPnlReportService,
  ) {}

  @Transactional()
  @Post()
  @ApiOperation({ summary: '创建策略账户' })
  @ApiBody({ type: CreateStrategyAccountDto })
  @ApiOkResponse({ type: StrategyAccountResponseDto })
  async createAccount(@Body() dto: CreateStrategyAccountDto) {
    return this.accountsService.createUserStrategyAccount(dto.userId, dto)
  }

  @Get()
  @ApiOperation({ summary: '查询策略账户列表' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(StrategyAccountResponseDto) },
            },
          },
        },
      ],
    },
  })
  async listAccounts(@Query() query: StrategyAccountListQueryDto) {
    return this.accountsService.listAccounts({
      ...query,
      ownerUserId: query.userId,
    })
  }

  @Get(':accountId')
  @ApiOperation({ summary: '获取策略账户详情' })
  @ApiOkResponse({ type: StrategyAccountResponseDto })
  async getAccountDetail(
    @Param('accountId') accountId: string,
    @Query() query: AccountDetailQueryDto,
  ) {
    const detail = await this.accountsService.getAccountDetail(accountId, {
      includeLatestDaily: query.withDailyStats,
    })
    this.ensureOwnership(detail.userId, accountId, query.userId)
    return detail
  }

  @Transactional()
  @Post(':accountId/deposit')
  @ApiOperation({ summary: '账户入金' })
  @ApiBody({ type: MutateBalanceDto })
  @ApiOkResponse({ type: StrategyAccountResponseDto })
  async deposit(
    @Param('accountId') accountId: string,
    @Body() dto: MutateBalanceDto,
  ) {
    await this.assertOwnershipById(accountId, dto.userId)
    return this.accountsService.deposit(accountId, dto)
  }

  @Transactional()
  @Post(':accountId/withdraw')
  @ApiOperation({ summary: '账户出金' })
  @ApiBody({ type: MutateBalanceDto })
  @ApiOkResponse({ type: StrategyAccountResponseDto })
  async withdraw(
    @Param('accountId') accountId: string,
    @Body() dto: MutateBalanceDto,
  ) {
    await this.assertOwnershipById(accountId, dto.userId)
    return this.accountsService.withdraw(accountId, dto)
  }

  @Get(':accountId/ledger')
  @ApiOperation({ summary: '查询账户资金流水' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(LedgerEntryResponseDto) },
            },
          },
        },
      ],
    },
  })
  async listLedger(
    @Param('accountId') accountId: string,
    @Query() query: LedgerQueryDto,
  ) {
    await this.assertOwnershipById(accountId, query.userId)
    return this.accountsService.listLedger(accountId, query)
  }

  @Get(':accountId/daily-pnl')
  @ApiOperation({ summary: '查询账户日度收益' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(StrategyPnlDailyResponseDto) },
            },
          },
        },
      ],
    },
  })
  async listDailyPnl(
    @Param('accountId') accountId: string,
    @Query() query: StrategyPnlDailyQueryDto,
  ) {
    await this.assertOwnershipById(accountId, query.userId)
    return this.accountsService.listDailyStats(accountId, query)
  }

  @Transactional()
  @Post('reports/daily')
  @ApiOperation({ summary: '生成指定日期的日度收益' })
  @ApiBody({ type: GenerateDailyReportDto })
  async generateDailyReport(@Body() dto: GenerateDailyReportDto) {
    const date = dto.date ? new Date(dto.date) : undefined
    return this.strategyPnlReportService.generateDailyReport(date)
  }

  private async assertOwnershipById(accountId: string, userId: string) {
    const owner = await this.accountsService.getAccountOwner(accountId)
    this.ensureOwnership(owner.userId, accountId, userId)
  }

  private ensureOwnership(accountUserId: string, accountId: string, userId: string) {
    if (accountUserId === userId) return
    throw new DomainException('Access denied to strategy account', {
      code: ErrorCode.FORBIDDEN,
      args: { accountId },
    })
  }
}
