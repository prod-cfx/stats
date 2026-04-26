import { Module } from '@nestjs/common'
import { AccountStrategyViewModule } from '@/modules/account-strategy-view/account-strategy-view.module'
import { ExchangeAccountsModule } from '@/modules/exchange-accounts/exchange-accounts.module'
import { LlmStrategyCodegenModule } from '@/modules/llm-strategy-codegen/llm-strategy-codegen.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { StrategyPlazaController } from './controllers/strategy-plaza.controller'
import { StrategyPlazaOfficialSnapshotRepository } from './repositories/strategy-plaza-official-snapshot.repository'
import { OfficialStrategyPlazaTemplateService } from './services/official-strategy-plaza-template.service'
import { StrategyPlazaEditSessionService } from './services/strategy-plaza-edit-session.service'
import { StrategyPlazaRunService } from './services/strategy-plaza-run.service'

@Module({
  imports: [PrismaModule, AccountStrategyViewModule, ExchangeAccountsModule, LlmStrategyCodegenModule],
  controllers: [StrategyPlazaController],
  providers: [
    OfficialStrategyPlazaTemplateService,
    StrategyPlazaRunService,
    StrategyPlazaEditSessionService,
    StrategyPlazaOfficialSnapshotRepository,
  ],
})
export class StrategyPlazaModule {}
