import { describe, expect, it } from '@jest/globals'

import { isPublicCompaniesColumnVisible } from './column-visibility'

describe('public companies column visibility', () => {
  it('should hide 1d and 7d change columns on public companies page', () => {
    expect(isPublicCompaniesColumnVisible('change1d')).toBe(false)
    expect(isPublicCompaniesColumnVisible('change7d')).toBe(false)
  })
})
