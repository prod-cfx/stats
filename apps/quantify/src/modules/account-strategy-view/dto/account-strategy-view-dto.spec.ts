import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { AccountStrategyActionDto } from './account-strategy-action.dto'
import { AccountStrategySnapshotDto } from './account-strategy-detail.response.dto'
import { AccountStrategyListItemDto } from './account-strategy-list-item.dto'
import { AccountStrategyListQueryDto } from './account-strategy-list-query.dto'

type DynamicParamRecord = Record<string, unknown> | null
type SchemaVersion = string | null
type AssertTrue<T extends true> = T
type IsExact<T, U> = (<G>() => G extends T ? 1 : 2) extends
  (<G>() => G extends U ? 1 : 2) ? true : false

type _ListItemParamSchemaType = AssertTrue<IsExact<AccountStrategyListItemDto['paramSchema'], DynamicParamRecord>>
type _ListItemParamValuesType = AssertTrue<IsExact<AccountStrategyListItemDto['paramValues'], DynamicParamRecord>>
type _ListItemSchemaVersionType = AssertTrue<IsExact<AccountStrategyListItemDto['schemaVersion'], SchemaVersion>>
type _SnapshotParamSchemaType = AssertTrue<IsExact<AccountStrategySnapshotDto['paramSchema'], DynamicParamRecord>>
type _SnapshotParamValuesType = AssertTrue<IsExact<AccountStrategySnapshotDto['paramValues'], DynamicParamRecord>>
type _SnapshotSchemaVersionType = AssertTrue<IsExact<AccountStrategySnapshotDto['schemaVersion'], SchemaVersion>>

describe('accountStrategyViewDtos', () => {
  it('uses pagination defaults for list query dto', () => {
    const dto = plainToInstance(AccountStrategyListQueryDto, {})
    expect(dto.page).toBe(1)
    expect(dto.limit).toBeGreaterThan(0)
  })

  it('parses strict boolean query values for list query dto', () => {
    const dto = plainToInstance(AccountStrategyListQueryDto, {
      subscribedOnly: 'true',
      excludeDraft: 'false',
    })
    const errors = validateSync(dto)
    expect(errors).toHaveLength(0)
    expect(dto.subscribedOnly).toBe(true)
    expect(dto.excludeDraft).toBe(false)
  })

  it('rejects invalid boolean query values for list query dto', () => {
    const dto = plainToInstance(AccountStrategyListQueryDto, {
      subscribedOnly: 'abc',
    })
    const errors = validateSync(dto)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some(error => error.property === 'subscribedOnly')).toBe(true)
  })

  it('rejects invalid action', () => {
    const dto = plainToInstance(AccountStrategyActionDto, {
      userId: 'user-1',
      action: 'pause',
    })
    const errors = validateSync(dto)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('allows action dto without userId for header-based identity', () => {
    const dto = plainToInstance(AccountStrategyActionDto, {
      action: 'run',
    })
    const errors = validateSync(dto)
    expect(errors.length).toBe(0)
  })

  it('defines dynamic param contract fields on list item and snapshot dto', () => {
    const listItemMetadataKeys = Reflect.getMetadataKeys(AccountStrategyListItemDto.prototype, 'paramSchema')
    const listItemValuesMetadataKeys = Reflect.getMetadataKeys(AccountStrategyListItemDto.prototype, 'paramValues')
    const listItemVersionMetadataKeys = Reflect.getMetadataKeys(AccountStrategyListItemDto.prototype, 'schemaVersion')
    const snapshotSchemaMetadataKeys = Reflect.getMetadataKeys(AccountStrategySnapshotDto.prototype, 'paramSchema')
    const snapshotValuesMetadataKeys = Reflect.getMetadataKeys(AccountStrategySnapshotDto.prototype, 'paramValues')
    const snapshotVersionMetadataKeys = Reflect.getMetadataKeys(AccountStrategySnapshotDto.prototype, 'schemaVersion')

    const snapshotIdMetadataKeys = Reflect.getMetadataKeys(AccountStrategySnapshotDto.prototype, 'publishedSnapshotId')
    const snapshotHashMetadataKeys = Reflect.getMetadataKeys(AccountStrategySnapshotDto.prototype, 'snapshotHash')

    expect(listItemMetadataKeys.length).toBeGreaterThan(0)
    expect(listItemValuesMetadataKeys.length).toBeGreaterThan(0)
    expect(listItemVersionMetadataKeys.length).toBeGreaterThan(0)
    expect(snapshotSchemaMetadataKeys.length).toBeGreaterThan(0)
    expect(snapshotValuesMetadataKeys.length).toBeGreaterThan(0)
    expect(snapshotVersionMetadataKeys.length).toBeGreaterThan(0)
    expect(snapshotIdMetadataKeys.length).toBeGreaterThan(0)
    expect(snapshotHashMetadataKeys.length).toBeGreaterThan(0)
  })
})
