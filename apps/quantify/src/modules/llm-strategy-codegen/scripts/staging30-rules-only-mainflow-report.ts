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
  assistantPrompt?: string | null
  ruleSignatures: string[]
  duplicateRuleSignatures: string[]
  // Atom 键集合（condition + effects 叶子），去重排序。
  // 与 ruleSignatures 解耦：sig 含 params 用于重复检测，
  // atomKeys 仅记录 key 用于跨轮 drift/regression 检测。
  atomKeys?: string[]
  // 每轮各 phase 出现次数（来自 rule.phase 字段），用于跨轮 regression 检测。
  phaseCounts?: Record<string, number>
}

export interface Staging30StrategyConsistencyEvidence {
  passed: boolean
  userPrompt: string
  assistantPrompts: string[]
  finalAssistantPrompt: string | null
  scriptCode: string | null
  strategyTokens: string[]
  missingInFinalDescription: string[]
  missingInScript: string[]
  failures: string[]
}

export interface Staging30CaseEvidence {
  caseId: string
  status: 'passed' | 'failed'
  hashes: Staging30EvidenceHashes | null
  usedFlatFallback?: boolean
  steps: string[]
  failureReason: string | null
  sessionId?: string
  turns?: Staging30TurnEvidence[]
  answers?: Record<string, string>
  rootCause?: string | null
  consistency?: Staging30StrategyConsistencyEvidence
}

export interface Staging30EvidenceSummary {
  passed: boolean
  total: number
  passedCount: number
  failedCaseIds: string[]
  failures: string[]
  rootCauseGroups: Record<string, string[]>
}

const REQUIRED_EVIDENCE_KEYS = [
  'caseId',
  'status',
  'sessionId',
  'steps',
  'turns',
  'turns.step',
  'turns.status',
  'turns.pendingItemKeys',
  'turns.rulesCount',
  'turns.readinessReady',
  'turns.failures',
  'turns.assistantPrompt',
  'turns.ruleSignatures',
  'turns.duplicateRuleSignatures',
  'hashes.rulesHash',
  'hashes.canonicalSpecHash',
  'hashes.irHash',
  'hashes.astHash',
  'hashes.scriptHash',
  'hashes.runtimeEvaluatorVersion',
  'failureReason',
  'rootCause',
  'answers',
  'consistency.userPrompt',
  'consistency.assistantPrompts',
  'consistency.finalAssistantPrompt',
  'consistency.scriptCode',
  'consistency.strategyTokens',
  'consistency.missingInFinalDescription',
  'consistency.missingInScript',
  'consistency.failures',
] as const

