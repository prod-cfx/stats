import { ATOM_CONTRACT_REGISTRY, getAllRegisteredAtomKeys } from '../atom-contract-registry'

describe('ATOM_CONTRACT_REGISTRY full PR1b registration', () => {
  it('registers all supported atoms with PR1b contract fields', () => {
    const entries = Object.entries(ATOM_CONTRACT_REGISTRY)

    // #1364 PR1：注册表自身长度即真相（ATOM_BUCKETS 已 private 化，由 contract.bucket 派生）
    expect(entries).toHaveLength(getAllRegisteredAtomKeys().length)

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
      // PR3a Phase 2 + PR3e + Issue #1313 PR1 + PR2 + PR5a：irShape capabilityStatus 多态共存，按字面量分流：
      //   - 'pr3a-condition'                 → condition atom 已兑现真实 irShape（无 stub/sentinel brand）
      //   - 'irshape-not-applicable'         → non-condition bucket atom，sentinel irShape 带 `__notApplicable: true`
      //   - 'pr1b-stub'                      → 历史占位，PR3e 后不再被默认构造；保留以兼容潜在新增 condition migration
      //   - 'pr3e-risk-guard' /
      //     'pr3e-rule-block' /
      //     'pr3e-orchestration-portfolio' /
      //     'pr3e-lifecycle' /
      //     'pr3e-action'                    → Issue #1313 接口骨架字面量；rule-level / spec-level
      //                                        emit 路径接管，**不**走 compileAtom 的 emit.irShape 调度。
      //                                        irShape 字段仍保留 NotApplicable sentinel（带
      //                                        `__notApplicable: true` brand），与 'irshape-not-applicable'
      //                                        共享 fail-loud 兜底；区分仅在 capabilityStatus 字面量上。
      // capabilityStatus 字面量联合在当前 PR 仅出现注册过的子集（如 'irshape-not-applicable'
      //   + 'pr3a-condition' + 'pr3e-risk-guard'）；以 string 拓宽避免 TS2367，等后续 PR
      //   兑现 'pr3e-rule-block' / 'pr3e-orchestration-portfolio' / 'pr3e-lifecycle' /
      //   'pr3e-action' atom 后字面量联合自然扩大，分流仍持续有效。
      const status: string = contract.emit.capabilityStatus ?? 'pr1b-stub'
      expect([
        'pr1b-stub',
        'pr3a-condition',
        'pr3e-risk-guard',
        'pr3e-rule-block',
        'pr3e-orchestration-portfolio',
        'pr3e-lifecycle',
        'pr3e-action',
        'pr3e-risk-predicate',
        'irshape-not-applicable',
        'ready',
      ]).toContain(status)
      const isNotApplicableShape = status === 'irshape-not-applicable'
        || status === 'pr3e-risk-guard'
        || status === 'pr3e-rule-block'
        || status === 'pr3e-orchestration-portfolio'
        || status === 'pr3e-lifecycle'
        || status === 'pr3e-action'
        || status === 'pr3e-risk-predicate'
      if (status === 'pr1b-stub') {
        expect((contract.emit.irShape as { __pr1bStub?: true }).__pr1bStub).toBe(true)
        expect((contract.emit.irShape as { __notApplicable?: true }).__notApplicable).toBeUndefined()
      }
      else if (isNotApplicableShape) {
        // Issue #1313 PR3：`pr3e-*` atom 走 rule-level / spec-level emit shape，
        //   irShape 仍是 sentinel（带 `__notApplicable: true` brand），与
        //   'irshape-not-applicable' 共用 sentinel 形态——capabilityStatus 字面量是
        //   "本 atom 通过哪个 emit shape 兑现"的唯一真相源，sentinel brand 仅锁
        //   compileAtom 路径不可调用 emit.irShape。
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
