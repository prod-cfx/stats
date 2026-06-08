import { Injectable } from '@nestjs/common'
import { AccountStrategyViewService } from '@/modules/account-strategy-view/services/account-strategy-view.service'
import { ExchangeAccountRepository } from '@/modules/exchange-accounts/repositories/exchange-account.repository'
import { StrategyPlazaOkxDemoApiKeyRequiredException, StrategyPlazaOkxLiveApiKeyRequiredException } from '../exceptions'
import { StrategyPlazaCompiledSnapshotService } from './strategy-plaza-compiled-snapshot.service'
import { OfficialStrategyPlazaTemplateService } from './official-strategy-plaza-template.service'

@Injectable()
export class StrategyPlazaRunService {
  constructor(
    private readonly templates: OfficialStrategyPlazaTemplateService,
    private readonly exchangeAccounts: ExchangeAccountRepository,
    private readonly compiledSnapshots: StrategyPlazaCompiledSnapshotService,
    private readonly accountStrategyViewService: AccountStrategyViewService,
  ) {}

  async runTemplate(input: {
    userId: string
    templateId: string
    runRequestId: string
    mode?: 'TESTNET' | 'LIVE'
    exchangeAccountId?: string
  }) {
    const template = this.templates.getRequired(input.templateId)
    const mode = input.mode ?? 'TESTNET'
    const existingSnapshot = mode === 'TESTNET'
      ? await this.compiledSnapshots.resolveExistingCompiledSnapshotForUser({
          userId: input.userId,
          template,
        })
      : null

    if (existingSnapshot?.existingStrategyInstanceId) {
      return {
        result: 'existing' as const,
        strategy: await this.accountStrategyViewService.getStrategyDetail(
          input.userId,
          existingSnapshot.existingStrategyInstanceId,
        ),
      }
    }

    const account = mode === 'LIVE'
      ? await this.exchangeAccounts.findExchangeAccountFirst({
          where: {
            ...(input.exchangeAccountId ? { id: input.exchangeAccountId } : {}),
            userId: input.userId,
            exchangeId: 'okx',
            isTestnet: false,
          },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          select: { id: true, name: true },
        })
      : await this.exchangeAccounts.findLatestOkxDemoAccountForUser(input.userId)
    if (!account) {
      throw mode === 'LIVE'
        ? new StrategyPlazaOkxLiveApiKeyRequiredException({ userId: input.userId })
        : new StrategyPlazaOkxDemoApiKeyRequiredException({ userId: input.userId })
    }
    const snapshot = await this.compiledSnapshots.resolveCompiledSnapshotForUser({
      userId: input.userId,
      template,
    })

    if (mode === 'TESTNET' && snapshot.existingStrategyInstanceId) {
      return {
        result: 'existing' as const,
        strategy: await this.accountStrategyViewService.getStrategyDetail(
          input.userId,
          snapshot.existingStrategyInstanceId,
        ),
      }
    }

    return this.accountStrategyViewService.deployStrategy({
      userId: input.userId,
      name: template.name,
      deployRequestId: `plaza:${template.id}:${input.runRequestId}`,
      publishedSnapshotId: snapshot.id,
      exchangeAccountId: account.id,
      exchangeAccountName: account.name,
      mode,
      deploymentExecutionConfig: template.runConfig.deploymentExecutionConfig,
    })
  }
}
