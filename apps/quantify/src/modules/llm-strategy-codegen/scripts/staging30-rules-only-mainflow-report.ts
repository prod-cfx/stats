import type { Pool, PoolClient } from 'pg'
import type { StrategyClarificationItem } from '../types/strategy-clarification'
import type { Staging30RulesOnlyCase } from './staging30-rules-only-mainflow-cases'
import { createHash } from 'node:crypto'
import { config as loadDotenv } from 'dotenv'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { canonicalSerialize } from '@ai/shared/script-engine/compiled-runtime'
import { STAGING30_RULES_ONLY_CASES } from './staging30-rules-only-mainflow-cases'

export interface Staging30EvidenceHashes {
  rulesHash: string
  canonicalSpecHash: string
  irHash: string
  astHash: string
  scriptHash: string
  runtimeEvaluatorVersion: string
}

export interface Staging30TurnEvidence {
  step: 'session' | 'clarification' | 'confirmGenerate' | 'poll'
  status: string
  pendingItemKeys: string[]
  rulesCount: number | null
  readinessReady: boolean | null
  failures: string[]
}

export interface Staging30CaseEvidence {
  caseId: string
  status: 'passed' | 'failed'
  hashes: Staging30EvidenceHashes | null
  usedFlatFallback: boolean
  steps: string[]
  failureReason: string | null
  sessionId?: string
  turns?: Staging30TurnEvidence[]
  answers?: Record<string, string>
  rootCause?: string | null
}

export interface Staging30EvidenceSummary {
  passed: boolean
  total: number
  passedCount: number
  failedCaseIds: string[]
  failures: string[]
  rootCauseGroups: Record<string, string[]>
}

interface CodegenResponse {
  id: string
  status?: string
  canonicalDigest?: string | null
  scriptCode?: string | null
  script?: string | null
  specDesc?: Record<string, unknown> | null
  rejectReason?: string | null
  clarificationGate?: {
    pendingItems?: StrategyClarificationItem[]
  } | null
  clarificationState?: {
    status?: string
    items?: StrategyClarificationItem[]
  } | null
}

interface SessionRow {
  id: string
  status: string
  semantic_state: unknown
  clarification_state: unknown
  latest_draft_code: string | null
  latest_spec_desc: unknown
  compiled_ir: unknown
  reject_reason: string | null
  messages: Array<{ role: 'user' | 'assistant', content: string }> | null
}

interface SnapshotRow {
  script_hash: string | null
  spec_hash: string | null
  script_snapshot: string | null
  compiled_manifest: unknown
}

interface Args {
  apiBaseUrl: string | null
  authToken: string | null
  env: string
  out: string
  indices: string[] | null
  preserveExistingEnv: boolean
}

function hasCompleteHashes(hashes: Staging30EvidenceHashes | null): hashes is Staging30EvidenceHashes {
  if (!hashes) return false
  return [
    hashes.rulesHash,
    hashes.canonicalSpecHash,
    hashes.irHash,
    hashes.astHash,
    hashes.scriptHash,
    hashes.runtimeEvaluatorVersion,
  ].every(value => typeof value === 'string' && value.trim().length > 0)
}

function failureForEvidence(item: Staging30CaseEvidence): string | null {
  if (item.status !== 'passed') return item.failureReason ?? item.rootCause ?? 'case failed'
  if (item.usedFlatFallback) return item.failureReason ?? 'flat fallback observed'
  if (!hasCompleteHashes(item.hashes)) return item.failureReason ?? 'hashes incomplete'
  if (!item.steps.includes('confirmGenerate')) return 'confirmGenerate missing'
  if (item.turns?.some(turn => turn.pendingItemKeys.length > 0) && !item.steps.includes('clarification')) {
    return 'dialogue clarification loop missing'
  }
  return null
}

