/**
 * Issue #1345 PR1.1 — Atom Catalog Projection
 *
 * 从 ATOM_CONTRACT_REGISTRY 单一真相源派生 LLM planner 可消费的 atom 词典。
 * 取代 conversation-planner-system.prompt.ts 里"让 LLM 凭空造 schema"的旧形态。
 *
 * 设计原则（#1279 第一性原则）：
 *   1) 所有数据从 ATOM_CONTRACT_REGISTRY 动态派生，禁止写死 atom 数量 / key 列表
 *   2) phase 仅暴露全局 enum ['entry','exit','gate']；by-clause-verb 类 atom 由 LLM
 *      根据用户意图填，fixed-* 类 atom 通过 fixedPhase 提示固定值
 *   3) paramSlots 字段名 + required + kind + enum 紧凑表达，省略 enum 全集以控 token
 *   4) 模块级 memoize：buildAtomCatalogEntries() / formatAtomCatalogForPrompt(locale)
 *      只在首次调用构建，后续返回同一引用
 */

import type { AtomContractKey, AtomContractBucket } from '../atom-contracts/atom-contract-types'
import { ATOM_CONTRACT_REGISTRY, getAllRegisteredAtomKeys } from '../atom-contracts/atom-contract-registry'

const PHASE_ENUM = ['entry', 'exit', 'gate'] as const
export type PromptPhase = typeof PHASE_ENUM[number]

/**
 * phaseResolver 字符串字面量 → prompt 暴露的固定 phase 映射。
 *
 * - `'fixed-entry' | 'fixed-exit' | 'fixed-gate'` → 对应 PromptPhase 值
 * - `'by-clause-verb'` → 不在表内（LLM 自己根据用户意图填 phase）
 * - `{ kind: 'fn', fn }` 对象形态 → 不在表内（同上）
 *
 * 未来若 phaseResolver 扩了新字符串字面量但忘了来这里加映射，spec 会捕获 —— 因为
 * `fixedPhase` 字段会被设为 undefined，spec 的"fixedPhase 仅在 phaseResolver ===
 * fixed-* 时出现"反向断言会暴露漏映射的 atom（spec 检查 phaseResolver vs fixedPhase
 * 强一致）。
 */
const FIXED_PHASE_MAP: Readonly<Record<string, PromptPhase>> = {
  'fixed-entry': 'entry',
  'fixed-exit': 'exit',
  'fixed-gate': 'gate',
}

export interface AtomCatalogParamField {
  readonly name: string
  readonly required: boolean
  readonly kind: 'number' | 'percent' | 'duration' | 'enum' | 'symbol'
  readonly enum?: readonly string[]
  readonly note?: string
}

export interface AtomCatalogEntry {
  readonly key: AtomContractKey
  readonly bucket: AtomContractBucket
  /** 仅 phaseResolver === 'fixed-*' 时暴露，提示 LLM 该 atom 的 phase 已固定 */
  readonly fixedPhase?: PromptPhase
  readonly paramFields: readonly AtomCatalogParamField[]
  /** 取自 corpus.goldenUtterances[0]，可能为空 */
  readonly example?: string
}

/**
 * 模块级 memoize。安全前提：`ATOM_CONTRACT_REGISTRY` 在运行期不可变（contract
 * registry 是编译期静态数据）。spec 通过 `resetAtomCatalogCacheForTest()` 显式重置
 * 缓存避免跨用例污染。
 */
let cachedEntries: readonly AtomCatalogEntry[] | null = null
const cachedPrompt: Partial<Record<'zh' | 'en', string>> = {}

export function getRegisteredAtomKeys(): readonly AtomContractKey[] {
  return getAllRegisteredAtomKeys()
}

export function getPhaseEnum(): typeof PHASE_ENUM {
  return PHASE_ENUM
}

