import type { PolymarketConfig } from '@/config/polymarket.config'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'

/**
 * LLM 批量翻译客户端（兼容 OpenAI Chat Completions 接口）。
 *
 * 策略：把整批文本序列化为 JSON 数组，一次请求让 LLM 返回等长的翻译 JSON 数组。
 * - 翻译失败时记录日志并返回全 null（主链路不中断）
 * - 配置 enabled=false 时直接跳过
 * - 支持任意兼容 OpenAI 格式的 provider（SiliconFlow / Groq / Azure / 本地 Ollama 等）
 */
@Injectable()
export class GoogleTranslateClient {
  private readonly logger = new Logger(GoogleTranslateClient.name)
  private readonly timeoutMs: number
  private readonly apiKey: string | undefined
  private readonly baseUrl: string
  private readonly model: string

  /** 单批最大条数：防止 prompt 过长超出上下文窗口 */
  private static readonly BATCH_SIZE = 50

  constructor(private readonly configService: ConfigService) {
    const cfg = this.configService.get<PolymarketConfig>('polymarket')
    this.timeoutMs = cfg?.translation?.timeoutMs ?? 30_000
    this.apiKey = cfg?.translation?.apiKey
    this.baseUrl = cfg?.translation?.baseUrl ?? 'https://api.openai.com'
    this.model = cfg?.translation?.model ?? 'gpt-4o-mini'
  }

  /**
   * 批量翻译一组英文文本到目标语言（默认中文简体）。
   * 内部按 BATCH_SIZE 分批，每批一次 LLM 请求。
   *
   * @returns 与入参等长的数组，翻译失败的项为 null
   */
  async translateBatch(
    texts: string[],
    targetLang = 'Simplified Chinese',
  ): Promise<(string | null)[]> {
    if (!texts.length) return []
    if (!this.apiKey) {
      this.logger.warn('LLM translate: API key not configured, skipping translation')
      return texts.map(() => null)
    }

    // 过滤空字符串，记录下标映射
    const nonEmptyIndices: number[] = []
    const nonEmptyTexts: string[] = []
    for (let i = 0; i < texts.length; i++) {
      if (texts[i]?.trim()) {
        nonEmptyIndices.push(i)
        nonEmptyTexts.push(texts[i])
      }
    }

    const results: (string | null)[] = texts.map(() => null)
    if (!nonEmptyTexts.length) return results

    // 按 BATCH_SIZE 分批，每批一次 LLM 请求
    for (let i = 0; i < nonEmptyTexts.length; i += GoogleTranslateClient.BATCH_SIZE) {
      const chunk = nonEmptyTexts.slice(i, i + GoogleTranslateClient.BATCH_SIZE)
      const chunkResults = await this.doTranslateBatch(chunk, targetLang)
      for (let j = 0; j < chunk.length; j++) {
        results[nonEmptyIndices[i + j]] = chunkResults[j]
      }
    }

    return results
  }

  /**
   * 翻译单个文本（空时返回 null）。
   */
  async translateOne(text: string, targetLang = 'Simplified Chinese'): Promise<string | null> {
    if (!text?.trim()) return null
    const results = await this.translateBatch([text], targetLang)
    return results[0] ?? null
  }

  /**
   * 单次 LLM 请求翻译一批文本（最多 BATCH_SIZE 条）。
   * Prompt 要求 LLM 返回纯 JSON 数组，与入参等长，整批失败时全返回 null。
   */
  private async doTranslateBatch(texts: string[], targetLang: string): Promise<(string | null)[]> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const endpoint = `${this.baseUrl.replace(/\/$/, '')}/v1/chat/completions`

      const userMessage = [
        `Translate the following JSON array of English texts to ${targetLang}.`,
        `Return ONLY a JSON array of the same length with translated strings.`,
        `Preserve proper nouns, numbers, percentages, and ticker symbols as-is.`,
        `Do NOT add any explanation or markdown, just the JSON array.`,
        ``,
        `Input:`,
        JSON.stringify(texts),
      ].join('\n')

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content:
                'You are a professional translator. Always respond with a valid JSON array only.',
            },
            {
              role: 'user',
              content: userMessage,
            },
          ],
          temperature: 0,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        this.logger.warn(
          `LLM translate API error: status=${response.status} body=${body.slice(0, 200)}`,
        )
        return texts.map(() => null)
      }

      const json = (await response.json()) as {
        choices?: { message?: { content?: string } }[]
      }

      const content = json.choices?.[0]?.message?.content?.trim() ?? ''
      return this.parseTranslationResponse(content, texts.length)
    } catch (error) {
      this.logger.warn(
        `LLM translate request failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      return texts.map(() => null)
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * 解析 LLM 返回的 JSON 数组，长度必须与 expectedLength 一致。
   * 解析失败时返回全 null 数组。
   */
  private parseTranslationResponse(content: string, expectedLength: number): (string | null)[] {
    try {
      // 兼容 LLM 有时会用 markdown 代码块包裹
      const cleaned = content
        .replace(/^```(?:json)?\n?/, '')
        .replace(/\n?```$/, '')
        .trim()
      const parsed = JSON.parse(cleaned)

      if (!Array.isArray(parsed)) {
        this.logger.warn(`LLM translate: response is not an array: ${content.slice(0, 200)}`)
        return Array.from({ length: expectedLength }, () => null)
      }

      if (parsed.length !== expectedLength) {
        this.logger.warn(
          `LLM translate: response length mismatch (expected=${expectedLength} got=${parsed.length})`,
        )
        // 长度不一致时尽量回填已有的翻译
        return Array.from({ length: expectedLength }, (_, i) =>
          typeof parsed[i] === 'string' ? (parsed[i] as string).trim() || null : null,
        )
      }

      return parsed.map((item: unknown) => (typeof item === 'string' ? item.trim() || null : null))
    } catch (error) {
      this.logger.warn(
        `LLM translate: failed to parse response JSON: ${error instanceof Error ? error.message : String(error)} content=${content.slice(0, 200)}`,
      )
      return Array.from({ length: expectedLength }, () => null)
    }
  }
}
