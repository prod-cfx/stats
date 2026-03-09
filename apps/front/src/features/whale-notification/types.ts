export type WhaleNotificationRuleType = 'ADDRESS' | 'SYMBOL'

export interface WhaleNotificationChannels {
  web: boolean
  email: boolean
  telegram: boolean
}

export interface WhaleNotificationRule {
  id: string
  type: WhaleNotificationRuleType
  address?: string
  symbol?: string
  thresholdUsd: number
  note?: string
  channels: WhaleNotificationChannels
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type WhaleDeliveryStatus = 'SENT' | 'FAILED' | 'SKIPPED' | 'PENDING'

export interface WhaleNotificationDeliveryMap {
  web: WhaleDeliveryStatus
  email: WhaleDeliveryStatus
  telegram: WhaleDeliveryStatus
}

export interface WhaleNotificationInboxItem {
  id: string
  title: string
  content: string
  ruleId?: string
  channels: WhaleNotificationDeliveryMap
  read: boolean
  createdAt: string
}

export interface CreateWhaleNotificationRuleInput {
  type: WhaleNotificationRuleType
  address?: string
  symbol?: string
  thresholdUsd: number
  note?: string
  channels: WhaleNotificationChannels
}

export interface UpdateWhaleNotificationRuleInput {
  thresholdUsd?: number
  note?: string
  channels?: WhaleNotificationChannels
  isActive?: boolean
}
