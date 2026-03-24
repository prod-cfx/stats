/**
 * Evenly sample levels while preserving order.
 * Used to keep fixed row count but cover a wider price range.
 */
export function sampleLevelsForDisplay<T>(
  levels: T[],
  limit: number,
): T[] {
  if (limit <= 0 || levels.length === 0)
    return []
  if (levels.length <= limit)
    return levels
  if (limit === 1)
    return [levels[0]]

  const result: T[] = []
  const maxIndex = levels.length - 1
  const step = maxIndex / (limit - 1)
  let prevIndex = -1

  for (let i = 0; i < limit; i++) {
    let index = Math.round(i * step)
    if (index <= prevIndex)
      index = Math.min(prevIndex + 1, maxIndex)
    result.push(levels[index])
    prevIndex = index
  }

  return result
}
