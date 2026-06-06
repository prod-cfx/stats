export const OFFICIAL_STRATEGY_PLAZA_CATEGORIES = [
  '趋势',
  '突破',
  '反转',
  '网格',
  'DCA',
  '盘口',
  '衍生品事件',
  '风控稳健',
] as const

export type OfficialStrategyPlazaCategory = typeof OFFICIAL_STRATEGY_PLAZA_CATEGORIES[number]

export const OFFICIAL_STRATEGY_PLAZA_CATEGORY_COUNT_RULE = {
  min: 3,
  max: 6,
} as const
