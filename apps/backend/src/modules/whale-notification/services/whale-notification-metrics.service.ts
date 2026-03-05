import { Injectable } from '@nestjs/common'

interface WhaleNotificationMetricsSnapshot {
  eventsReceived: number
  matchedRules: number
  deliveryCandidates: number
  deliveriesSent: number
  deliveriesFailed: number
  deliveriesSkippedCooldown: number
  featureFlagSkippedEvents: number
  dispatchRetryAttempts: number
}

@Injectable()
export class WhaleNotificationMetricsService {
  private metrics: WhaleNotificationMetricsSnapshot = {
    eventsReceived: 0,
    matchedRules: 0,
    deliveryCandidates: 0,
    deliveriesSent: 0,
    deliveriesFailed: 0,
    deliveriesSkippedCooldown: 0,
    featureFlagSkippedEvents: 0,
    dispatchRetryAttempts: 0,
  }

  incrementEventsReceived() {
    this.metrics.eventsReceived += 1
  }

  incrementFeatureFlagSkippedEvents() {
    this.metrics.featureFlagSkippedEvents += 1
  }

  addMatchedRules(count: number) {
    this.metrics.matchedRules += Math.max(0, count)
  }

  addDeliveryCandidates(count: number) {
    this.metrics.deliveryCandidates += Math.max(0, count)
  }

  addSkippedCooldownDeliveries(count: number) {
    this.metrics.deliveriesSkippedCooldown += Math.max(0, count)
  }

  incrementDeliveriesSent() {
    this.metrics.deliveriesSent += 1
  }

  incrementDeliveriesFailed() {
    this.metrics.deliveriesFailed += 1
  }

  incrementDispatchRetryAttempts() {
    this.metrics.dispatchRetryAttempts += 1
  }

  snapshot(): WhaleNotificationMetricsSnapshot {
    return { ...this.metrics }
  }
}
