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
