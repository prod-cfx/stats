import { WhaleTrackingService } from './whale-tracking.service'

describe('WhaleTrackingService', () => {
  it('uses live Hyperliquid-backed addresses in non-e2e discover fallback data', async () => {
    type WhaleTrackingServiceDependencies = ConstructorParameters<typeof WhaleTrackingService>

    const repository = {
      groupWhaleAlertsByAddress: jest.fn().mockResolvedValue([]),
    } as unknown as WhaleTrackingServiceDependencies[0]
    const hyperliquidApi = {} as WhaleTrackingServiceDependencies[1]
    const envService = {
      getString: jest.fn().mockReturnValue('staging'),
    } as unknown as WhaleTrackingServiceDependencies[2]

    const service = new WhaleTrackingService(
      repository,
      hyperliquidApi,
      envService,
    )

    const result = await service.getDiscoverWhales()
    const addresses = result.details.map(item => item.address.toLowerCase())
    const recommendedAddresses = result.recommended.map(item => item.address.toLowerCase())

    expect(recommendedAddresses).toContain('0x020ca66c30bec2c4fe3861a94e4db4a498a35872')
    expect(addresses).toContain('0x020ca66c30bec2c4fe3861a94e4db4a498a35872')
    expect(addresses).not.toContain('0x8ba1f109551bd432803012645ac136ddd64dba72')
  })
})
