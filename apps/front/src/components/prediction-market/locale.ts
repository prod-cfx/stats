export function toPolymarketLocale(language?: string): 'zh' | 'en' {
  return language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}
