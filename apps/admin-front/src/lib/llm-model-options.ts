export const LLM_MODEL_OPTIONS = [
  { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
  { label: 'DeepSeek Chat', value: 'deepseek-chat' },
  { label: 'DeepSeek Reasoner', value: 'deepseek-reasoner' },
] as const

export type LlmModelOption = (typeof LLM_MODEL_OPTIONS)[number]['value']

