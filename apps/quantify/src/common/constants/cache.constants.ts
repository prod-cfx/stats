import { CacheKeyPrefix, CacheTTL } from '@ai/shared'

export { CacheKeyPrefix, CacheTTL }

export type TTLInSeconds = number

export const buildCacheKey = (prefix: CacheKeyPrefix, ...segments: (string | number)[]): string => {
  const suffix = segments.map(segment => String(segment)).join(':')
  return `${prefix}${suffix}`
}
