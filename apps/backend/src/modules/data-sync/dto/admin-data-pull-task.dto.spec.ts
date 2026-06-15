import { validateSync } from 'class-validator'
import {
  CreateAdminDataPullTaskDto,
  UpdateAdminDataPullTaskDto,
} from './admin-data-pull-task.dto'

function createValidTaskDto(meta?: unknown): CreateAdminDataPullTaskDto {
  const dto = new CreateAdminDataPullTaskDto()
  dto.key = 'example.kline_1m'
  dto.name = 'Example Kline 1m'
  dto.meta = meta as CreateAdminDataPullTaskDto['meta']
  return dto
}

function createUpdateTaskDto(meta?: unknown): UpdateAdminDataPullTaskDto {
  const dto = new UpdateAdminDataPullTaskDto()
  dto.meta = meta as UpdateAdminDataPullTaskDto['meta']
  return dto
}

describe('AdminDataPullTaskDto meta validation', () => {
  it.each([
    ['create', createValidTaskDto],
    ['update', createUpdateTaskDto],
  ] as const)('accepts object, null, and omitted meta for %s dto', (_, createDto) => {
    expect(validateSync(createDto({ symbol: 'BTCUSDT', limit: 100 }))).toHaveLength(0)
    expect(validateSync(createDto(null))).toHaveLength(0)
    expect(validateSync(createDto())).toHaveLength(0)
  })

  it.each([
    ['create', createValidTaskDto],
    ['update', createUpdateTaskDto],
  ] as const)('rejects invalid meta boundaries for %s dto', (_, createDto) => {
    const tooDeep = { a: { b: { c: { d: { e: { f: 'too-deep' } } } } } }
    const tooLarge = { payload: 'x'.repeat(10241) }

    for (const meta of ['invalid', ['not-object'], tooDeep, tooLarge]) {
      const errors = validateSync(createDto(meta))

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: 'meta' }),
        ]),
      )
    }
  })
})
