import { WhaleNotificationOrchestratorService } from '../src/modules/whale-notification/services/whale-notification-orchestrator.service'

describe('WhaleNotificationOrchestratorService allowlist disabled', () => {
  function createService(allowlist: string) {
    const configService = {
      get: (key: string) => {
        if (key === 'WHALE_NOTIFICATION_ALLOWED_USER_IDS')
          return allowlist
        return undefined
      },
    }

    const metricsService = {
      incrementEventsReceived: () => {},
      incrementFeatureFlagSkippedEvents: () => {},
      addGrayReleaseSkippedMatches: () => {},
      addMatchedRules: () => {},
      addDeliveryCandidates: () => {},
      addSkippedCooldownDeliveries: () => {},
      incrementDeliveriesSent: () => {},
      incrementDeliveriesFailed: () => {},
    }

    return new WhaleNotificationOrchestratorService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      configService as never,
      metricsService as never,
    )
  }

  it('should not filter users even if allowlist is configured', () => {
    const service = createService('some-other-user')
    const matches = [{ userId: 'user-a' }, { userId: 'user-b' }]

    const result = (
      service as unknown as {
        applyGrayRelease: <T extends { userId: string }>(input: T[]) => T[]
      }
    ).applyGrayRelease(matches)

    expect(result).toEqual(matches)
  })
})
