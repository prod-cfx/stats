export const SCORE_PRICE_PATTERN = '(?:0|[1-9]\\d*)(?:\\.\\d{0,5}[1-9])?'

export const SCORE_PRICE_REGEX = new RegExp(`^${SCORE_PRICE_PATTERN}$`)

export const SCORE_PRICE_HELP_TEXT = '非负、最多6位小数；若含小数则末位不可为0（0例外）'

export function isValidScorePrice(value: string | number): boolean {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return false
    let normalized = value.toString()
    if (/e/i.test(normalized)) {
      normalized = value.toFixed(10)
    }
    normalized = normalized.replace(/(\.\d*?[1-9])0+$/, '$1')
    normalized = normalized.replace(/\.0+$/, '').replace(/\.$/, '')
    return SCORE_PRICE_REGEX.test(normalized)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return false
    return SCORE_PRICE_REGEX.test(trimmed)
  }

  return false
}
