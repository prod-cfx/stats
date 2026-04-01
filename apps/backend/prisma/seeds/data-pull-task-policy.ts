const PUBLIC_DATA_TASK_KEYS = new Set([
  'coinglass-hyperliquid-whale-alert',
  'coinglass-hyperliquid-whale-position',
  'bbx-crypto-stock-quotes',
  'bbx-crypto-stock-scraper',
])

export function isPublicDataTaskKey(taskKey: string): boolean {
  return PUBLIC_DATA_TASK_KEYS.has(taskKey)
}

export function shouldEnablePublicDataTaskByDefault(
  appEnv: string | undefined,
  taskKey: string,
): boolean {
  if (!isPublicDataTaskKey(taskKey)) {
    return false
  }

  return appEnv === 'staging' || appEnv === 'production'
}
