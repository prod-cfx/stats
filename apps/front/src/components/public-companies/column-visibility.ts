export type PublicCompaniesOptionalColumn = 'change1d' | 'change7d'

const HIDDEN_COLUMNS: ReadonlySet<PublicCompaniesOptionalColumn> = new Set([
  'change1d',
  'change7d',
])

export function isPublicCompaniesColumnVisible(column: PublicCompaniesOptionalColumn): boolean {
  return !HIDDEN_COLUMNS.has(column)
}
