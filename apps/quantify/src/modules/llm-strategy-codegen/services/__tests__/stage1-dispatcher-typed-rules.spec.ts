import { STAGE1_TYPED_RULES_CORPUS } from './fixtures/stage1-typed-rules-corpus'

describe('stage1 typed rules corpus fixture', () => {
  it('contains exactly 31 required current-capability cases', () => {
    expect(STAGE1_TYPED_RULES_CORPUS).toHaveLength(31)
    expect(new Set(STAGE1_TYPED_RULES_CORPUS.map(item => item.id)).size).toBe(31)
    expect(STAGE1_TYPED_RULES_CORPUS.every(item => item.text.trim().length > 0)).toBe(true)
  })
})
