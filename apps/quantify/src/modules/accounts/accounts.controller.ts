import type { AccountDetailQueryDto } from './dto/account-detail.query.dto'
import type { CreateStrategyAccountDto } from './dto/create-strategy-account.dto'
import type { GenerateDailyReportDto } from './dto/generate-daily-report.dto'
import type { LedgerQueryDto } from './dto/ledger-query.dto'
import type { MutateBalanceDto } from './dto/mutate-balance.dto'
import type { StrategyAccountListQueryDto } from './dto/strategy-account-list.query.dto'
import type { StrategyPnlDailyQueryDto } from './dto/strategy-pnl-daily.query.dto'
import { ErrorCode } from '@ai/shared'
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { AccountsService } from './accounts.service'
import { LedgerEntryResponseDto } from './dto/ledger-entry.response.dto'
import { StrategyAccountResponseDto } from './dto/strategy-account.response.dto'
import { StrategyPnlDailyResponseDto } from './dto/strategy-pnl-daily.response.dto'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
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

  @Post()
  @ApiOperation({ summary: '鍒涘缓绛栫暐璐︽埛' })
  @ApiOkResponse({ type: StrategyAccountResponseDto })
  async createAccount(@Body() dto: CreateStrategyAccountDto) {
    return this.accountsService.createUserStrategyAccount(dto.userId, dto)
  }

  @Get()
  @ApiOperation({ summary: '鏌ヨ绛栫暐璐︽埛鍒楄〃' })
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
  @ApiOperation({ summary: '鑾峰彇绛栫暐璐︽埛璇︽儏' })
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

  @Post(':accountId/deposit')
  @ApiOperation({ summary: '璐︽埛鍏ラ噾' })
  @ApiOkResponse({ type: StrategyAccountResponseDto })
  async deposit(
    @Param('accountId') accountId: string,
    @Body() dto: MutateBalanceDto,
  ) {
    await this.assertOwnershipById(accountId, dto.userId)
    return this.accountsService.deposit(accountId, dto)
  }

  @Post(':accountId/withdraw')
  @ApiOperation({ summary: '璐︽埛鍑洪噾' })
  @ApiOkResponse({ type: StrategyAccountResponseDto })
  async withdraw(
    @Param('accountId') accountId: string,
    @Body() dto: MutateBalanceDto,
  ) {
    await this.assertOwnershipById(accountId, dto.userId)
    return this.accountsService.withdraw(accountId, dto)
  }

  @Get(':accountId/ledger')
  @ApiOperation({ summary: '鏌ヨ璐︽埛璧勯噾娴佹按' })
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
  @ApiOperation({ summary: '鏌ヨ璐︽埛鏃ュ害鏀剁泭' })
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

  @Post('reports/daily')
  @ApiOperation({ summary: '鐢熸垚鎸囧畾鏃ユ湡鐨勬棩搴︽敹鐩? })
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
