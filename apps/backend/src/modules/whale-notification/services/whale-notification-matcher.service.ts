import type {
  WhaleNotificationRule,
  WhaleNotificationRuleAddress,
  WhaleNotificationRuleSymbolOverride,
} from '@prisma/client'
import type { WhaleNotificationRulesRepository } from '../repositories/whale-notification-rules.repository'
import { Inject, Injectable } from '@nestjs/common'
import { WhaleNotificationRulesRepository as WhaleNotificationRulesRepositoryToken } from '../repositories/whale-notification-rules.repository'

export interface WhaleTradeEventInput {
  whaleAddress: string
  symbol: string
  side: string
  tradeValueUsd: number
  tradeTime: Date
}

interface RuleWithRelations extends WhaleNotificationRule {
  addressTargets: WhaleNotificationRuleAddress[]
  symbolOverrides: WhaleNotificationRuleSymbolOverride[]
}

export interface WhaleNotificationMatch {
  userId: string
  ruleId: string
  whaleAddress: string
  symbol: string
  side: string
  tradeValueUsd: number
  tradeTime: Date
  effectiveThresholdUsd: number
  channels: {
    web: boolean
    email: boolean
    telegram: boolean
  }
}

@Injectable()
export class WhaleNotificationMatcherService {
  constructor(
    @Inject(WhaleNotificationRulesRepositoryToken)
    private readonly repository: WhaleNotificationRulesRepository,
  ) {}

  async matchTradeEvent(event: WhaleTradeEventInput): Promise<WhaleNotificationMatch[]> {
    const normalizedAddress = event.whaleAddress.trim().toLowerCase()
    const normalizedSymbol = event.symbol.trim().toUpperCase()

    const rules = await this.repository.listActiveRulesForMatching(normalizedAddress, normalizedSymbol)

    const matches: WhaleNotificationMatch[] = []
    for (const rule of rules) {
      if (!this.isRuleMatched(rule, normalizedAddress, normalizedSymbol)) {
        continue
      }

      const effectiveThresholdUsd = this.resolveEffectiveThreshold(rule, normalizedAddress, normalizedSymbol)
      if (event.tradeValueUsd < effectiveThresholdUsd) {
        continue
      }

      matches.push({
        userId: rule.userId,
        ruleId: rule.id,
        whaleAddress: normalizedAddress,
        symbol: normalizedSymbol,
        side: event.side,
        tradeValueUsd: event.tradeValueUsd,
        tradeTime: event.tradeTime,
        effectiveThresholdUsd,
        channels: {
          web: rule.channelWeb,
          email: rule.channelEmail,
          telegram: rule.channelTelegram,
        },
      })
    }

    return matches
  }

  private isRuleMatched(rule: RuleWithRelations, whaleAddress: string, symbol: string): boolean {
    if (!rule.isActive) return false

    // 兼容 Day 1 的单字段地址/币种规则
    if (rule.type === 'ADDRESS') {
      const ownAddress = rule.whaleAddress?.trim().toLowerCase()
      const inAddressTargets = rule.addressTargets.some(item => item.whaleAddress.trim().toLowerCase() === whaleAddress)
      if (ownAddress && ownAddress !== whaleAddress && !inAddressTargets) {
        return false
      }
    }

    if (rule.type === 'SYMBOL') {
      const ownSymbol = rule.symbol?.trim().toUpperCase()
      if (ownSymbol && ownSymbol !== symbol) {
        return false
      }
    }

    return true
  }

  private resolveEffectiveThreshold(rule: RuleWithRelations, whaleAddress: string, symbol: string): number {
    const exactOverride = rule.symbolOverrides.find(item => {
      const overrideAddress = item.whaleAddress?.trim().toLowerCase()
      return overrideAddress === whaleAddress && item.symbol.trim().toUpperCase() === symbol
    })
    if (exactOverride) {
      return Number(exactOverride.minTradeValueUsd)
    }

    const symbolOverride = rule.symbolOverrides.find(item => {
      const overrideAddress = item.whaleAddress?.trim()
      return !overrideAddress && item.symbol.trim().toUpperCase() === symbol
    })
    if (symbolOverride) {
      return Number(symbolOverride.minTradeValueUsd)
    }

    return Number(rule.thresholdUsd)
  }
}