function rootCauseForEvidence(item: Staging30CaseEvidence, reason: string): string {
  if (item.rootCause) return item.rootCause
  if (reason.includes('rules_tree_empty')) return 'rules_tree_empty'
  if (reason.includes('dispatcher_fallback_used') || item.usedFlatFallback) return 'dispatcher_fallback_used'
  if (reason.includes('readiness_not_ready')) return 'readiness_not_ready'
  if (reason.includes('clarification')) return 'clarification_not_resolved_to_script'
  if (reason.includes('strategy_script_mismatch')) return 'strategy_script_mismatch'
  if (reason.includes('hash')) return 'hash_chain_missing'
  return 'unknown'
}

export function buildStaging30EvidenceSummary(
  cases: readonly Staging30CaseEvidence[],
  expectedTotal = STAGING30_RULES_ONLY_CASES.length,
): Staging30EvidenceSummary {
  const failed = cases
    .map(item => ({ item, reason: failureForEvidence(item) }))
    .filter((entry): entry is { item: Staging30CaseEvidence, reason: string } => entry.reason !== null)
  const rootCauseGroups: Record<string, string[]> = {}
  for (const entry of failed) {
    const rootCause = rootCauseForEvidence(entry.item, entry.reason)
    rootCauseGroups[rootCause] = [...(rootCauseGroups[rootCause] ?? []), entry.item.caseId]
  }

  return {
    passed: failed.length === 0 && cases.length === expectedTotal,
    total: cases.length,
    passedCount: cases.length - failed.length,
    failedCaseIds: failed.map(entry => entry.item.caseId),
    failures: failed.map(entry => `${entry.item.caseId}: ${entry.reason}`),
    rootCauseGroups,
  }
}

