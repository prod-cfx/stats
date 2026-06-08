/**
 * 获取 WebSocket 基础 URL
 * 优先级：NEXT_PUBLIC_WS_URL > NEXT_PUBLIC_API_SERVER_URL
 * 自动移除尾部斜杠
 */
export function getWsBaseUrl(): string {
  const configured = (
    process.env.NEXT_PUBLIC_WS_URL ||
    process.env.NEXT_PUBLIC_API_SERVER_URL
  )?.trim()

  if (!configured || configured === '__SET_IN_env.local__') {
    throw new Error('NEXT_PUBLIC_WS_URL or NEXT_PUBLIC_API_SERVER_URL is required')
  }

  return configured.replace(/\/$/, '')
}
