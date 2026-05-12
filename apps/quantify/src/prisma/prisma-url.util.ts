export interface PrismaPoolParams {
  connectionLimit?: number
  poolTimeout?: number
}

export function withPrismaPoolParams<T extends string | null | undefined>(url: T, params: PrismaPoolParams): T {
  if (!url || url === '__SET_IN_env.local__') return url

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') return url

    if (params.connectionLimit !== undefined && !parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', String(params.connectionLimit))
    }

    if (params.poolTimeout !== undefined && !parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', String(params.poolTimeout))
    }

    return parsed.toString() as T
  } catch {
    return url
  }
}
