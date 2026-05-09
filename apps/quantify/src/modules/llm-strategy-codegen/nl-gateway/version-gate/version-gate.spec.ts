import { AtomVersionGateValidationFailedException } from '../../exceptions/atom-version-gate-validation-failed.exception'
import { compareSemanticVersion, isAtomExecutableForStrategy } from './version-gate'

describe('compareSemanticVersion', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemanticVersion('2026.05.W02', '2026.05.W02')).toBe(0)
  })

  it('returns negative when a < b (same year, same month, earlier week)', () => {
    expect(compareSemanticVersion('2026.05.W02', '2026.05.W10')).toBeLessThan(0)
  })

  it('returns positive when a > b (same year, same month, later week)', () => {
    expect(compareSemanticVersion('2026.05.W10', '2026.05.W02')).toBeGreaterThan(0)
  })

  it('handles cross-year comparison: 2025.12.W04 < 2026.01.W01', () => {
    expect(compareSemanticVersion('2025.12.W04', '2026.01.W01')).toBeLessThan(0)
  })

  it('handles zero-pad boundary: W02 < W10 (not lexicographic ambiguity)', () => {
    // W02 vs W10: with zero-padding "W02" < "W10" lexicographically => correct
    expect(compareSemanticVersion('2026.01.W02', '2026.01.W10')).toBeLessThan(0)
  })

  it('throws AtomVersionGateValidationFailedException for invalid format (missing W prefix)', () => {
    expect(() => compareSemanticVersion('2026.05.02', '2026.05.W02')).toThrow(
      AtomVersionGateValidationFailedException,
    )
  })

  it('throws AtomVersionGateValidationFailedException for free-form string', () => {
    expect(() => compareSemanticVersion('bad-version', '2026.05.W02')).toThrow(
      AtomVersionGateValidationFailedException,
    )
  })

  it('throws when second arg is invalid', () => {
    expect(() => compareSemanticVersion('2026.05.W02', 'invalid')).toThrow(
      AtomVersionGateValidationFailedException,
    )
  })

  it('handles same month different weeks across years correctly', () => {
    expect(compareSemanticVersion('2026.05.W01', '2025.05.W01')).toBeGreaterThan(0)
  })
})

describe('isAtomExecutableForStrategy', () => {
  it('returns false when executableSinceVersion is undefined (atom not declared)', () => {
    expect(
      isAtomExecutableForStrategy(
        {},
        { deployedAtSemanticVersion: '2026.05.W02' },
      ),
    ).toBe(false)
  })

  it('returns false when strategy.deployedAtSemanticVersion is null (legacy strategy)', () => {
    expect(
      isAtomExecutableForStrategy(
        { executableSinceVersion: '2026.05.W02' },
        { deployedAtSemanticVersion: null },
      ),
    ).toBe(false)
  })

  it('returns true when deployed version equals executableSinceVersion', () => {
    expect(
      isAtomExecutableForStrategy(
        { executableSinceVersion: '2026.05.W02' },
        { deployedAtSemanticVersion: '2026.05.W02' },
      ),
    ).toBe(true)
  })

  it('returns true when deployed version is newer than executableSinceVersion', () => {
    expect(
      isAtomExecutableForStrategy(
        { executableSinceVersion: '2026.05.W02' },
        { deployedAtSemanticVersion: '2026.05.W10' },
      ),
    ).toBe(true)
  })

  it('returns false when deployed version is older than executableSinceVersion', () => {
    expect(
      isAtomExecutableForStrategy(
        { executableSinceVersion: '2026.05.W02' },
        { deployedAtSemanticVersion: '2026.01.W01' },
      ),
    ).toBe(false)
  })

  it('handles cross-year: strategy deployed in 2025 < atom since 2026', () => {
    expect(
      isAtomExecutableForStrategy(
        { executableSinceVersion: '2026.01.W01' },
        { deployedAtSemanticVersion: '2025.12.W04' },
      ),
    ).toBe(false)
  })

  it('handles cross-year: strategy deployed in 2026 >= atom since 2025.12.W04', () => {
    expect(
      isAtomExecutableForStrategy(
        { executableSinceVersion: '2025.12.W04' },
        { deployedAtSemanticVersion: '2026.01.W01' },
      ),
    ).toBe(true)
  })
})
