import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { AccountStrategyActionDto } from './account-strategy-action.dto'
import { AccountStrategyListQueryDto } from './account-strategy-list.query.dto'

describe('accountStrategyViewDtos', () => {
  it('uses pagination defaults for list query dto', () => {
    const dto = plainToInstance(AccountStrategyListQueryDto, {})
    expect(dto.page).toBe(1)
    expect(dto.limit).toBeGreaterThan(0)
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
})
