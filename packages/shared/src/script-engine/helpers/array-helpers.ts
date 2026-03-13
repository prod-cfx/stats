/**
 * 数组操作辅助函数
 */

/**
 * 滚动窗口计算
 * @param array 输入数组
 * @param window 窗口大小
 * @param fn 计算函数
 */
export function rolling<T, R>(
  array: T[],
  window: number,
  fn: (slice: T[]) => R,
): R[] {
  if (!Array.isArray(array) || window <= 0 || window > array.length) {
    return []
  }
  
  const result: R[] = []
  for (let i = window - 1; i < array.length; i++) {
    const slice = array.slice(i - window + 1, i + 1)
    result.push(fn(slice))
  }
  
  return result
}

/**
 * 差分（计算相邻元素的差）
 */
export function diff(array: number[], periods = 1): number[] {
  if (!Array.isArray(array) || periods <= 0 || periods >= array.length) {
    return []
  }
  
  const result: number[] = []
  for (let i = periods; i < array.length; i++) {
    result.push(array[i]! - array[i - periods]!)
  }
  
  return result
}

/**
 * 百分比变化
 */
export function pctChange(array: number[], periods = 1): number[] {
  if (!Array.isArray(array) || periods <= 0 || periods >= array.length) {
    return []
  }
  
  const result: number[] = []
  for (let i = periods; i < array.length; i++) {
    const prev = array[i - periods]!
    if (prev === 0) {
      result.push(0)
    }
    else {
      result.push((array[i]! - prev) / prev)
    }
  }
  
  return result
}

/**
 * 累积和
 */
export function cumsum(array: number[]): number[] {
  if (!Array.isArray(array) || array.length === 0) return []
  
  const result: number[] = []
  let sum = 0
  
  for (const value of array) {
    sum += value
    result.push(sum)
  }
  
  return result
}

/**
 * 累积乘积
 */
export function cumprod(array: number[]): number[] {
  if (!Array.isArray(array) || array.length === 0) return []
  
  const result: number[] = []
  let prod = 1
  
  for (const value of array) {
    prod *= value
    result.push(prod)
  }
  
  return result
}

/**
 * 归一化到 [0, 1]
 */
export function normalize(array: number[]): number[] {
  if (!Array.isArray(array) || array.length === 0) return []
  
  const minVal = Math.min(...array)
  const maxVal = Math.max(...array)
  const range = maxVal - minVal
  
  if (range === 0) {
    return array.map(() => 0)
  }
  
  return array.map(val => (val - minVal) / range)
}

/**
 * 标准化（Z-score）
 */
export function standardize(array: number[]): number[] {
  if (!Array.isArray(array) || array.length === 0) return []
  
  const mean = array.reduce((sum, val) => sum + val, 0) / array.length
  const variance = array.reduce((sum, val) => sum + (val - mean)**2, 0) / array.length
  const stdDev = Math.sqrt(variance)
  
  if (stdDev === 0) {
    return array.map(() => 0)
  }
  
  return array.map(val => (val - mean) / stdDev)
}

/**
 * 获取数组的最后 N 个元素
 */
export function tail<T>(array: T[], n: number): T[] {
  if (!Array.isArray(array) || n <= 0) return []
  return array.slice(-n)
}

/**
 * 获取数组的前 N 个元素
 */
export function head<T>(array: T[], n: number): T[] {
  if (!Array.isArray(array) || n <= 0) return []
  return array.slice(0, n)
}

/**
 * 移动数组元素（向前或向后移动）
 */
export function shift<T>(array: T[], periods: number, fillValue?: T): T[] {
  if (!Array.isArray(array) || array.length === 0) return []
  
  if (periods === 0) return [...array]
  
  if (periods > 0) {
    // 向后移动（前面填充）
    const fill = fillValue !== undefined ? fillValue : array[0]
    return [...Array.from({ length: periods }).fill(fill) as T[], ...array.slice(0, -periods)]
  }
  else {
    // 向前移动（后面填充）
    const absPeriods = Math.abs(periods)
    const fill = fillValue !== undefined ? fillValue : array[array.length - 1]
    return [...array.slice(absPeriods), ...Array.from({ length: absPeriods }).fill(fill) as T[]]
  }
}

/**
 * 查找数组中满足条件的第一个元素的索引
 */
export function findIndex<T>(array: T[], predicate: (value: T, index: number) => boolean): number {
  if (!Array.isArray(array)) return -1
  
  for (let i = 0; i < array.length; i++) {
    if (predicate(array[i]!, i)) {
      return i
    }
  }
  
  return -1
}

/**
 * 查找数组中满足条件的最后一个元素的索引
 */
export function findLastIndex<T>(array: T[], predicate: (value: T, index: number) => boolean): number {
  if (!Array.isArray(array)) return -1
  
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i]!, i)) {
      return i
    }
  }
  
  return -1
}

/**
 * 去重
 */
export function unique<T>(array: T[]): T[] {
  if (!Array.isArray(array)) return []
  return [...new Set(array)]
}

/**
 * 压缩多个数组（类似 Python 的 zip）
 */
export function zip<T>(...arrays: T[][]): T[][] {
  if (arrays.length === 0) return []
  
  const minLength = Math.min(...arrays.map(arr => arr.length))
  const result: T[][] = []
  
  for (let i = 0; i < minLength; i++) {
    result.push(arrays.map(arr => arr[i]!))
  }
  
  return result
}
