/**
 * 获取 WebSocket 基础 URL
 * 优先级：NEXT_PUBLIC_WS_URL > NEXT_PUBLIC_API_SERVER_URL > localhost:3000
 * 自动移除尾部斜杠
 */
export function getWsBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_WS_URL ||
    process.env.NEXT_PUBLIC_API_SERVER_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}
