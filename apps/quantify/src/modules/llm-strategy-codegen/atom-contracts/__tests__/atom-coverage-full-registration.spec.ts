import { ATOM_BUCKETS, ATOM_CONTRACT_REGISTRY } from '../atom-contract-registry'

describe('ATOM_CONTRACT_REGISTRY full PR1b registration', () => {
  it('registers all supported atoms with PR1b contract fields', () => {
    const entries = Object.entries(ATOM_CONTRACT_REGISTRY)

    expect(entries).toHaveLength(Object.keys(ATOM_BUCKETS).length)

    for (const [key, contract] of entries) {
      expect(contract.key).toBe(key)
      expect(contract.bucket).toMatch(/^(trigger|action|risk|positionConstraint|orchestration)$/u)
      expect(contract.surface.intent.keywords.length).toBeGreaterThan(0)
      expect(Object.keys(contract.surface.intent.verbs).length).toBeGreaterThan(0)
      expect(contract.readinessCheck).toBeDefined()
      expect(contract.clarificationQuestion).toBeDefined()
      expect(contract.summaryContribution).toBeDefined()
      expect(Array.isArray(contract.mutex)).toBe(true)
      expect(typeof contract.isActionable).toBe('boolean')
      expect(contract.display.publicName.zh.length).toBeGreaterThan(0)
      expect(contract.display.publicName.en.length).toBeGreaterThan(0)
      expect(typeof contract.display.summaryTemplate).toBe('function')
      expect(contract.emit.capability.domain.length).toBeGreaterThan(0)
      expect(contract.emit.capability.verb.length).toBeGreaterThan(0)
      expect(contract.emit.capability.object.length).toBeGreaterThan(0)
      // PR3a Phase 2：condition atom 已兑现真实 irShape（无 `__pr1bStub` 品牌），
      //   其它分类仍是 stub。两类共存，断言按 `capabilityStatus` 分流。
      const status = contract.emit.capabilityStatus ?? 'pr1b-stub'
      expect(['pr1b-stub', 'pr3a-condition', 'ready']).toContain(status)
      if (status === 'pr1b-stub') {
        expect((contract.emit.irShape as { __pr1bStub?: true }).__pr1bStub).toBe(true)
      }
      else {
        expect((contract.emit.irShape as { __pr1bStub?: true }).__pr1bStub).toBeUndefined()
      }
      expect(['clause', 'segment', 'param']).toContain(contract.emit.evidenceSource)
    }
  })
})
