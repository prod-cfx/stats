import { describe, expect, it } from '@jest/globals'
import { toSortedCompat } from '@/lib/immutable-sort'

describe('toSortedCompat', () => {
  it('returns a sorted copy without mutating input', () => {
    const input = [3, 1, 2]

    expect(toSortedCompat(input, (a, b) => a - b)).toEqual([1, 2, 3])
    expect(input).toEqual([3, 1, 2])
  })
})
