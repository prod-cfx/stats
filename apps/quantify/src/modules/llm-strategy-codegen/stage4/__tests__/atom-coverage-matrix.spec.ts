import {
  STAGE4_ATOM_COVERAGE_MATRIX,
  STAGE4_ATOM_FAMILIES,
  STAGE4_DEPLOY_READY_STATUSES,
} from '../atom-coverage-matrix'

describe('Stage 4 atom coverage matrix', () => {
  it('covers all Stage 4 atom families', () => {
    const families = new Set(STAGE4_ATOM_COVERAGE_MATRIX.map(row => row.family))

    expect([...families].sort()).toEqual([...STAGE4_ATOM_FAMILIES].sort())
  })

  it('uses unique atom keys', () => {
    const keys = STAGE4_ATOM_COVERAGE_MATRIX.map(row => row.atomKey)

    expect(new Set(keys).size).toBe(keys.length)
  })

  it('requires acceptance fields on every row', () => {
    const invalidRows = STAGE4_ATOM_COVERAGE_MATRIX.filter(row =>
      !row.family
      || !row.rulePath
      || !row.status
      || row.requiredDataSources.length === 0
      || row.deployPayloadImpact.length === 0
      || !row.prBatch,
    )

    expect(invalidRows).toEqual([])
  })

  it('keeps deploy-ready numerator statuses explicit', () => {
    expect(STAGE4_DEPLOY_READY_STATUSES).toEqual(['deploy_ready', 'corpus_pass'])
  })
})
