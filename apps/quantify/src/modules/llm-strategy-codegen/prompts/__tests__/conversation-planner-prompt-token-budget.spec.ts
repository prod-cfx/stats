/**
 * Issue #1345 PR1.0 — Prompt token budget guard
 *
 * 把 system prompt 喂给 OpenAI（max_completion_tokens=1）拿真实 usage.prompt_tokens；
 * 若无 API key 走 char-based 启发式估算。
 *
 * 启发式精度：cjk/1.5 + ascii/4 + other/2 经验比例；对中英文混合 prompt 实测
 * 与 OpenAI cl100k_base BPE 比较常**低估**（中文实际更接近 1 token/char 而非 1.5）。
 * 因此为 heuristic 和 real 路径分设阈值：
 *   - HEURISTIC_THRESHOLD = 10000（容忍 heuristic 与真值 ~20% 偏差）
 *   - REAL_OPENAI_THRESHOLD = 8000（gpt-5.4-nano 128K context 12x 安全系数）
 *
 * 在 LLM_STRATEGY_CODEGEN_API_KEY 缺失或 SKIP_REAL_LLM_TOKEN_COUNT=1 时降级 heuristic，
 * 不阻塞 CI；本地开发需要真实数字时确保 API key 在 .env.test.local。
 */

import { buildConversationPlannerSystemPrompt } from '../conversation-planner-system.prompt'

const REAL_OPENAI_THRESHOLD = 8000
const HEURISTIC_THRESHOLD = 10000

function charBasedEstimate(text: string): number {
  let cjk = 0
  let ascii = 0
  let other = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code >= 0x4E00 && code <= 0x9FFF) cjk++
    else if (code < 0x80) ascii++
    else other++
  }
  return Math.round(cjk / 1.5 + ascii / 4 + other / 2)
}

async function countViaOpenAI(prompt: string, signal: AbortSignal): Promise<number | null> {
  const apiKey = process.env.LLM_STRATEGY_CODEGEN_API_KEY
  const baseUrl = process.env.LLM_STRATEGY_CODEGEN_BASE_URL ?? 'https://api.openai.com'
  const model = process.env.LLM_STRATEGY_CODEGEN_MODEL ?? 'gpt-5.4-nano'
  if (!apiKey || apiKey.startsWith('__') || process.env.SKIP_REAL_LLM_TOKEN_COUNT === '1') return null

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_completion_tokens: 1,
        temperature: 0,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: '{"message":"ping"}' },
        ],
      }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { usage?: { prompt_tokens?: number } }
    return json.usage?.prompt_tokens ?? null
  } catch {
    return null
  }
}

describe('conversation planner prompt — token budget (issue #1345 PR1.0)', () => {
  jest.setTimeout(20_000)

  for (const locale of ['zh', 'en'] as const) {
    it(`locale=${locale} prompt 在 token 阈值内（real=${REAL_OPENAI_THRESHOLD} / heuristic=${HEURISTIC_THRESHOLD}）`, async () => {
      const prompt = buildConversationPlannerSystemPrompt(locale)
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 10_000)
      let real: number | null = null
      try {
        real = await countViaOpenAI(prompt, ctrl.signal)
      } finally {
        clearTimeout(timer)
      }
      const estimate = charBasedEstimate(prompt)
      const reported = real ?? estimate
      const source = real != null ? 'openai_usage' : 'char_heuristic'
      const threshold = real != null ? REAL_OPENAI_THRESHOLD : HEURISTIC_THRESHOLD
      // 输出供 PR body 抄录

      console.log(`[#1345 PR1.0] locale=${locale} chars=${prompt.length} tokens=${reported} (${source}; heuristic=${estimate}; threshold=${threshold})`)
      expect(reported).toBeLessThan(threshold)
    })
  }
})