export function buildAtomCatalogEntries(): readonly AtomCatalogEntry[] {
  if (cachedEntries) return cachedEntries

  const entries = getAllRegisteredAtomKeys().map((key): AtomCatalogEntry => {
    const atom = ATOM_CONTRACT_REGISTRY[key]
    const bucket = atom.bucket
    const surface = atom.surface
    const phaseResolver = surface.phaseResolver
    // M5 修复：查表 + 显式类型 narrowing；非字符串字面量（如 { kind: 'fn', fn }）落入
    // undefined 分支是有意行为（LLM 自由派生 phase）；非 fixed-* 字符串字面量同样如此。
    const fixedPhase: PromptPhase | undefined = typeof phaseResolver === 'string'
      ? FIXED_PHASE_MAP[phaseResolver]
      : undefined

    const paramFields: AtomCatalogParamField[] = Object.entries(surface.paramSlots).map(([name, slot]) => {
      const field: AtomCatalogParamField = {
        name,
        required: slot.required,
        kind: slot.kind,
        ...(slot.enum && slot.enum.length > 0 ? { enum: slot.enum } : {}),
        ...(slot.default !== undefined ? { note: `default=${JSON.stringify(slot.default)}` } : {}),
      }
      return field
    })

    const example = atom.corpus.goldenUtterances[0]

    return {
      key,
      bucket,
      ...(fixedPhase ? { fixedPhase } : {}),
      paramFields,
      ...(example ? { example } : {}),
    }
  })

  cachedEntries = entries
  return entries
}

const BUCKET_ORDER: readonly AtomContractBucket[] = ['trigger', 'action', 'risk', 'positionConstraint', 'orchestration']

const BUCKET_LABEL: Record<AtomContractBucket, { zh: string, en: string }> = {
  trigger: { zh: '触发原子（triggers[].key 候选）', en: 'Trigger atoms (triggers[].key)' },
  action: { zh: '动作原子（actions[].key 候选）', en: 'Action atoms (actions[].key)' },
  risk: { zh: '风险原子（risk[].key 候选）', en: 'Risk atoms (risk[].key)' },
  positionConstraint: { zh: '仓位约束（position 桶 / positionConstraints）', en: 'Position constraint atoms' },
  orchestration: { zh: '编排/守门原子（orchestration 桶；含 gate / portfolioRisk / scope / program）', en: 'Orchestration atoms (gate / portfolioRisk / scope / program)' },
}

function formatParamField(field: AtomCatalogParamField): string {
  const parts: string[] = [field.required ? 'req' : 'opt', field.kind]
  if (field.enum && field.enum.length > 0) {
    const enumPreview = field.enum.length > 4
      ? `${field.enum.slice(0, 4).join('|')}|... (${field.enum.length} total)`
      : field.enum.join('|')
    parts.push(`enum:${enumPreview}`)
  }
  if (field.note) parts.push(field.note)
  return `${field.name}(${parts.join(',')})`
}

function formatEntry(entry: AtomCatalogEntry): string {
  const phaseHint = entry.fixedPhase ? ` phase=${entry.fixedPhase}` : ''
  // #1395：从 ATOM_CONTRACT_REGISTRY 取 roles（predicate / effect），并行 PR 落地后才有；
  // 防御性读取：字段缺失或非数组 → 不渲染 roles 段，避免在并行 merge 期 prompt 崩塌。
  const contract = ATOM_CONTRACT_REGISTRY[entry.key] as { roles?: readonly string[] } | undefined
  const roles = contract && Array.isArray(contract.roles) && contract.roles.length > 0
    ? ` roles=[${contract.roles.join(',')}]`
    : ''
  const params = entry.paramFields.length === 0
    ? 'params: {}'
    : `params: { ${entry.paramFields.map(formatParamField).join(', ')} }`
  const example = entry.example ? `\n      例："${entry.example}"` : ''
  return `  - ${entry.key}${phaseHint}${roles}\n      ${params}${example}`
}

export function formatAtomCatalogForPrompt(locale: 'zh' | 'en' = 'zh'): string {
  const cached = cachedPrompt[locale]
  if (cached !== undefined) return cached

  const entries = buildAtomCatalogEntries()
  const grouped = new Map<AtomContractBucket, AtomCatalogEntry[]>()
  for (const entry of entries) {
    const list = grouped.get(entry.bucket) ?? []
    list.push(entry)
    grouped.set(entry.bucket, list)
  }

  const sections: string[] = []
  for (const bucket of BUCKET_ORDER) {
    const list = grouped.get(bucket) ?? []
    if (list.length === 0) continue
    const label = BUCKET_LABEL[bucket][locale]
    sections.push(`${label}（${list.length}）：`)
    for (const entry of list) sections.push(formatEntry(entry))
    sections.push('')
  }

  const formatted = sections.join('\n').trimEnd()
  cachedPrompt[locale] = formatted
  return formatted
}

/** 测试辅助：清除模块级 memoize（仅 spec 使用） */
export function resetAtomCatalogCacheForTest(): void {
  cachedEntries = null
  delete cachedPrompt.zh
  delete cachedPrompt.en
}
