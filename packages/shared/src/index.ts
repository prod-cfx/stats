export type HealthStatus = 'ok' | 'degraded' | 'down'

export interface ApiHealth {
    service: string
    status: HealthStatus
    timestamp: string
}

export const buildHealthPayload = (service: string, status: HealthStatus = 'ok'): ApiHealth => ({
    service,
    status,
    timestamp: new Date().toISOString(),
})

export * from './constants/error-codes'
export * from './constants/trading-pairs'
// NOTE: script-engine is Node-only and should not be imported in browser environments
// Use direct import: import { createScriptEngine } from '@ai/shared/script-engine'
// export * from './script-engine'
export * from './signal-output'
export * from './types/indicator'
export * from './types/market-data'
export * from './types/orderbook'
export * from './types/setting-value'
export * from './types/trading-pair'

export interface Pagination {
    page: number
    pageSize: number
}

export const DEFAULT_PAGINATION: Pagination = {
    page: 1,
    pageSize: 20,
}

export const SHORT_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

const DEFAULT_ID_LENGTH = 6

export function generateShortId(
    length = DEFAULT_ID_LENGTH,
    random: () => number = Math.random,
): string {
    if (!Number.isFinite(length) || length <= 0) {
        throw new Error('length must be a positive integer')
    }

    let result = ''
    const charactersLength = SHORT_ID_ALPHABET.length
    for (let i = 0; i < length; i += 1) {
        const index = Math.floor(random() * charactersLength)
        result += SHORT_ID_ALPHABET.charAt(index)
    }
    return result
}

export function createShortIdRegex(length = DEFAULT_ID_LENGTH): RegExp {
    if (!Number.isFinite(length) || length <= 0) {
        throw new Error('length must be a positive integer')
    }
    return new RegExp(`^[A-HJ-NP-Za-km-z2-9]{${length}}$`)
}

export const SHORT_ID_REGEX = createShortIdRegex(DEFAULT_ID_LENGTH)

export function isShortId(value: unknown, length = DEFAULT_ID_LENGTH): value is string {
    if (typeof value !== 'string') return false
    return createShortIdRegex(length).test(value)
}

