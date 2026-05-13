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
      // PR3a Phase 2 + PR3e + Issue #1313 PR1：irShape capabilityStatus 多态共存，按字面量分流：
      //   - 'pr3a-condition'                 → condition atom 已兑现真实 irShape（无 stub/sentinel brand）
      //   - 'irshape-not-applicable'         → non-condition bucket atom，sentinel irShape 带 `__notApplicable: true`
      //   - 'pr1b-stub'                      → 历史占位，PR3e 后不再被默认构造；保留以兼容潜在新增 condition migration
      //   - 'pr3e-risk-guard' /
      //     'pr3e-rule-block' /
      //     'pr3e-orchestration-portfolio' /
      //     'pr3e-lifecycle'                 → Issue #1313 接口骨架字面量；本 PR 0 atom 实际进入此状态
      //                                        （后续 atom 迁移 PR 兑现并配合 `emit.*Shape` 字段）。
      const status = contract.emit.capabilityStatus ?? 'pr1b-stub'
      expect([
        'pr1b-stub',
        'pr3a-condition',
        'pr3e-risk-guard',
        'pr3e-rule-block',
        'pr3e-orchestration-portfolio',
        'pr3e-lifecycle',
        'irshape-not-applicable',
        'ready',
      ]).toContain(status)
      if (status === 'pr1b-stub') {
        expect((contract.emit.irShape as { __pr1bStub?: true }).__pr1bStub).toBe(true)
        expect((contract.emit.irShape as { __notApplicable?: true }).__notApplicable).toBeUndefined()
      }
      else if (status === 'irshape-not-applicable') {
        expect((contract.emit.irShape as { __notApplicable?: true }).__notApplicable).toBe(true)
        expect((contract.emit.irShape as { __pr1bStub?: true }).__pr1bStub).toBeUndefined()
      }
      else {
        expect((contract.emit.irShape as { __pr1bStub?: true }).__pr1bStub).toBeUndefined()
        expect((contract.emit.irShape as { __notApplicable?: true }).__notApplicable).toBeUndefined()
      }
      expect(['clause', 'segment', 'param']).toContain(contract.emit.evidenceSource)
    }
  })
})
