function trimZeros(value: string): string {
  const negative = value.startsWith('-')
  const abs = negative ? value.slice(1) : value
  const [rawInteger = '0', rawFraction = ''] = abs.split('.')

  const integer = rawInteger.replace(/^0+(?=\d)/, '') || '0'
  const fraction = rawFraction.replace(/0+$/, '')
  const normalized = fraction ? `${integer}.${fraction}` : integer
  const withLeadingZero = normalized.startsWith('.') ? `0${normalized}` : normalized

  if (withLeadingZero === '0')
    return '0'

  return negative ? `-${withLeadingZero}` : withLeadingZero
}

function assertNumberString(value: string): void {
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) {
    throw new TypeError('Invalid number format')
  }
}

const stringMath = {
  log10Floor(value: string): number {
    const abs = value[0] === '-' ? value.slice(1) : value
    const num = Number(abs)

    if (num === 0 || Number.isNaN(num))
      return Number.NEGATIVE_INFINITY

    const [int, dec = ''] = abs.split('.')
    if (Number(int) !== 0) {
      const trimmed = int.replace(/^0+/, '')
      return trimmed.length - 1
    }

    const leadingZeros = dec.match(/^0*/)?.[0].length ?? 0
    return -(leadingZeros + 1)
  },

  multiplyByPow10(value: string, exp: number): string {
    if (!Number.isInteger(exp))
      throw new RangeError('Exponent must be an integer')

    if (exp === 0)
      return trimZeros(value)

    const neg = value[0] === '-' ? '-' : ''
    const abs = neg ? value.slice(1) : value
    const [intRaw, dec = ''] = abs.split('.')
    const int = intRaw || '0'

    let result: string
    if (exp > 0) {
      result = exp >= dec.length
        ? `${int}${dec}${'0'.repeat(exp - dec.length)}`
        : `${int}${dec.slice(0, exp)}.${dec.slice(exp)}`
    }
    else {
      const absExp = -exp
      result = absExp >= int.length
        ? `0.${'0'.repeat(absExp - int.length)}${int}${dec}`
        : `${int.slice(0, -absExp)}.${int.slice(-absExp)}${dec}`
    }

    return trimZeros(`${neg}${result}`)
  },

  trunc(value: string): string {
    const dotIndex = value.indexOf('.')
    return dotIndex === -1 ? value : value.slice(0, dotIndex) || '0'
  },

  toPrecisionTruncate(value: string, precision: number): string {
    if (!Number.isInteger(precision))
      throw new RangeError('Precision must be an integer')
    if (precision < 1)
      throw new RangeError('Precision must be positive')
    if (/^-?0+(?:\.0*)?$/.test(value))
      return '0'

    const neg = value[0] === '-' ? '-' : ''
    const abs = neg ? value.slice(1) : value
    const magnitude = stringMath.log10Floor(abs)
    const shiftAmount = precision - magnitude - 1
    const shifted = stringMath.multiplyByPow10(abs, shiftAmount)
    const truncated = stringMath.trunc(shifted)
    const result = stringMath.multiplyByPow10(truncated, -shiftAmount)

    return trimZeros(`${neg}${result}`)
  },

  toFixedTruncate(value: string, decimals: number): string {
    if (!Number.isInteger(decimals))
      throw new RangeError('Decimals must be an integer')
    if (decimals < 0)
      throw new RangeError('Decimals must be non-negative')

    const regex = new RegExp(`^-?(?:\\d+)?(?:\\.\\d{0,${decimals}})?`)
    const result = value.match(regex)?.[0]
    if (!result)
      throw new TypeError('Invalid number format')

    return trimZeros(result)
  },
}

// Mirrors the SDK formatting rules locally so the quantify CommonJS build does
// not depend on the package's ESM-only "./utils" export resolution.
export function formatPrice(price: string | number, szDecimals: number, isPerp = true): string {
  const normalized = price.toString().trim()
  assertNumberString(normalized)

  if (/^-?\d+$/.test(normalized))
    return trimZeros(normalized)

  const maxDecimals = Math.max((isPerp ? 6 : 8) - szDecimals, 0)
  const truncatedDecimals = stringMath.toFixedTruncate(normalized, maxDecimals)

  return stringMath.toPrecisionTruncate(truncatedDecimals, 5)
}

export function formatSize(size: string | number, szDecimals: number): string {
  const normalized = size.toString().trim()
  assertNumberString(normalized)

  return stringMath.toFixedTruncate(normalized, szDecimals)
}
