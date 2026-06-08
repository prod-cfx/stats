/**
 * 获取 WebSocket 基础 URL
 * 优先级：NEXT_PUBLIC_WS_URL > NEXT_PUBLIC_BACKEND_API_BASE_URL
 * 自动移除尾部斜杠
 */
export function getWsBaseUrl(): string {
  const configured = (
    process.env.NEXT_PUBLIC_WS_URL ||
    resolveWsOriginFromBackendApiBaseUrl(process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL)
  )?.trim()

  if (!configured || configured === '__SET_IN_env.local__') {
    throw new Error('NEXT_PUBLIC_WS_URL or NEXT_PUBLIC_BACKEND_API_BASE_URL is required')
  }

  return configured.replace(/\/$/, '')
}

function resolveWsOriginFromBackendApiBaseUrl(value?: string): string | undefined {
  const normalized = value?.trim()
  if (!normalized || normalized === '__SET_IN_env.local__') {
    return undefined
  }

  const url = new URL(normalized)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = ''
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}