async function postJson<T>(apiBaseUrl: string, authToken: string, path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${authToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${path}: ${await response.text()}`)
  }

  return unwrapApiResponse<T>(await response.json())
}

async function getJson<T>(apiBaseUrl: string, authToken: string, path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${authToken}` },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${path}: ${await response.text()}`)
  }

  return unwrapApiResponse<T>(await response.json())
}

function unwrapApiResponse<T>(value: unknown): T {
  const record = readRecord(value)
  if (record && 'data' in record) return record.data as T
  return value as T
}

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  if (Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readRuntimeEvaluatorVersion(response: Record<string, unknown>): string {
  const scriptCode = typeof response.scriptCode === 'string'
    ? response.scriptCode
    : typeof response.script === 'string'
      ? response.script
      : ''
  const header = /^\/\* @generated by (?<version>[^*]+) \*\//u.exec(scriptCode)
  return header?.groups?.version.trim() ?? ''
}

function hashCanonicalJson(value: unknown): string {
  return createHash('sha256').update(canonicalSerialize(value)).digest('hex')
}

function normalizeHash(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  const trimmed = value.trim()
  return trimmed.startsWith('sha256:') ? trimmed : `sha256:${trimmed}`
}

function readHashes(value: unknown, runtimeEvaluatorVersion: string): Staging30EvidenceHashes | null {
  const record = readRecord(value)
  if (!record) return null
  const hashes = record.hashes && typeof record.hashes === 'object'
    ? record.hashes as Record<string, unknown>
    : record
  const result = {
    rulesHash: typeof hashes.rulesHash === 'string' ? hashes.rulesHash : '',
    canonicalSpecHash: typeof hashes.canonicalSpecHash === 'string' ? hashes.canonicalSpecHash : '',
    irHash: typeof hashes.irHash === 'string' ? hashes.irHash : '',
    astHash: typeof hashes.astHash === 'string' ? hashes.astHash : '',
    scriptHash: typeof hashes.scriptHash === 'string' ? hashes.scriptHash : '',
    runtimeEvaluatorVersion,
  }
  return hasCompleteHashes(result) ? result : null
}

export function extractStaging30HashesFromResponse(response: Record<string, unknown>): Staging30EvidenceHashes | null {
  const runtimeEvaluatorVersion = readRuntimeEvaluatorVersion(response)
  const specDesc = readRecord(response.specDesc)
  const candidates = [
    specDesc?.rulesOnlyHashChain,
  ]

  for (const candidate of candidates) {
    const hashes = readHashes(candidate, runtimeEvaluatorVersion)
    if (hashes) return hashes
  }

  return null
}

export function readStaging30ConfirmationDigest(response: Pick<CodegenResponse, 'canonicalDigest' | 'specDesc'>): string | undefined {
  if (typeof response.canonicalDigest === 'string' && response.canonicalDigest.trim()) {
    return response.canonicalDigest.trim()
  }
  const specDesc = readRecord(response.specDesc)
  const confirmation = readRecord(specDesc?.confirmation)
  const confirmationDigest = confirmation?.digest
  if (typeof confirmationDigest === 'string' && confirmationDigest.trim()) {
    return confirmationDigest.trim()
  }
  const specDigest = specDesc?.canonicalDigest
  return typeof specDigest === 'string' && specDigest.trim() ? specDigest.trim() : undefined
}

function readPendingItems(response: CodegenResponse): StrategyClarificationItem[] {
  const gateItems = response.clarificationGate?.pendingItems
  if (Array.isArray(gateItems) && gateItems.length > 0) return gateItems
  const items = response.clarificationState?.items
  if (!Array.isArray(items)) return []
  return items.filter(item => item.blocking && item.status === 'pending')
}

function extractPercent(text: string, fallback: string): string {
  const matched = text.match(/(?:百分之?|%|％)\s*(\d+(?:\.\d+)?)/u)
    ?? text.match(/(\d+(?:\.\d+)?)\s*(?:%|％)/u)
  return matched?.[1] ? `${matched[1]}%` : fallback
}

function inferExchange(input: string): string {
  if (/币安|binance/i.test(input)) return 'binance'
  if (/okx|欧易/i.test(input)) return 'okx'
  return 'okx'
}

function inferMarketType(input: string): string {
  if (/现货|spot/i.test(input)) return 'spot'
  if (/合约|永续|perp|perpetual/i.test(input)) return 'perp'
  return 'perp'
}

function inferTimeframe(input: string): string {
  if (/每天|每日|daily|day/i.test(input)) return '1d'
  if (/日线/u.test(input)) return '1d'
  const normalized = input
    .replace(/分钟|分/u, 'm')
    .replace(/小时/u, 'h')
    .replace(/日线|天/u, 'd')
  const matched = normalized.match(/(\d+)\s*(min|m|h|d|day)\b/iu)
  if (!matched) return '15m'
  const unit = matched[2].toLowerCase()
  if (unit === 'min') return `${matched[1]}m`
  if (unit === 'day') return `${matched[1]}d`
  return `${matched[1]}${unit}`
}

function inferSymbol(input: string): string {
  const upper = input.toUpperCase()
  const pair = upper.match(/\b([A-Z]{2,12})\s*\/?\s*USDT\b/u)
  if (pair?.[1]) return `${pair[1]}USDT`
  const asset = upper.match(/\b(BTC|ETH|SOL|ORDI)\b/u)
  return `${asset?.[1] ?? 'BTC'}USDT`
}

function inferSizing(input: string): string {
  const fixed = input.match(/(\d+(?:\.\d+)?)\s*USDT/iu)
  if (fixed?.[1]) return `${fixed[1]} USDT`
  const bareFixed = input.match(/(?:每次|单笔|每笔|一次)\s*(\d+(?:\.\d+)?)(?!\s*(?:%|％))/u)
  if (bareFixed?.[1]) return `${bareFixed[1]} USDT`
  const percent = input.match(/(?:单笔|仓位|使用|固定仓位|每次).*?(\d+(?:\.\d+)?)\s*(?:%|％)/u)
    ?? input.match(/百分之?\s*(\d+(?:\.\d+)?)/u)
  if (percent?.[1]) return `${percent[1]}%`
  return '10%'
}

export function inferStaging30ClarificationAnswer(input: string, item: StrategyClarificationItem): string {
  const field = `${item.field ?? ''} ${item.fieldPath ?? ''} ${item.slotKey ?? ''} ${item.reason ?? ''} ${item.question ?? ''}`.toLowerCase()
  if (item.allowedAnswers?.length) {
    const allowed = item.allowedAnswers.map(value => value.toLowerCase())
    if (field.includes('exchange')) {
      const exchange = inferExchange(input)
      if (allowed.includes(exchange)) return exchange
    }
    if (field.includes('market')) {
      const marketType = inferMarketType(input)
      if (allowed.includes(marketType)) return marketType
    }
    if (field.includes('basis') && allowed.includes('entry_avg_price')) return 'entry_avg_price'
    if (field.includes('confirmation') && allowed.includes('touch')) return 'touch'
    if (allowed.includes('no')) return 'no'
    if (allowed.includes('false')) return 'false'
    return item.allowedAnswers[0]
  }
  if (field.includes('exchange')) return inferExchange(input)
  if (field.includes('symbol')) return inferSymbol(input)
  if (field.includes('timeframe')) return inferTimeframe(input)
  if (field.includes('market')) return inferMarketType(input)
  if (field.includes('missing_entry_rules') || field.includes('entryrules') || field.includes('rulestree.empty')) {
    if (/(?:定投|DCA|dca)/u.test(input)) return '入场规则：每天按 1d 周期定投 100 USDT。'
    return input
  }
  if (field.includes('missing_exit_rules') || field.includes('exitrules')) {
    if (/(?:网格|grid).*(?:突破|边界|上下边界|撤销|停止)/iu.test(input)) {
      return '退出规则：当价格突破网格上下边界时，立即停止策略并撤销所有未成交订单。'
    }
    if (/(?:定投|DCA|dca)/u.test(input) && !/(?:卖出|平仓|止损|止盈|退出|停止)/u.test(input)) {
      return '补充退出：价格相对入场均价下跌 5% 时卖出退出。'
    }
    if (/(?:出场|平仓|平多|平空|卖出|止损|止盈|回到|跌破|突破区间上沿|停止网格|撤销)/u.test(input)) return input
    return '价格相对入场均价下跌 5% 时平仓。'
  }
  if (field.includes('grid')) {
    if (field.includes('breakout') || field.includes('cancel') || field.includes('撤销') || field.includes('停止')) {
      return /停止|撤销|cancel|stop/iu.test(input) ? 'stop' : 'continue'
    }
    if (field.includes('center')) {
      const center = input.match(/上下各\s*(\d+(?:\.\d+)?)\s*(?:%|％)/u)
      if (center?.[1]) return `${center[1]}%`
    }
    if (field.includes('level')) {
      const levels = input.match(/(?:共)?\s*(\d+)\s*格/u)
      if (levels?.[1]) return levels[1]
    }
  }
  if (field.includes('add_position') && field.includes('constraint')) {
    if (/(?:定投|DCA|dca|加投|补仓)/u.test(input)) return '最多加投 1 次；按原策略：回撤 5% 时加投 200 USDT。'
    return '按原策略：盈利 3% 后加仓 50%，最多加 3 层。'
  }
  if (field.includes('orchestration.phase0.unsupported') && /(?:网格|grid)/iu.test(input)) {
    return '这是固定网格策略；以部署时当前价为中心建网格，不需要事件监听。'
  }
  if (field.includes('position') || field.includes('sizing') || field.includes('budget')) return inferSizing(input)
  if (field.includes('basis')) return 'entry_avg_price'
  if (field.includes('lower') || field.includes('upper')) {
    const range = input.match(/(\d+(?:\.\d+)?)\s*[-到至]\s*(\d+(?:\.\d+)?)/u)
    if (range?.[1] && field.includes('lower')) return range[1]
    if (range?.[2] && field.includes('upper')) return range[2]
  }
  if (field.includes('step')) {
    const step = input.match(/(?:间距|每格).*?(\d+(?:\.\d+)?)\s*(?:%|％)/u)
    if (step?.[1]) return `${step[1]}%`
  }
  if (field.includes('side')) return /双向/u.test(input) ? 'both' : 'long'
  if (field.includes('stop')) return extractPercent(input, '5%')
  if (field.includes('take')) return extractPercent(input, '10%')
  return '按原策略描述补齐。'
}

function buildClarificationAnswers(input: string, items: readonly StrategyClarificationItem[]): Record<string, string> {
  const answers: Record<string, string> = {}
  for (const item of items) {
    answers[item.key] = inferStaging30ClarificationAnswer(input, item)
  }
  return answers
}

function collectRuleIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(rule => (rule as { id?: unknown }).id)
    .filter((id): id is string => typeof id === 'string')
}

function hasFlatFallbackMarker(value: unknown): boolean {
  return JSON.stringify(value).includes('flatFallback')
}

function analyzeSessionRow(row: SessionRow | null): { rulesCount: number | null, readinessReady: boolean | null, failures: string[] } {
  if (!row) return { rulesCount: null, readinessReady: null, failures: ['session_missing'] }
  const state = readRecord(row.semantic_state)
  const rules = state?.rules
  const ruleIds = collectRuleIds(rules)
  const failures: string[] = []
  if (!Array.isArray(rules) || rules.length === 0) failures.push('rules_tree_empty')
  if (ruleIds.some(id => id.startsWith('dispatcher-fallback-'))) failures.push('dispatcher_fallback_used')
  if (hasFlatFallbackMarker(row.semantic_state) || hasFlatFallbackMarker(row.latest_spec_desc)) failures.push('flat_fallback_marker')
  const validation = readRecord(row.compiled_ir)
  const readinessReady = typeof validation?.ready === 'boolean' ? validation.ready : null
  return { rulesCount: Array.isArray(rules) ? rules.length : null, readinessReady, failures }
}

async function fetchSession(client: PoolClient, sessionId: string): Promise<SessionRow | null> {
  const result = await client.query<SessionRow>(`
    SELECT
      s.id,
      s.status::text AS status,
      s.semantic_state,
      s.clarification_state,
      s.latest_draft_code,
      s.latest_spec_desc,
      s.compiled_ir,
      s.reject_reason,
      COALESCE(
        jsonb_agg(
          jsonb_build_object('role', m.role::text, 'content', m.content)
          ORDER BY m.sort_order
        ) FILTER (WHERE m.id IS NOT NULL),
        '[]'::jsonb
      ) AS messages
    FROM llm_strategy_codegen_sessions s
    LEFT JOIN ai_quant_conversations c ON c.codegen_session_id = s.id
    LEFT JOIN ai_quant_conversation_messages m ON m.conversation_id = c.id
    WHERE s.id = $1
    GROUP BY s.id
  `, [sessionId])
  return result.rows[0] ?? null
}

async function fetchLatestSnapshot(client: PoolClient, sessionId: string): Promise<SnapshotRow | null> {
  const result = await client.query<SnapshotRow>(`
    SELECT
      script_hash,
      spec_hash,
      script_snapshot,
      compiled_manifest
    FROM published_strategy_snapshots
    WHERE session_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `, [sessionId])
  return result.rows[0] ?? null
}

async function extractHashesFromDb(client: PoolClient | null, sessionId: string): Promise<Staging30EvidenceHashes | null> {
  if (!client) return null
  const [session, snapshot] = await Promise.all([
    fetchSession(client, sessionId),
    fetchLatestSnapshot(client, sessionId),
  ])
  if (!session || !snapshot) return null
  const semanticState = readRecord(session.semantic_state)
  const rules = semanticState?.rules
  if (!Array.isArray(rules) || rules.length === 0) return null
  const manifest = readRecord(snapshot.compiled_manifest)
  const scriptHeaderVersion = readRuntimeEvaluatorVersion({
    scriptCode: snapshot.script_snapshot ?? '',
  })
  const hashes: Staging30EvidenceHashes = {
    rulesHash: normalizeHash(hashCanonicalJson(rules)),
    canonicalSpecHash: normalizeHash(manifest?.specHash ?? snapshot.spec_hash),
    irHash: normalizeHash(manifest?.irHash),
    astHash: normalizeHash(manifest?.astDigest),
    scriptHash: normalizeHash(snapshot.script_hash),
    runtimeEvaluatorVersion: typeof manifest?.compileVersion === 'string'
      ? manifest.compileVersion
      : scriptHeaderVersion,
  }
  return hasCompleteHashes(hashes) ? hashes : null
}

async function readTurnEvidence(input: {
  client: PoolClient | null
  sessionId: string
  response: CodegenResponse
  step: Staging30TurnEvidence['step']
}): Promise<Staging30TurnEvidence> {
  const pendingItems = readPendingItems(input.response)
  const row = input.client ? await fetchSession(input.client, input.sessionId) : null
  const analysis = input.client
    ? analyzeSessionRow(row)
    : { rulesCount: null, readinessReady: null, failures: [] }
  const responseText = JSON.stringify(input.response)
  const failures = [...analysis.failures]
  if (responseText.includes('flatFallback')) failures.push('flat_fallback_marker')
  return {
    step: input.step,
    status: input.response.status ?? row?.status ?? 'UNKNOWN',
    pendingItemKeys: pendingItems.map(item => item.key),
    rulesCount: analysis.rulesCount,
    readinessReady: analysis.readinessReady,
    failures: [...new Set(failures)],
  }
}

async function pollPublishedSession(input: {
  apiBaseUrl: string
  authToken: string
  client: PoolClient | null
  sessionId: string
  turns: Staging30TurnEvidence[]
}): Promise<CodegenResponse> {
  const maxAttempts = 240
  const intervalMs = 2000
  const terminalFailureStatuses = new Set(['CONSISTENCY_FAILED', 'REJECTED'])

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const session = await getJson<CodegenResponse>(input.apiBaseUrl, input.authToken, `/llm-strategy-codegen/sessions/${input.sessionId}`)
    input.turns.push(await readTurnEvidence({
      client: input.client,
      sessionId: input.sessionId,
      response: session,
      step: 'poll',
    }))
    const status = typeof session.status === 'string' ? session.status : 'UNKNOWN'
    if (status === 'PUBLISHED') return session
    if (terminalFailureStatuses.has(status)) {
      return session
    }
    await sleep(intervalMs)
  }

  throw new Error('session publish polling timed out')
}

function classifyRootCause(failures: readonly string[], error: string | null): string | null {
  const joined = `${failures.join('|')} ${error ?? ''}`
  if (joined.includes('dispatcher_fallback_used') || joined.includes('flat_fallback_marker')) return 'dispatcher_fallback_used'
  if (joined.includes('rules_tree_empty')) return 'rules_tree_empty'
  if (joined.includes('readiness_not_ready')) return 'readiness_not_ready'
  if (joined.includes('clarification_not_resolved_to_script')) return 'clarification_not_resolved_to_script'
  if (joined.includes('ui_script_mismatch')) return 'ui_script_mismatch'
  if (joined.includes('strategy_script_mismatch')) return 'strategy_script_mismatch'
  if (joined.includes('hash')) return 'hash_chain_missing'
  return error ? 'runtime_error' : null
}

async function runCase(apiBaseUrl: string, authToken: string, client: PoolClient | null, item: Staging30RulesOnlyCase): Promise<Staging30CaseEvidence> {
  const turns: Staging30TurnEvidence[] = []
  const answers: Record<string, string> = {}
  let response = await postJson<CodegenResponse>(apiBaseUrl, authToken, '/llm-strategy-codegen/sessions', {
    initialMessage: item.prompt,
    locale: 'zh',
  })
  turns.push(await readTurnEvidence({ client, sessionId: response.id, response, step: 'session' }))

  let confirmed = false
  for (let turn = 1; turn <= 24; turn += 1) {
    const pendingItems = readPendingItems(response)
    if (pendingItems.length > 0) {
      const turnAnswers = buildClarificationAnswers(item.prompt, pendingItems.slice(0, 1))
      Object.assign(answers, turnAnswers)
      response = await postJson<CodegenResponse>(
        apiBaseUrl,
        authToken,
        `/llm-strategy-codegen/sessions/${response.id}/messages`,
        {
          message: Object.entries(turnAnswers).map(([key, value]) => `${key}: ${value}`).join('\n'),
          clarificationAnswers: turnAnswers,
          locale: 'zh',
        },
      )
      turns.push(await readTurnEvidence({ client, sessionId: response.id, response, step: 'clarification' }))
      continue
    }

    if (!confirmed) {
      confirmed = true
      response = await getJson<CodegenResponse>(apiBaseUrl, authToken, `/llm-strategy-codegen/sessions/${response.id}`)
      response = await postJson<CodegenResponse>(
        apiBaseUrl,
        authToken,
        `/llm-strategy-codegen/sessions/${response.id}/messages`,
        {
          message: '确认生成',
          confirmGenerate: true,
          confirmedCanonicalDigest: readStaging30ConfirmationDigest(response),
          locale: 'zh',
        },
      )
      turns.push(await readTurnEvidence({ client, sessionId: response.id, response, step: 'confirmGenerate' }))
      if (response.status === 'GENERATING' || response.status === 'PUBLISHED' || response.status === 'CONSISTENCY_FAILED' || response.status === 'REJECTED') {
        response = await pollPublishedSession({ apiBaseUrl, authToken, client, sessionId: response.id, turns })
      }
      break
    }
  }

  const hashes = extractStaging30HashesFromResponse(response as unknown as Record<string, unknown>)
    ?? await extractHashesFromDb(client, response.id)
  const turnFailures = turns.flatMap(turn => turn.failures)
  if (
    turns.some(turn => turn.pendingItemKeys.length > 0)
    && !turns.some(turn => turn.step === 'clarification')
  ) {
    turnFailures.push('clarification_not_resolved_to_script')
  }
  if (response.status !== 'PUBLISHED') turnFailures.push(`terminal_status_${response.status ?? 'UNKNOWN'}`)
  const usedFlatFallback = turnFailures.includes('dispatcher_fallback_used')
    || turnFailures.includes('flat_fallback_marker')
    || JSON.stringify(response).includes('flatFallback')
  if (!hashes) turnFailures.push('hash_chain_missing')
  const rootCause = classifyRootCause(turnFailures, null)
  const failureReason = [...new Set(turnFailures)].join(', ') || null

  return {
    caseId: item.id,
    sessionId: response.id,
    status: hashes && !usedFlatFallback && turnFailures.length === 0 ? 'passed' : 'failed',
    hashes,
    usedFlatFallback,
    steps: [...new Set(turns.map(turn => turn.step))],
    failureReason,
    turns,
    answers,
    rootCause,
  }
}

async function runAllCases(apiBaseUrl: string, authToken: string, client: PoolClient | null, selectedCases: readonly Staging30RulesOnlyCase[]): Promise<{ summary: Staging30EvidenceSummary, cases: Staging30CaseEvidence[] }> {
  const evidence: Staging30CaseEvidence[] = []
  for (const item of selectedCases) {
    process.stderr.write(`[staging30] case ${item.id}\n`)
    try {
      evidence.push(await runCase(apiBaseUrl, authToken, client, item))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      evidence.push({
        caseId: item.id,
        status: 'failed',
        hashes: null,
        usedFlatFallback: false,
        steps: ['session'],
        failureReason: message,
        rootCause: classifyRootCause([], message),
      })
    }
  }
  return { summary: buildStaging30EvidenceSummary(evidence, selectedCases.length), cases: evidence }
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    apiBaseUrl: null,
    authToken: null,
    env: 'staging',
    out: 'tmp/staging30-rules-only-mainflow-report.json',
    indices: null,
    preserveExistingEnv: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i]
    if (item === '--api-base-url') args.apiBaseUrl = argv[++i] ?? null
    else if (item === '--auth-token') args.authToken = argv[++i] ?? null
    else if (item === '--env') args.env = argv[++i] ?? args.env
    else if (item === '--out') args.out = argv[++i] ?? args.out
    else if (item === '--indices') args.indices = (argv[++i] ?? '').split(',').map(value => value.trim()).filter(Boolean)
    else if (item === '--preserve-existing-env') args.preserveExistingEnv = true
  }
  return args
}

function findEnvRoot(env: string): string {
  let current = process.cwd()
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(resolve(current, `.env.${env}`)) && existsSync(resolve(current, `.env.${env}.local`))) {
      return current
    }
    const parent = resolve(current, '..')
    if (parent === current) break
    current = parent
  }
  throw new Error(`missing_env_files:${env}`)
}

function loadRunnerEnv(env: string, preserveExistingEnv: boolean): void {
  const root = findEnvRoot(env)
  loadDotenv({ path: resolve(root, `.env.${env}`), override: false })
  loadDotenv({ path: resolve(root, `.env.${env}.local`), override: !preserveExistingEnv })
}

async function createPoolIfConfigured(): Promise<Pool | null> {
  const connectionString = process.env.QUANTIFY_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim()
  if (!connectionString) return null
  const pg = await import('pg')
  return new pg.Pool({ connectionString })
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  loadRunnerEnv(args.env, args.preserveExistingEnv)
  const apiBaseUrl = (args.apiBaseUrl ?? process.env.QUANTIFY_STAGING_API_BASE_URL ?? process.env.QUANTIFY_API_BASE_URL ?? process.env.QUANTIFY_BASE_URL)?.trim()
  const authToken = (args.authToken ?? process.env.QUANTIFY_STAGING_AUTH_TOKEN ?? process.env.AI_QUANT_JWT_TOKEN)?.trim()
  if (!apiBaseUrl || !authToken) {
    console.error(JSON.stringify({
      passed: false,
      reason: 'staging_env_missing',
      requiredEnv: ['QUANTIFY_STAGING_API_BASE_URL or QUANTIFY_API_BASE_URL or QUANTIFY_BASE_URL', 'QUANTIFY_STAGING_AUTH_TOKEN or AI_QUANT_JWT_TOKEN'],
    }, null, 2))
    process.exitCode = 1
    return
  }

  const selectedCases = args.indices
    ? STAGING30_RULES_ONLY_CASES.filter(item => args.indices?.includes(item.id) || args.indices?.includes(item.id.replace(/^s/u, '')))
    : STAGING30_RULES_ONLY_CASES
  if (selectedCases.length === 0) throw new Error(`selected_cases_empty:${args.indices?.join(',') ?? ''}`)

  const pool = await createPoolIfConfigured()
  const client = pool ? await pool.connect() : null
  try {
    const report = await runAllCases(apiBaseUrl.replace(/\/+$/u, ''), authToken, client, selectedCases)
    const fullReport = {
      env: args.env,
      generatedAt: new Date().toISOString(),
      source: 'pm2-staging-http-dialogue',
      summary: report.summary,
      cases: report.cases,
    }
    const out = resolve(args.out)
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, `${JSON.stringify(fullReport, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify(report.summary, null, 2))
    process.exitCode = report.summary.passed ? 0 : 1
  }
  finally {
    client?.release()
    await pool?.end()
  }
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(JSON.stringify({
      passed: false,
      reason: error instanceof Error ? error.message : String(error),
    }, null, 2))
    process.exitCode = 1
  })
}
