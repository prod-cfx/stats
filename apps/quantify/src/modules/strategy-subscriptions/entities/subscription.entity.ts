import type { SubscriptionStatus } from '@prisma/client'

export interface SubscriptionEntity {
  id: string
  userId: string
  strategyTemplateId: string
  status: SubscriptionStatus
  customParams: Record<string, unknown> | null
  exchangeAccountId: string | null
  subscribedAt: Date
  unsubscribedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
