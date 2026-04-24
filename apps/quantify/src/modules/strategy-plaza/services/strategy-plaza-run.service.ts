import { Injectable } from '@nestjs/common'
import { AccountStrategyViewService } from '@/modules/account-strategy-view/services/account-strategy-view.service'
import { ExchangeAccountRepository } from '@/modules/exchange-accounts/repositories/exchange-account.repository'
import { StrategyPlazaOkxDemoApiKeyRequiredException } from '../exceptions'
import { OfficialStrategyPlazaTemplateService } from './official-strategy-plaza-template.service'

@Injectable()
export class StrategyPlazaRunService {
  constructor(
    private readonly templates: OfficialStrategyPlazaTemplateService,
    private readonly exchangeAccounts: ExchangeAccountRepository,
    private readonly accountStrategyViewService: AccountStrategyViewService,
  ) {}

  async runTemplate(input: {
    userId: string
    templateId: string
    runRequestId: string
  }) {
    const template = this.templates.getRequired(input.templateId)
    const account = await this.exchangeAccounts.findLatestOkxDemoAccountForUser(input.userId)
    if (!account) {
      throw new StrategyPlazaOkxDemoApiKeyRequiredException({ userId: input.userId })
    }

    return this.accountStrategyViewService.deployStrategy({
      userId: input.userId,
      name: template.name,
      deployRequestId: `plaza:${template.id}:${input.runRequestId}`,
      publishedSnapshotId: template.runConfig.publishedSnapshotId,
      exchangeAccountId: account.id,
      exchangeAccountName: account.name,
      mode: 'TESTNET',
      deploymentExecutionConfig: template.runConfig.deploymentExecutionConfig,
    })
  }
}
