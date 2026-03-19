export enum CacheKeyPrefix {
  SETTINGS = 'settings:',
  STREAM_SESSION = 'stream:',
  USER_ACTIVITY = 'user-activity:',
  LOCK = 'lock:',
}

export enum CacheTTL {
  ONE_MINUTE = 60,
  FIVE_MINUTES = 300,
  FIFTEEN_MINUTES = 900,
  ONE_HOUR = 3600,
  ONE_DAY = 86400,
}

export type TTLInSeconds = number

export const buildCacheKey = (prefix: CacheKeyPrefix, ...segments: (string | number)[]): string => {
  const suffix = segments.map(segment => String(segment)).join(':')
  return `${prefix}${suffix}`
}