interface CodegenResponse {
  id: string
  status?: string
  canonicalDigest?: string | null
  assistantPrompt?: string | null
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

function hasNonEmptyRulesEvidence(item: Staging30CaseEvidence): boolean {
  return item.turns?.some(turn => typeof turn.rulesCount === 'number' && turn.rulesCount > 0) ?? false
}

function failureForEvidence(item: Staging30CaseEvidence): string | null {
  if (item.status !== 'passed') return item.failureReason ?? item.rootCause ?? 'case failed'
  if (item.usedFlatFallback) return item.failureReason ?? 'flat fallback observed'
  if (!hasNonEmptyRulesEvidence(item)) return item.failureReason ?? 'rules_tree_empty'
  if (!hasCompleteHashes(item.hashes)) return item.failureReason ?? 'hashes incomplete'
  if (!item.consistency?.passed) return item.failureReason ?? 'strategy_script_mismatch'
  if (!item.steps.includes('confirmGenerate')) return 'confirmGenerate missing'
  if (item.turns?.some(turn => turn.pendingItemKeys.length > 0) && !item.steps.includes('clarification')) {
    return 'dialogue clarification loop missing'
  }
  return null
}

function rootCauseForEvidence(item: Staging30CaseEvidence, reason: string): string {
  if (item.rootCause) return item.rootCause
  if (reason.includes('rules_tree')) return 'rules_tree_empty'
  if (reason.includes('dispatcher_fallback_used') || item.usedFlatFallback) return 'dispatcher_fallback_used'
  if (reason.includes('readiness_not_ready')) return 'readiness_not_ready'
  if (reason.includes('clarification')) return 'clarification_not_resolved_to_script'
  if (reason.includes('strategy_script_mismatch')) return 'strategy_script_mismatch'
  if (reason.includes('hash')) return 'hash_chain_missing'
  return 'unknown'
}

export function requiredEvidenceKeys(): string[] {
  return [...REQUIRED_EVIDENCE_KEYS]
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

const STRATEGY_TOKEN_ALIASES: Record<string, readonly string[]> = {
  okx: ['okx', '欧易'],
  binance: ['binance', '币安'],
  btcusdt: ['btcusdt', 'btc/usdt', 'btc'],
  ethusdt: ['ethusdt', 'eth/usdt', 'eth'],
  solusdt: ['solusdt', 'sol/usdt', 'sol'],
  ordiusdt: ['ordiusdt', 'ordi/usdt', 'ordi'],
  perp: ['perp', 'perpetual', 'swap', '永续', '合约'],
  spot: ['spot', '现货'],
  long: ['long', 'buy', 'open_long', '做多', '开多', '买入'],
  short: ['short', 'sell_short', 'open_short', '做空', '开空'],
  close: ['close', 'exit', '平仓', '平多', '平空', '卖出'],
  grid: ['grid', '网格'],
  dca: ['dca', '定投', '加投'],
  webhook: ['webhook', 'external.signal', 'signalid'],
  bollinger: ['boll', 'bollinger', '布林'],
  ema: ['ema'],
  ma: ['ma'],
  macd: ['macd'],
  rsi: ['rsi'],
  atr: ['atr'],
  volume: ['volume', '成交量', '放量'],
  stop_loss: ['stop_loss', 'stoploss', '止损', '亏损'],
  take_profit: ['take_profit', 'takeprofit', '止盈', '盈利'],
  drawdown: ['drawdown', '回撤'],
  '1m': ['1m', '1min', '1分钟'],
  '3m': ['3m', '3min', '3分钟'],
  '15m': ['15m', '15min', '15分钟'],
  '30m': ['30m', '30min', '30分钟'],
  '1h': ['1h', '1小时'],
  '4h': ['4h', '4小时'],
  '1d': ['1d', '1day', '日线', '每天', '每日'],
}

function normalizeForTokenSearch(text: string): string {
  return text.toLowerCase().replace(/\s+/gu, '')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function textContainsStrategyToken(text: string, token: string): boolean {
  const normalized = normalizeForTokenSearch(text)
  const aliases = STRATEGY_TOKEN_ALIASES[token] ?? [token]
  if (token === 'ma') {
    return /\bma\b/iu.test(text)
  }
  if (/^\d+[mhd]$/u.test(token)) {
    return aliases.some((alias) => {
      const normalizedAlias = normalizeForTokenSearch(alias)
      return new RegExp(`(?<!\\d)${escapeRegExp(normalizedAlias)}(?!\\d)`, 'u').test(normalized)
    })
  }
  return aliases.some(alias => normalized.includes(normalizeForTokenSearch(alias)))
}

/**
 * #1633 staging s29：当 prompt 含 pyramiding 关键字（加仓 / 补仓 / 金字塔 /
 *   scale in / 层 / layer / 加 N 层）且 "盈利 X%" 同句出现时，"盈利X%" 在
 *   语义上是 pyramiding profit trigger（加仓阈值），而非传统 take_profit 出场。
 *   此时 take_profit 别名（盈利 / 止盈 / takeprofit）若仅由 "盈利X%" 触发，
 *   应当从期望 token 中剔除，避免 token 报告误判 script 缺失 take_profit。
 *
 * 决策语义：返回 true ⇔ prompt 同时包含 "盈利 X%" 与 pyramiding 关键字，
 *   且 prompt 中没有其它独立的止盈触发证据（如显式 "止盈" / "takeprofit"）。
 */
function isProfitTokenPyramidingDisambig(input: string): boolean {
  const normalized = normalizeForTokenSearch(input)
  const hasProfitPercent = /盈利[\s\S]{0,4}\d+(?:\.\d+)?\s*[%％]/u.test(input)
  if (!hasProfitPercent) return false
  const hasPyramidingKeyword = normalized.includes('加仓')
    || normalized.includes('补仓')
    || normalized.includes('金字塔')
    || normalized.includes('scalein')
    || /(?:^|[^a-z])layer(?:s)?(?:[^a-z]|$)/u.test(normalized)
    || /(?:加|补)\s*\d+\s*(?:层|次)/u.test(input)
  if (!hasPyramidingKeyword) return false
  // 显式 take_profit 证据（非 "盈利X%"）仍保留 token：止盈 / takeprofit。
  const hasExplicitTakeProfit = normalized.includes('止盈') || normalized.includes('takeprofit')
  return !hasExplicitTakeProfit
}

export function extractStrategyTokens(input: string): string[] {
  const tokens = new Set<string>()
  const skipTakeProfit = isProfitTokenPyramidingDisambig(input)
  for (const token of Object.keys(STRATEGY_TOKEN_ALIASES)) {
    if (skipTakeProfit && token === 'take_profit') continue
    if (textContainsStrategyToken(input, token)) tokens.add(token)
  }
  for (const match of input.matchAll(/\b(?:ema|ma)\s*(\d{1,3})\b/giu)) {
    tokens.add(`${match[0].toLowerCase().replace(/\s+/gu, '')}`)
  }
  for (const match of input.matchAll(/(\d+(?:\.\d+)?)\s*(?:%|％)/gu)) {
    tokens.add(`${match[1]}%`)
  }
  for (const match of input.matchAll(/(\d+(?:\.\d+)?)\s*usdt/giu)) {
    tokens.add(`${match[1]}usdt`)
  }
  return [...tokens].sort()
}

// Bollinger middle band IS the SMA(period) by definition. When text references
// `bollinger.middle` / `bollinger.touch_middle` / 布林带中轨 together with a period
// N, treat that as semantic equivalent of `maN`. Lower/upper bands alone do NOT
// synthesize ma tokens — only the middle line.
function bollingerMiddleCoversMaToken(text: string, token: string): boolean {
  const match = /^ma(\d{1,3})$/u.exec(token)
  if (!match) return false
  const period = match[1]
  const normalized = normalizeForTokenSearch(text)
  const hasMiddleRef = normalized.includes('bollinger.middle')
    || normalized.includes('bollinger.touch_middle')
    || normalized.includes('布林中轨')
    || normalized.includes('布林带中轨')
    || normalized.includes('bollingermiddle')
    || normalized.includes('boll中轨')
  if (!hasMiddleRef) return false
  // 仅当 text 同时引用到该 period 数值，才确认是 ma<period>
  // 兼容 `(20,2)` / `period":20` / `周期20` / `bollinger(20)` 等写法
  return new RegExp(`(?<!\\d)${period}(?!\\d)`, 'u').test(normalized)
}

function tokenCovered(text: string, token: string): boolean {
  if (/^\d+(?:\.\d+)?%$/u.test(token)) {
    const value = token.replace('%', '')
    return normalizeForTokenSearch(text).includes(`${value}%`)
      || normalizeForTokenSearch(text).includes(`百分${value}`)
      || normalizeForTokenSearch(text).includes(`百分之${value}`)
  }
  if (/^\d+(?:\.\d+)?usdt$/u.test(token)) {
    return normalizeForTokenSearch(text).includes(token)
  }
  if (bollingerMiddleCoversMaToken(text, token)) return true
  return textContainsStrategyToken(text, token)
}

function readCompiledConstant(scriptCode: string, name: string): unknown {
  const pattern = new RegExp(`const ${name} = (?<json>[^\\n]+) as const`, 'u')
  const match = pattern.exec(scriptCode)
  const json = match?.groups?.json?.trim()
  if (!json || json === 'null') return null
  try {
    return JSON.parse(json)
  }
  catch {
    return null
  }
}

function addCompiledQuantityTokens(tokens: Set<string>, quantity: Record<string, unknown> | null): void {
  if (!quantity) return
  const value = typeof quantity.value === 'number' ? quantity.value : null
  if (value === null) return
  if (quantity.mode === 'fixed_quote') {
    const asset = typeof quantity.asset === 'string' ? quantity.asset.toLowerCase() : 'usdt'
    tokens.add(`${value}${asset}`)
    return
  }
  if (quantity.mode === 'pct_equity') {
    tokens.add(`${value}%`)
  }
}

function addCompiledExpressionTokens(tokens: Set<string>, exprPool: unknown): void {
  if (!Array.isArray(exprPool)) return
  for (const expr of exprPool) {
    const record = readRecord(expr)
    const payload = readRecord(record?.payload)
    if (!payload) continue
    const kind = typeof payload.kind === 'string' ? payload.kind.toUpperCase() : ''
    const timeframe = typeof payload.timeframe === 'string' ? payload.timeframe : null
    if (timeframe) tokens.add(timeframe)

    const params = readRecord(payload.params)
    const period = typeof params?.period === 'number' ? params.period : null
    if (kind === 'EMA') {
      tokens.add('ema')
      if (period !== null) tokens.add(`ema${period}`)
    }
    if (kind === 'SMA') {
      tokens.add('ma')
      if (period !== null) tokens.add(`ma${period}`)
    }
    if (kind.includes('BAND')) {
      tokens.add('bollinger')
      // 中轨即 MA(period)；emit `ma<period>` 别名以兜底自然语义 "布林带中轨(MA20)" 等表述
      if (period !== null) tokens.add(`ma${period}`)
    }
    if (kind === 'MACD') tokens.add('macd')
    if (kind === 'RSI') tokens.add('rsi')
    if (kind === 'ATR') tokens.add('atr')
    if (kind === 'VOLUME' || kind === 'SMA_VOLUME') tokens.add('volume')
    const spacing = readRecord(payload.spacing)
    if (spacing?.mode === 'pct' && typeof spacing.value === 'number') {
      tokens.add(`${spacing.value}%`)
      tokens.add('grid')
    }
    if (typeof payload.triggerPct === 'number' && payload.triggerPct > 0) {
      tokens.add(`${payload.triggerPct}%`)
      tokens.add('grid')
    }
  }
}

function addCompiledDecisionTokens(tokens: Set<string>, programs: unknown): void {
  if (!Array.isArray(programs)) return
  for (const program of programs) {
    const actions = readRecord(program)?.actions
    if (!Array.isArray(actions)) continue
    for (const action of actions) {
      const actionRecord = readRecord(action)
      const kind = typeof actionRecord?.kind === 'string' ? actionRecord.kind : ''
      if (kind === 'OPEN_LONG' || kind === 'ADD_LONG') tokens.add('long')
      if (kind === 'OPEN_SHORT' || kind === 'ADD_SHORT') tokens.add('short')
      if (kind.startsWith('CLOSE_')) tokens.add('close')
      addCompiledQuantityTokens(tokens, readRecord(actionRecord?.quantity))
    }
  }
}

function addCompiledExitPredicateTokens(tokens: Set<string>, exprPool: unknown, decisionPrograms: unknown): void {
  if (!Array.isArray(exprPool) || !Array.isArray(decisionPrograms)) return
  const exprById = new Map<string, Record<string, unknown>>()
  for (const expr of exprPool) {
    const rec = readRecord(expr)
    if (!rec) continue
    const id = typeof rec.id === 'string' ? rec.id : ''
    if (id) exprById.set(id, rec)
  }
  const constById = new Map<string, number>()
  for (const expr of exprPool) {
    const rec = readRecord(expr)
    const payload = readRecord(rec?.payload)
    if (payload?.kind === 'CONST' && typeof payload.value === 'number' && typeof payload.id === 'string') {
      constById.set(payload.id, payload.value)
    }
  }
  const seriesKindById = new Map<string, string>()
  for (const expr of exprPool) {
    const rec = readRecord(expr)
    const payload = readRecord(rec?.payload)
    const kind = typeof payload?.kind === 'string' ? payload.kind : ''
    const id = typeof payload?.id === 'string' ? payload.id : ''
    if (id && kind) seriesKindById.set(id, kind)
  }
  const visitPredicateRecursive = (predId: string, phase: string, actions: readonly unknown[]): void => {
    const expr = exprById.get(predId)
    const predicate = readRecord(expr?.payload)
    if (!predicate) return
    const predKind = typeof predicate.kind === 'string' ? predicate.kind : ''
    const args = Array.isArray(predicate.args) ? predicate.args : []
    if (predKind === 'AND' || predKind === 'OR' || predKind === 'NOT') {
      for (const a of args) {
        if (typeof a === 'string') visitPredicateRecursive(a, phase, actions)
      }
      return
    }
    if (args.length < 2) return
    const leftSourceId = typeof args[0] === 'string' ? args[0] : ''
    const rightConst = typeof args[1] === 'string' ? constById.get(args[1]) : undefined
    const leftKind = seriesKindById.get(leftSourceId) ?? ''
    const actionKinds = new Set<string>()
    for (const a of actions) {
      const k = readRecord(a)?.kind
      if (typeof k === 'string') actionKinds.add(k)
    }
    const hasAdd = actionKinds.has('ADD_LONG') || actionKinds.has('ADD_SHORT')
    if (leftKind === 'POSITION_PNL_PCT' || leftKind === 'POSITION_GAIN_PCT') {
      if (predKind === 'LTE' && typeof rightConst === 'number' && rightConst < 0) {
        tokens.add('stop_loss')
        tokens.add(`${Math.abs(rightConst)}%`)
      }
      if (predKind === 'GTE' && typeof rightConst === 'number' && rightConst > 0) {
        tokens.add('take_profit')
        tokens.add(`${rightConst}%`)
      }
    }
    if (leftKind === 'PRICE_CHANGE_PCT') {
      if (predKind === 'GTE' && typeof rightConst === 'number' && rightConst > 0) {
        if (phase === 'exit' || hasAdd) tokens.add('take_profit')
        const pct = rightConst <= 1 ? Number((rightConst * 100).toFixed(4)) : rightConst
        tokens.add(`${pct}%`)
      }
      if (predKind === 'LTE' && typeof rightConst === 'number' && rightConst < 0) {
        if (phase === 'exit' || hasAdd) tokens.add('stop_loss')
        const pct = Math.abs(rightConst) <= 1 ? Number((Math.abs(rightConst) * 100).toFixed(4)) : Math.abs(rightConst)
        tokens.add(`${pct}%`)
      }
    }
  }
  for (const program of decisionPrograms) {
    const programRec = readRecord(program)
    if (!programRec) continue
    const phase = typeof programRec.phase === 'string' ? programRec.phase : ''
    const whenId = typeof programRec.when === 'string' ? programRec.when : ''
    const actions = Array.isArray(programRec.actions) ? programRec.actions : []
    if (whenId) visitPredicateRecursive(whenId, phase, actions)
    if (phase !== 'exit') continue
    const whenExpr = exprById.get(whenId)
    const predicate = readRecord(whenExpr?.payload)
    if (!predicate) continue
    const predKind = typeof predicate.kind === 'string' ? predicate.kind : ''
    const args = Array.isArray(predicate.args) ? predicate.args : []
    if (args.length < 2) continue
    const leftSourceId = typeof args[0] === 'string' ? args[0] : ''
    const rightConst = typeof args[1] === 'string' ? constById.get(args[1]) : undefined
    const leftKind = seriesKindById.get(leftSourceId) ?? ''
    if (leftKind === 'POSITION_PNL_PCT' || leftKind === 'POSITION_GAIN_PCT') {
      if (predKind === 'LTE' && typeof rightConst === 'number' && rightConst < 0) {
        tokens.add('stop_loss')
        tokens.add(`${Math.abs(rightConst)}%`)
      }
      if (predKind === 'GTE' && typeof rightConst === 'number' && rightConst > 0) {
        tokens.add('take_profit')
        tokens.add(`${rightConst}%`)
      }
    }
    if (leftKind === 'PRICE_CHANGE_PCT') {
      if (predKind === 'GTE' && typeof rightConst === 'number' && rightConst > 0) {
        tokens.add('take_profit')
        const pct = rightConst <= 1 ? Number((rightConst * 100).toFixed(4)) : rightConst
        tokens.add(`${pct}%`)
      }
      if (predKind === 'LTE' && typeof rightConst === 'number' && rightConst < 0) {
        tokens.add('stop_loss')
        const pct = Math.abs(rightConst) <= 1 ? Number((Math.abs(rightConst) * 100).toFixed(4)) : Math.abs(rightConst)
        tokens.add(`${pct}%`)
      }
    }
    if (predKind === 'CROSS_OVER' || predKind === 'CROSS_UNDER' || predKind === 'OR') {
      // boundary-touch exit (e.g. boll middle revert) — count as take_profit when from exit phase
      tokens.add('take_profit')
    }
  }
}

function addCompiledDcaTokens(tokens: Set<string>, programs: unknown): void {
  if (!Array.isArray(programs)) return
  for (const program of programs) {
    const rec = readRecord(program)
    const meta = readRecord(rec?.metadata)
    const dca = readRecord(meta?.dcaSchedule)
    if (!dca) continue
    tokens.add('dca')
    const dropPct = typeof dca.dropPct === 'number' ? dca.dropPct : null
    if (dropPct !== null && dropPct > 0) {
      tokens.add('drawdown')
      tokens.add(`${dropPct}%`)
    }
    const perOrder = readRecord(dca.perOrderSizing)
    if (perOrder && typeof perOrder.value === 'number') {
      const asset = typeof perOrder.asset === 'string' ? perOrder.asset.toLowerCase() : 'usdt'
      tokens.add(`${perOrder.value}${asset}`)
    }
    const drawdownSizing = readRecord(dca.drawdownPerOrderSizing)
    if (drawdownSizing && typeof drawdownSizing.value === 'number') {
      const asset = typeof drawdownSizing.asset === 'string' ? drawdownSizing.asset.toLowerCase() : 'usdt'
      tokens.add(`${drawdownSizing.value}${asset}`)
    }
    const budget = typeof dca.perOrderBudget === 'number' ? dca.perOrderBudget : null
    if (budget !== null) tokens.add(`${budget}usdt`)
  }
}

function addCompiledAddPositionTokens(tokens: Set<string>, programs: unknown): void {
  if (!Array.isArray(programs)) return
  for (const program of programs) {
    const rec = readRecord(program)
    const meta = readRecord(rec?.metadata)
    const add = readRecord(meta?.addPosition)
    if (!add) continue
    const mode = typeof add.addMode === 'string' ? add.addMode : ''
    const ratio = typeof add.addRatio === 'number' ? add.addRatio : null
    const profitPct = typeof add.profitThreshold === 'number' ? add.profitThreshold : null
    const drawdownPct = typeof add.drawdownThreshold === 'number' ? add.drawdownThreshold : null
    if (mode === 'profit_pct' || profitPct !== null) {
      tokens.add('take_profit')
      tokens.add('long')
      if (profitPct !== null) {
        const pct = profitPct <= 1 ? Number((profitPct * 100).toFixed(4)) : profitPct
        tokens.add(`${pct}%`)
      }
    }
    if (mode === 'drawdown_pct' || drawdownPct !== null) {
      tokens.add('drawdown')
      if (drawdownPct !== null) {
        const pct = drawdownPct <= 1 ? Number((drawdownPct * 100).toFixed(4)) : drawdownPct
        tokens.add(`${pct}%`)
      }
    }
    if (ratio !== null) {
      const pct = ratio <= 1 ? Number((ratio * 100).toFixed(4)) : ratio
      tokens.add(`${pct}%`)
    }
  }
}

function addCompiledGuardTokens(tokens: Set<string>, programs: unknown): void {
  if (!Array.isArray(programs)) return
  for (const program of programs) {
    const payload = readRecord(readRecord(program)?.payload)
    const kind = typeof payload?.kind === 'string' ? payload.kind : ''
    const value = typeof payload?.value === 'number' ? payload.value : null
    if (kind === 'STOP_LOSS_PCT') {
      tokens.add('stop_loss')
      if (value !== null) tokens.add(`${value}%`)
    }
    if (kind === 'TAKE_PROFIT_PCT') {
      tokens.add('take_profit')
      if (value !== null) tokens.add(`${value}%`)
    }
  }
}

/**
 * #1633 staging s29：把 DECISION_PROGRAMS[].metadata.pyramidingHint 中的
 *   { maxLayers, layerSizing, profitThreshold } 数值还原为 token 证据
 *   （例如 "3%"、"50%"），让 staging30 token 报告能在 scriptCode 抽到
 *   pyramiding lifecycle 的核心参数。
 *
 * 注意：pyramidingHint.profitThreshold 来源于 price.percent_change(basis=entry_avg_price)
 *   语义上是 "盈利 X% 后加仓"（pyramiding profit trigger），并非传统 take_profit
 *   出场。这里 *不* 自动 add 'take_profit' token，否则会与 task B 的
 *   extractStrategyTokens 歧义解决冲突——具体匹配交由 task B 在 prompt 端按
 *   pyramiding 关键字消歧。
 */
export function addCompiledPyramidingHintTokens(tokens: Set<string>, programs: unknown): void {
  if (!Array.isArray(programs)) return
  for (const program of programs) {
    const rec = readRecord(program)
    const meta = readRecord(rec?.metadata)
    const hint = readRecord(meta?.pyramidingHint)
    if (!hint) continue
    const maxLayers = typeof hint.maxLayers === 'number' ? hint.maxLayers : null
    const layerSizing = typeof hint.layerSizing === 'number' ? hint.layerSizing : null
    const profitThreshold = typeof hint.profitThreshold === 'number' ? hint.profitThreshold : null
    if (profitThreshold !== null && profitThreshold > 0) {
      const pct = profitThreshold <= 1 ? Number((profitThreshold * 100).toFixed(4)) : profitThreshold
      tokens.add(`${pct}%`)
    }
    if (layerSizing !== null && layerSizing > 0) {
      const pct = layerSizing <= 1 ? Number((layerSizing * 100).toFixed(4)) : layerSizing
      tokens.add(`${pct}%`)
    }
    if (maxLayers !== null && maxLayers > 0) {
      tokens.add(`${maxLayers}`)
    }
  }
}

function addCompiledOrderProgramTokens(tokens: Set<string>, programs: unknown): void {
  if (!Array.isArray(programs)) return
  for (const program of programs) {
    const payload = readRecord(readRecord(program)?.payload)
    const kind = typeof payload?.kind === 'string' ? payload.kind.toUpperCase() : ''
    if (kind.includes('GRID') || kind.includes('LADDER')) tokens.add('grid')
    addCompiledQuantityTokens(tokens, readRecord(payload?.quantity))
  }
}

function extractCompiledScriptTokens(scriptCode: string): Set<string> {
  const tokens = new Set<string>()
  const executionModel = readRecord(readCompiledConstant(scriptCode, 'EXECUTION_MODEL'))
  const dataRequirements = readRecord(readCompiledConstant(scriptCode, 'DATA_REQUIREMENTS'))
  const exprPool = readCompiledConstant(scriptCode, 'EXPR_POOL')
  const decisionPrograms = readCompiledConstant(scriptCode, 'DECISION_PROGRAMS')
  const guardPrograms = readCompiledConstant(scriptCode, 'GUARD_PROGRAMS')
  const riskPredicates = readCompiledConstant(scriptCode, 'RISK_PREDICATES')
  const orderPrograms = readCompiledConstant(scriptCode, 'ORDER_PROGRAMS')
  const orchestrationPrograms = readCompiledConstant(scriptCode, 'ORCHESTRATION_PROGRAMS')
  const orchestrationPortfolioRisks = readCompiledConstant(scriptCode, 'ORCHESTRATION_PORTFOLIO_RISKS')

  const venue = typeof executionModel?.venue === 'string' ? executionModel.venue.toLowerCase() : null
  const symbol = typeof executionModel?.symbol === 'string' ? executionModel.symbol.toLowerCase() : null
  const instrumentType = typeof executionModel?.instrumentType === 'string' ? executionModel.instrumentType.toLowerCase() : null
  const primaryTimeframe = typeof executionModel?.primaryTimeframe === 'string' ? executionModel.primaryTimeframe : null
  if (venue) tokens.add(venue)
  if (symbol) tokens.add(symbol)
  if (instrumentType === 'spot') tokens.add('spot')
  if (instrumentType === 'perpetual') tokens.add('perp')
  if (primaryTimeframe) tokens.add(primaryTimeframe)

  const requiredTimeframes = dataRequirements?.requiredTimeframes
  if (Array.isArray(requiredTimeframes)) {
    for (const timeframe of requiredTimeframes) {
      if (typeof timeframe === 'string') tokens.add(timeframe)
    }
  }

  addCompiledExpressionTokens(tokens, exprPool)
  addCompiledDecisionTokens(tokens, decisionPrograms)
  addCompiledDecisionTokens(tokens, orderPrograms)
  addCompiledOrderProgramTokens(tokens, orderPrograms)
  addCompiledGuardTokens(tokens, guardPrograms)
  addCompiledExitPredicateTokens(tokens, exprPool, decisionPrograms)
  addCompiledPortfolioRiskTokens(orchestrationPortfolioRisks, tokens)
  addCompiledDcaTokens(tokens, decisionPrograms)
  addCompiledAddPositionTokens(tokens, decisionPrograms)
  addCompiledPyramidingHintTokens(tokens, decisionPrograms)

  const compiledText = JSON.stringify({
    exprPool,
    decisionPrograms,
    guardPrograms,
    riskPredicates,
    orderPrograms,
    orchestrationPrograms,
    orchestrationPortfolioRisks,
  }).toLowerCase()
  if (compiledText.includes('atrtrailingstop') || compiledText.includes('atrmultiplestop')) {
    tokens.add('atr')
    tokens.add('stop_loss')
  }
  if (compiledText.includes('atrmultipletakeprofit')) {
    tokens.add('atr')
    tokens.add('take_profit')
  }
  if (compiledText.includes('rememberedlevelstop')) tokens.add('stop_loss')
  if (compiledText.includes('macd')) tokens.add('macd')
  if (compiledText.includes('grid')) tokens.add('grid')
  if (compiledText.includes('dca')) tokens.add('dca')
  if (compiledText.includes('webhook') || compiledText.includes('external.signal')) tokens.add('webhook')
  if (compiledText.includes('drawdown')) tokens.add('drawdown')

  // 布林带中轨 ≡ SMA(period)。compiledText 可能仅含 `bollinger.middle` /
  //   `bollinger.touch_middle` 文本（atom key），无 MIDDLE_BAND expr 形态。
  //   为 token 覆盖一致性，扫描临近的 period 数值（如 `(20`、`"period":20`）
  //   合成 `ma${N}`。Lower/upper 不参与（中轨才是 MA）。
  if (compiledText.includes('bollinger.touch_middle') || compiledText.includes('bollinger.middle')) {
    for (const match of compiledText.matchAll(/"period"\s*:\s*(?<period>\d{1,3})/gu)) {
      const period = match.groups?.period ?? ''
      if (period.length > 0) tokens.add(`ma${period}`)
    }
  }

  // 指标 token 兜底：predicate / source ref 字符串中可能携带 ma/ema/sma 数字引用
  //   （如 `semantic_entry_entry_long_ma120_up_ma20_retest_...`）。 expr pool 经语义
  //   投影后只生成主指标 expression（ma120），但原始引用残留 ma20。为 token 校验
  //   完整性，从 compiledText 文本中扫描 `(ma|ema|sma)\d+` 模式作为指标 token。
  for (const match of compiledText.matchAll(/(?<kind>ma|ema|sma)(?<period>\d{1,3})/giu)) {
    const kind = (match.groups?.kind ?? '').toLowerCase()
    const period = match.groups?.period ?? ''
    if (kind.length === 0 || period.length === 0) continue
    // 归一化：sma → ma；ema 保留。与 STRATEGY_TOKEN_ALIASES 对齐
    const normalizedKind = kind === 'sma' ? 'ma' : kind
    tokens.add(`${normalizedKind}${period}`)
  }

  return tokens
}

export function scriptCoversStrategyToken(scriptCode: string, token: string): boolean {
  const compiledTokens = extractCompiledScriptTokens(scriptCode)
  if (compiledTokens.has(token)) return true
  if (/^\d+(?:\.\d+)?%$/u.test(token) || /^\d+(?:\.\d+)?usdt$/u.test(token)) {
    return compiledTokens.has(token.toLowerCase())
  }
  return false
}

function extractScriptCode(input: {
  response: CodegenResponse
  session: SessionRow | null
  snapshot: SnapshotRow | null
}): string | null {
  if (typeof input.response.scriptCode === 'string' && input.response.scriptCode.trim()) return input.response.scriptCode
  if (typeof input.response.script === 'string' && input.response.script.trim()) return input.response.script
  if (typeof input.snapshot?.script_snapshot === 'string' && input.snapshot.script_snapshot.trim()) return input.snapshot.script_snapshot
  if (typeof input.session?.latest_draft_code === 'string' && input.session.latest_draft_code.trim()) return input.session.latest_draft_code
  return null
}

function buildStrategyConsistencyEvidence(input: {
  userPrompt: string
  turns: readonly Staging30TurnEvidence[]
  session: SessionRow | null
  response: CodegenResponse
  snapshot: SnapshotRow | null
}): Staging30StrategyConsistencyEvidence {
  const assistantPrompts = [
    ...input.turns.map(turn => turn.assistantPrompt).filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    ...(input.session?.messages ?? [])
      .filter(message => message.role === 'assistant' && message.content.trim().length > 0)
      .map(message => message.content),
  ].filter((value, index, array) => array.indexOf(value) === index)
  const finalAssistantPrompt = assistantPrompts.at(-1) ?? null
  const scriptCode = extractScriptCode(input)
  const strategyTokens = extractStrategyTokens(input.userPrompt)
  const missingInFinalDescription = finalAssistantPrompt
    ? strategyTokens.filter(token => !tokenCovered(finalAssistantPrompt, token))
    : strategyTokens
  const missingInScript = scriptCode
    ? strategyTokens.filter(token => !scriptCoversStrategyToken(scriptCode, token))
    : strategyTokens
  const failures: string[] = []
  if (!finalAssistantPrompt) failures.push('assistant_strategy_description_missing')
  if (!scriptCode) failures.push('script_code_missing')
  if (missingInFinalDescription.length > 0) failures.push(`assistant_strategy_description_missing_tokens:${missingInFinalDescription.join('|')}`)
  if (missingInScript.length > 0) failures.push(`script_code_missing_tokens:${missingInScript.join('|')}`)

  return {
    passed: failures.length === 0,
    userPrompt: input.userPrompt,
    assistantPrompts,
    finalAssistantPrompt,
    scriptCode,
    strategyTokens,
    missingInFinalDescription,
    missingInScript,
    failures,
  }
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

export function buildStaging30ConfirmGenerateBody(): Record<string, unknown> {
  return {
    message: '确认生成',
    locale: 'zh',
  }
}

export function inferStaging30AssistantPromptAnswer(userPrompt: string, assistantPrompt: string | null | undefined): string | null {
  const prompt = assistantPrompt?.trim() ?? ''
  if (!prompt) return null
  if (/仅由网格程序自动入场|网格程序自动入场|显式加成\s*entry/u.test(prompt)) {
    return '保持仅由网格程序自动入场。'
  }
  if (/position\.sizing|单笔仓位大小|仓位大小/u.test(prompt)) {
    const fixedQuote = userPrompt.match(/(\d+(?:\.\d+)?)\s*USDT/iu)
    if (fixedQuote?.[1]) return `${fixedQuote[1]} USDT`
    const pct = userPrompt.match(/(\d+(?:\.\d+)?)\s*(?:%|％)/u)
    if (pct?.[1]) return `${pct[1]}%`
    return '10%'
  }
  if (/突破边界|breakoutAction|改为\s*stop|保持\s*continue/iu.test(prompt)) {
    return /停止|撤销|stop/iu.test(userPrompt) ? '改为 stop（停止）。' : '保持 continue（继续）。'
  }
  return null
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

// Task B：从编译产物 ORCHESTRATION_PORTFOLIO_RISKS 派生语义 token。
//   IR 形状 { scope, thresholdPct, ... } 不含 "drawdown" 子串，
//   纯 JSON 子串扫描对组合回撤护栏结构性失明。此处按 scope 派生
//   `drawdown` + `${thresholdPct}%` token，供 token 覆盖校验消费。
//   通用机制：scope === 'portfolio'（或缺省 scope，runtime 默认 portfolio）
//   即视为 drawdown 族，不针对单 case 硬编码。
export function addCompiledPortfolioRiskTokens(
  portfolioRisks: unknown,
  tokens: Set<string>,
): Set<string> {
  if (!Array.isArray(portfolioRisks)) return tokens
  for (const entry of portfolioRisks) {
    const record = readRecord(entry)
    if (!record) continue
    const scope = typeof record.scope === 'string' ? record.scope : 'portfolio'
    if (scope !== 'portfolio') continue
    tokens.add('drawdown')
    const thresholdPct = typeof record.thresholdPct === 'number' ? record.thresholdPct : null
    if (thresholdPct !== null && Number.isFinite(thresholdPct)) {
      tokens.add(`${thresholdPct}%`)
    }
  }
  return tokens
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

// 与 planner-dispatcher-merge.service 中 `stableParamsHash` 保持一致：
//   key 字典序递归排序，保证 params 同语义产生同 hash。
function stableSignatureValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(v => stableSignatureValue(v))
  const obj = value as Record<string, unknown>
  return Object.keys(obj).sort().reduce<Record<string, unknown>>((acc, k) => {
    acc[k] = stableSignatureValue(obj[k])
    return acc
  }, {})
}

const SIGNATURE_OMIT_PARAM_KEYS: ReadonlySet<string> = new Set([
  'phase',
  'source',
  'basisSource',
  'evidence',
])

function omitSignatureParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (SIGNATURE_OMIT_PARAM_KEYS.has(key)) continue
    out[key] = value
  }
  return out
}

function stableParamsSignatureHash(params: unknown): string {
  if (!params || typeof params !== 'object') return 'null'
  return JSON.stringify(stableSignatureValue(omitSignatureParams(params as Record<string, unknown>)))
}

function isActionAtomKey(key: string): boolean {
  return key.startsWith('action.')
}

function isRiskAtomKey(key: string): boolean {
  return key.startsWith('risk.')
}

// 与 planner-dispatcher-merge.normalizedEffectSideSignature 对齐：
//   - risk bucket → 'risk'
//   - key 以 _long / _short 结尾 → 对应 side
//   - params.sideScope / atom.sideScope 'long' | 'short'
//   - 否则 'both'
function normalizedAtomSideSignature(atom: { key: string, params?: unknown, sideScope?: unknown }): string {
  if (isRiskAtomKey(atom.key)) return 'risk'
  if (atom.key.endsWith('_long')) return 'long'
  if (atom.key.endsWith('_short')) return 'short'
  const params = atom.params && typeof atom.params === 'object' ? atom.params as Record<string, unknown> : null
  const paramSide = params?.sideScope
  if (paramSide === 'long' || paramSide === 'short') return paramSide
  if (atom.sideScope === 'long' || atom.sideScope === 'short') return atom.sideScope
  return 'both'
}

function atomLeafSemanticSignature(rec: Record<string, unknown>, role: 'condition' | 'effect'): string {
  const key = typeof rec.key === 'string' ? rec.key : ''
  if (role === 'effect' && isActionAtomKey(key)) {
    return `${key}|${normalizedAtomSideSignature({ key, params: rec.params, sideScope: rec.sideScope })}`
  }
  const sideScope = typeof rec.sideScope === 'string' ? rec.sideScope : ''
  return `${key}|${stableParamsSignatureHash(rec.params)}|${sideScope}`
}

function atomExprSignature(node: unknown, role: 'condition' | 'effect'): string {
  const rec = readRecord(node)
  if (!rec) return 'null'
  const kind = typeof rec.kind === 'string' ? rec.kind : ''
  if (kind === 'atom') return atomLeafSemanticSignature(rec, role)
  if (kind === 'and' || kind === 'or') {
    const children = Array.isArray(rec.children) ? rec.children : []
    return `${kind}(${children.map(child => atomExprSignature(child, role)).sort().join('&')})`
  }
  if (kind === 'not') {
    return `not(${atomExprSignature(rec.child, role)})`
  }
  if (kind === 'sequence') {
    const steps = Array.isArray(rec.steps) ? rec.steps : []
    // sequence 保留顺序
    return `sequence(${steps.map(step => atomExprSignature(step, role)).join('>')})`
  }
  return JSON.stringify(rec)
}

function collectEffectAtoms(effects: unknown, out: Array<Record<string, unknown>>): void {
  if (Array.isArray(effects)) {
    for (const eff of effects) collectEffectAtoms(eff, out)
    return
  }
  const rec = readRecord(effects)
  if (!rec) return
  const kind = typeof rec.kind === 'string' ? rec.kind : ''
  if (kind === 'atom') {
    out.push(rec)
    return
  }
  if (kind === 'and' || kind === 'or') {
    const children = Array.isArray(rec.children) ? rec.children : []
    for (const child of children) collectEffectAtoms(child, out)
    return
  }
  if (kind === 'not') {
    collectEffectAtoms(rec.child, out)
    return
  }
  if (kind === 'sequence') {
    const steps = Array.isArray(rec.steps) ? rec.steps : []
    for (const step of steps) collectEffectAtoms(step, out)
    return
  }
  // 非 AtomExpr 包装：roles 桶
  for (const role of ['actions', 'risks', 'positions', 'orchestration', 'programs']) {
    const arr = Array.isArray(rec[role]) ? (rec[role] as unknown[]) : []
    for (const eff of arr) collectEffectAtoms(eff, out)
  }
}

function effectSignatureSet(effects: unknown): string[] {
  const leaves: Array<Record<string, unknown>> = []
  collectEffectAtoms(effects, leaves)
  return leaves.map(leaf => atomLeafSemanticSignature(leaf, 'effect')).sort()
}

function normalizeRuleSideForSignature(rec: Record<string, unknown>): string {
  const leaves: Array<Record<string, unknown>> = []
  collectEffectAtoms(rec.effects, leaves)
  const actionSides = leaves
    .filter(leaf => isActionAtomKey(typeof leaf.key === 'string' ? leaf.key : ''))
    .map(leaf => normalizedAtomSideSignature({
      key: typeof leaf.key === 'string' ? leaf.key : '',
      params: leaf.params,
      sideScope: leaf.sideScope,
    }))
    .filter(side => side !== 'both')
    .sort()
  if (actionSides.length > 0) return [...new Set(actionSides)].join(',')
  return typeof rec.sideScope === 'string' ? rec.sideScope : 'both'
}

export function buildRuleSignature(rule: unknown): string | null {
  const rec = readRecord(rule)
  if (!rec) return null
  const phase = typeof rec.phase === 'string' ? rec.phase : ''
  if (!phase) return null
  const sideSig = normalizeRuleSideForSignature(rec)
  const condSig = atomExprSignature(rec.condition, 'condition')
  const effSig = JSON.stringify(effectSignatureSet(rec.effects))
  return `${phase}|${sideSig}|cond=${condSig}|eff=${effSig}`
}

function collectRuleSignatures(rules: unknown): string[] {
  if (!Array.isArray(rules)) return []
  const out: string[] = []
  for (const rule of rules) {
    const sig = buildRuleSignature(rule)
    if (sig) out.push(sig)
  }
  return out
}

function findDuplicateSignatures(signatures: readonly string[]): string[] {
  const counts = new Map<string, number>()
  for (const sig of signatures) counts.set(sig, (counts.get(sig) ?? 0) + 1)
  return [...counts.entries()].filter(([, n]) => n >= 2).map(([sig]) => sig)
}

// 从 AtomExpr 树（condition）收集所有叶子 atom.key。
//
// 等价归一化：opaque `condition.sequence` atom（携带 params.steps[] 描述
// 内部步骤）与结构化 `kind:'sequence'` 容器（steps[] 为独立 atom）语义等价。
// LLM 早期轮可能产出 opaque 形式，后续轮归一化为结构化容器。drift 检测
// 必须把两种形式视为同一 atom-key 集合，否则会把"语义细化"误判为 drift
// （Bug #1691 s19）。处理方式：遇到 atom.key=='condition.sequence' 时，
// 在 push 自身 key 的同时，把 params.steps[] 的子 atom.key 也展开收集。
function collectAtomKeysFromCondition(node: unknown, out: string[]): void {
  const rec = readRecord(node)
  if (!rec) return
  const kind = typeof rec.kind === 'string' ? rec.kind : ''
  if (kind === 'atom') {
    const key = typeof rec.key === 'string' ? rec.key : ''
    if (!key) return
    // opaque `condition.sequence` atom ↔ 结构化 `kind:'sequence'` 容器等价：
    // 不发射 wrapper key，仅展开内部步骤的 atom.key，使两种形式归一化为
    // 同一 leaf 集合。
    if (key === 'condition.sequence') {
      const params = readRecord(rec.params)
      const steps = Array.isArray(params?.steps) ? params.steps : []
      for (const step of steps) collectAtomKeysFromCondition(step, out)
      return
    }
    out.push(key)
    return
  }
  if (kind === 'and' || kind === 'or') {
    const children = Array.isArray(rec.children) ? rec.children : []
    for (const child of children) collectAtomKeysFromCondition(child, out)
    return
  }
  if (kind === 'not') {
    collectAtomKeysFromCondition(rec.child, out)
    return
  }
  if (kind === 'sequence') {
    const steps = Array.isArray(rec.steps) ? rec.steps : []
    for (const step of steps) collectAtomKeysFromCondition(step, out)
  }
}

// 从 effects 子树（AtomExpr 或 roles 桶包装）收集所有叶子 atom.key。
function collectAtomKeysFromEffects(effects: unknown, out: string[]): void {
  const leaves: Array<Record<string, unknown>> = []
  collectEffectAtoms(effects, leaves)
  for (const leaf of leaves) {
    const key = typeof leaf.key === 'string' ? leaf.key : ''
    if (key) out.push(key)
  }
}

export function collectAtomKeysFromRule(rule: unknown): string[] {
  const rec = readRecord(rule)
  if (!rec) return []
  const out: string[] = []
  collectAtomKeysFromCondition(rec.condition, out)
  collectAtomKeysFromEffects(rec.effects, out)
  return [...new Set(out)].sort()
}

export function collectAtomKeysFromRules(rules: unknown): string[] {
  if (!Array.isArray(rules)) return []
  const out = new Set<string>()
  for (const rule of rules) for (const k of collectAtomKeysFromRule(rule)) out.add(k)
  return [...out].sort()
}

export function collectPhaseCountsFromRules(rules: unknown): Record<string, number> {
  const counts: Record<string, number> = {}
  if (!Array.isArray(rules)) return counts
  for (const rule of rules) {
    const rec = readRecord(rule)
    if (!rec) continue
    const phase = typeof rec.phase === 'string' ? rec.phase : ''
    if (!phase) continue
    counts[phase] = (counts[phase] ?? 0) + 1
  }
  return counts
}

// 跨轮 semantic_drift / semantic_regression 检测。
// 与 buildRuleSignature 解耦：drift/regression 直接消费 turn.atomKeys
// 与 turn.phaseCounts，避免 sig 含 params 时的误判（Bug #1633）。
export function detectSemanticDriftAndRegression(
  turns: readonly Pick<Staging30TurnEvidence, 'atomKeys' | 'phaseCounts'>[],
): string[] {
  const failures: string[] = []
  if (turns.length === 0) return failures
  const maxPhaseCount: Record<string, number> = {}
  const seenAtomKeys = new Set<string>()
  for (const turn of turns) {
    for (const [phase, count] of Object.entries(turn.phaseCounts ?? {})) {
      if (count > (maxPhaseCount[phase] ?? 0)) maxPhaseCount[phase] = count
    }
    for (const k of turn.atomKeys ?? []) seenAtomKeys.add(k)
  }
  const finalTurn = turns[turns.length - 1]
  const finalPhaseCounts = finalTurn.phaseCounts ?? {}
  for (const phase of Object.keys(maxPhaseCount)) {
    if ((finalPhaseCounts[phase] ?? 0) < maxPhaseCount[phase]) {
      failures.push('semantic_regression')
      break
    }
  }
  const finalAtomKeys = new Set<string>(finalTurn.atomKeys ?? [])
  for (const k of seenAtomKeys) {
    if (!finalAtomKeys.has(k)) {
      failures.push('semantic_drift')
      break
    }
  }
  return failures
}

function analyzeSessionRow(row: SessionRow | null): { rulesCount: number | null, readinessReady: boolean | null, failures: string[], ruleSignatures: string[], duplicateRuleSignatures: string[], atomKeys: string[], phaseCounts: Record<string, number> } {
  if (!row) return { rulesCount: null, readinessReady: null, failures: ['session_missing'], ruleSignatures: [], duplicateRuleSignatures: [], atomKeys: [], phaseCounts: {} }
  const state = readRecord(row.semantic_state)
  const rules = state?.rules
  const ruleIds = collectRuleIds(rules)
  const failures: string[] = []
  if (!Array.isArray(rules) || rules.length === 0) failures.push('rules_tree_empty')
  if (ruleIds.some(id => id.startsWith('dispatcher-fallback-'))) failures.push('dispatcher_fallback_used')
  if (hasFlatFallbackMarker(row.semantic_state) || hasFlatFallbackMarker(row.latest_spec_desc)) failures.push('flat_fallback_marker')
  const ruleSignatures = collectRuleSignatures(rules)
  const duplicateRuleSignatures = findDuplicateSignatures(ruleSignatures)
  if (duplicateRuleSignatures.length > 0) failures.push('duplicate_rule_signature')
  const validation = readRecord(row.compiled_ir)
  const readinessReady = typeof validation?.ready === 'boolean' ? validation.ready : null
  const atomKeys = collectAtomKeysFromRules(rules)
  const phaseCounts = collectPhaseCountsFromRules(rules)
  return { rulesCount: Array.isArray(rules) ? rules.length : null, readinessReady, failures, ruleSignatures, duplicateRuleSignatures, atomKeys, phaseCounts }
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
    : { rulesCount: null, readinessReady: null, failures: [], ruleSignatures: [], duplicateRuleSignatures: [], atomKeys: [], phaseCounts: {} }
  const responseText = JSON.stringify(input.response)
  const failures = [...analysis.failures]
  if (responseText.includes('flatFallback')) failures.push('flat_fallback_marker')
  // 验收标准1的"每次一条"针对 assistantPrompt 发问数，不是 pendingItems 状态列表长度；
  // runner 本来就 slice(0,1)，pendingItems 多槽属合理状态，不报。
  return {
    step: input.step,
    status: input.response.status ?? row?.status ?? 'UNKNOWN',
    pendingItemKeys: pendingItems.map(item => item.key),
    rulesCount: analysis.rulesCount,
    readinessReady: analysis.readinessReady,
    failures: [...new Set(failures)],
    assistantPrompt: typeof input.response.assistantPrompt === 'string' && input.response.assistantPrompt.trim()
      ? input.response.assistantPrompt
      : null,
    ruleSignatures: analysis.ruleSignatures,
    duplicateRuleSignatures: analysis.duplicateRuleSignatures,
    atomKeys: analysis.atomKeys,
    phaseCounts: analysis.phaseCounts,
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
  if (joined.includes('duplicate_rule_signature')) return 'duplicate_rule_signature'
  if (joined.includes('semantic_regression')) return 'semantic_regression'
  if (joined.includes('semantic_drift')) return 'semantic_drift'
  if (joined.includes('assistant_prompt_loop')) return 'assistant_prompt_loop'
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

    const assistantPromptAnswer = response.status === 'DRAFTING'
      ? inferStaging30AssistantPromptAnswer(item.prompt, response.assistantPrompt)
      : null
    if (assistantPromptAnswer) {
      answers[`assistantPrompt.${turn}`] = assistantPromptAnswer
      response = await postJson<CodegenResponse>(
        apiBaseUrl,
        authToken,
        `/llm-strategy-codegen/sessions/${response.id}/messages`,
        {
          message: assistantPromptAnswer,
          locale: 'zh',
        },
      )
      confirmed = false
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
        buildStaging30ConfirmGenerateBody(),
      )
      turns.push(await readTurnEvidence({ client, sessionId: response.id, response, step: 'confirmGenerate' }))
      if (response.status === 'GENERATING' || response.status === 'PUBLISHED' || response.status === 'CONSISTENCY_FAILED' || response.status === 'REJECTED') {
        response = await pollPublishedSession({ apiBaseUrl, authToken, client, sessionId: response.id, turns })
      }
      if (response.status !== 'DRAFTING') break
    }
    else {
      break
    }
  }

  const hashes = extractStaging30HashesFromResponse(response as unknown as Record<string, unknown>)
    ?? await extractHashesFromDb(client, response.id)
  const finalSession = client ? await fetchSession(client, response.id) : null
  const finalSnapshot = client ? await fetchLatestSnapshot(client, response.id) : null
  const consistency = buildStrategyConsistencyEvidence({
    userPrompt: item.prompt,
    turns,
    session: finalSession,
    response,
    snapshot: finalSnapshot,
  })
  const turnFailures = turns.flatMap(turn => turn.failures)
  if (
    turns.some(turn => turn.pendingItemKeys.length > 0)
    && !turns.some(turn => turn.step === 'clarification')
  ) {
    turnFailures.push('clarification_not_resolved_to_script')
  }
  // 跨轮语义单调性 + 偏移检测：
  // 1) phase 计数：最终轮 phase 不应比任意中间轮少（语义缺失）
  // 2) atom.key 集合：所有轮"已识别"的 atom keys 在最终轮应保留（语义偏移=key 被换掉）
  // 直接消费 turn.atomKeys / turn.phaseCounts；不要从 param-aware sig 反推（Bug #1633）
  turnFailures.push(...detectSemanticDriftAndRegression(turns))
  // 重复 assistantPrompt（≥2 次完全相同 → 追问循环）
  const promptCounts = new Map<string, number>()
  for (const turn of turns) {
    if (turn.assistantPrompt) promptCounts.set(turn.assistantPrompt, (promptCounts.get(turn.assistantPrompt) ?? 0) + 1)
  }
  if ([...promptCounts.values()].some(n => n >= 3)) turnFailures.push('assistant_prompt_loop')
  if (response.status !== 'PUBLISHED') turnFailures.push(`terminal_status_${response.status ?? 'UNKNOWN'}`)
  turnFailures.push(...consistency.failures)
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
    consistency,
  }
}

const CASE_TIMEOUT_MS = 180_000
const CASE_MAX_ATTEMPTS = 3

async function runCaseWithTimeout(apiBaseUrl: string, authToken: string, client: PoolClient | null, item: Staging30RulesOnlyCase): Promise<Staging30CaseEvidence> {
  return await new Promise<Staging30CaseEvidence>((resolveResult, rejectResult) => {
    const timer = setTimeout(() => rejectResult(new Error(`case_timeout:${CASE_TIMEOUT_MS}ms`)), CASE_TIMEOUT_MS)
    runCase(apiBaseUrl, authToken, client, item).then(
      (value) => { clearTimeout(timer); resolveResult(value) },
      (err) => { clearTimeout(timer); rejectResult(err) },
    )
  })
}

async function runCaseWithRetry(apiBaseUrl: string, authToken: string, client: PoolClient | null, item: Staging30RulesOnlyCase): Promise<Staging30CaseEvidence> {
  let lastEvidence: Staging30CaseEvidence | null = null
  let lastError: string | null = null
  for (let attempt = 1; attempt <= CASE_MAX_ATTEMPTS; attempt += 1) {
    try {
      const evidence = await runCaseWithTimeout(apiBaseUrl, authToken, client, item)
      lastEvidence = evidence
      if (evidence.status === 'passed') return evidence
      process.stderr.write(`[staging30] case ${item.id} attempt ${attempt}/${CASE_MAX_ATTEMPTS} failed: ${evidence.failureReason ?? 'unknown'}\n`)
    }
    catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      process.stderr.write(`[staging30] case ${item.id} attempt ${attempt}/${CASE_MAX_ATTEMPTS} threw: ${lastError}\n`)
    }
  }
  if (lastEvidence) return lastEvidence
  return {
    caseId: item.id,
    status: 'failed',
    hashes: null,
    usedFlatFallback: false,
    steps: ['session'],
    failureReason: lastError ?? 'unknown_runtime_error',
    rootCause: classifyRootCause([], lastError),
  }
}

async function runAllCases(apiBaseUrl: string, authToken: string, client: PoolClient | null, selectedCases: readonly Staging30RulesOnlyCase[]): Promise<{ summary: Staging30EvidenceSummary, cases: Staging30CaseEvidence[] }> {
  const evidence: Staging30CaseEvidence[] = []
  for (const item of selectedCases) {
    process.stderr.write(`[staging30] case ${item.id}\n`)
    evidence.push(await runCaseWithRetry(apiBaseUrl, authToken, client, item))
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
