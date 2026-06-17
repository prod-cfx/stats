export function toSortedCompat<T>(
  items: readonly T[],
  compareFn: (a: T, b: T) => number,
): T[] {
  const nativeToSorted = (items as T[]).toSorted
  if (typeof nativeToSorted === 'function') {
    return nativeToSorted.call(items, compareFn)
  }

  const copy = Array.from(items)
  copy.sort(compareFn)
  return copy
}
