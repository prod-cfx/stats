/**
 * URL 安全校验工具
 * 防止环境变量注入攻击和 SSRF 漏洞
 */

export interface UrlValidationOptions {
  allowedProtocols?: string[]
  allowedDomains?: string[]
  requireHttps?: boolean
  allowLocalhost?: boolean
}

export class UrlValidationError extends Error {
  constructor(
    message: string,
    public readonly reason: string,
  ) {
    super(message)
    this.name = 'UrlValidationError'
  }
}

/**
 * 校验 URL 是否在白名单内
 *
 * @param urlString - 待校验的 URL 字符串
 * @param options - 校验选项
 * @returns 校验后的安全 URL 对象
 * @throws UrlValidationError 当 URL 不符合安全规则时
 */
export function validateUrl(
  urlString: string | undefined,
  options: UrlValidationOptions = {},
): URL {
  const {
    allowedProtocols = ['https'],
    allowedDomains = [],
    requireHttps = process.env.NODE_ENV === 'production',
    allowLocalhost = process.env.NODE_ENV !== 'production',
  } = options

  if (!urlString) {
    throw new UrlValidationError('URL is required', 'EMPTY_URL')
  }

  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    throw new UrlValidationError(`Invalid URL format: ${urlString}`, 'INVALID_FORMAT')
  }

  // 协议检查
  if (!allowedProtocols.includes(url.protocol.replace(':', ''))) {
    throw new UrlValidationError(
      `Protocol "${url.protocol}" not allowed. Allowed: ${allowedProtocols.join(', ')}`,
      'INVALID_PROTOCOL',
    )
  }

  // HTTPS 强制检查（生产环境）
  if (requireHttps && url.protocol !== 'https:') {
    throw new UrlValidationError('HTTPS is required in production environment', 'HTTPS_REQUIRED')
  }

  // localhost 检查
  const isLocalhost = ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(url.hostname)
  if (isLocalhost && !allowLocalhost) {
    throw new UrlValidationError(
      'Localhost URLs are not allowed in production',
      'LOCALHOST_NOT_ALLOWED',
    )
  }

  // 域名白名单检查
  if (allowedDomains.length > 0 && !isLocalhost) {
    const isAllowed = allowedDomains.some(
      domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    )
    if (!isAllowed) {
      throw new UrlValidationError(
        `Domain "${url.hostname}" not in whitelist: ${allowedDomains.join(', ')}`,
        'DOMAIN_NOT_WHITELISTED',
      )
    }
  }

  return url
}

/**
 * Hyperliquid API URL 白名单
 */
export const HYPERLIQUID_ALLOWED_DOMAINS = ['api.hyperliquid.xyz', 'api.hyperliquid-testnet.xyz']

/**
 * 校验 Hyperliquid API URL
 *
 * @param urlString - 环境变量中的 URL
 * @param defaultUrl - 默认 URL（当 urlString 为空时使用）
 * @returns 校验后的安全 URL 字符串
 */
export function validateHyperliquidUrl(
  urlString: string | undefined,
  defaultUrl = 'https://api.hyperliquid.xyz',
): string {
  const url = urlString || defaultUrl

  try {
    const validated = validateUrl(url, {
      allowedProtocols: ['https'],
      allowedDomains: HYPERLIQUID_ALLOWED_DOMAINS,
      requireHttps: process.env.NODE_ENV === 'production',
      allowLocalhost: false,
    })
    return validated.origin
  } catch (error) {
    if (error instanceof UrlValidationError) {
      const isProd = process.env.NODE_ENV === 'production'
      if (isProd) {
        throw new Error(`Invalid Hyperliquid API URL configuration: ${error.reason}`)
      } else {
        console.warn(`[URL Validation] ${error.message}. Using default: ${defaultUrl}`)
        return defaultUrl
      }
    }
    throw error
  }
}
