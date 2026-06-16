export interface SearchParamReader {
  get: (key: string) => string | null
  has: (key: string) => boolean
}

interface SearchParamsLike {
  get: (key: string) => string | null
  has: (key: string) => boolean
}

const emptySearchParamReader: SearchParamReader = {
  get: () => null,
  has: () => false,
}

export function createSearchParamReader(
  searchParams: SearchParamsLike | null | undefined,
): SearchParamReader {
  if (!searchParams) return emptySearchParamReader

  return {
    get: key => searchParams.get(key),
    has: key => searchParams.has(key),
  }
}
