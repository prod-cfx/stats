/**
 * INVARIANT: action atom resolve 契约 — Issue #1334 PR4
 *
 * 守门三条：
 *   1. bare-key 动作标签（open_long / close_long 等）必须能从 SemanticAtomRegistryService
 *      resolve 出 supported_executable，category='action'。
 *      （SemanticState.actions[].key 历史值是这些裸标签，dispatcher 层必须能消费。）
 *
 *   2. dotted-prefix 版本（action.open_long 等）在 ATOM_CONTRACT_REGISTRY 中注册，
 *      但 legacy service 不认识它们，resolve 必须返回 unsupported_unknown。
 *      （避免 REGISTRY fallback 污染 list()，参见 REGISTRY_ONLY_KEYS 注释。）
 *
 *   3. list() 不得包含 action.open_long / action.close_long /
 *      action.open_short / action.close_short 这四个 dotted 键。
 *      （它们属于 REGISTRY_ONLY_KEYS，由 dispatcher 层单独消费。）
 */

import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'

const service = new SemanticAtomRegistryService()

describe('semantic-atom-registry action-atom resolve invariant (Issue #1334 PR4)', () => {
  // ── AC1: bare-key 标签 → supported_executable ──────────────────────────────
  const bareActionKeys = [
    'open_long',
    'close_long',
    'open_short',
    'close_short',
    'close_position',
  ] as const

  describe('bare-key action labels resolve as supported_executable', () => {
    for (const key of bareActionKeys) {
      it(`${key}: resolve → supported_executable, category=action`, () => {
        const atom = service.resolve(key)
        expect(atom.supportStatus).toBe('supported_executable')
        expect(atom.category).toBe('action')
      })
    }
  })

  // ── AC2: dotted-prefix → unsupported_unknown ───────────────────────────────
  const dottedActionKeys = [
    'action.open_long',
    'action.close_long',
    'action.open_short',
    'action.close_short',
  ] as const

  describe('dotted action keys (REGISTRY_ONLY) resolve as unsupported_unknown', () => {
    for (const key of dottedActionKeys) {
      it(`${key}: resolve → unsupported_unknown (not exposed via legacy service)`, () => {
        const atom = service.resolve(key)
        expect(atom.supportStatus).toBe('unsupported_unknown')
      })
    }
  })

  // ── AC3: list() 不含 dotted 动作键 ─────────────────────────────────────────
  it('list() does not contain REGISTRY_ONLY dotted action keys', () => {
    const listedKeys = new Set(service.list().map(a => a.key))
    for (const key of dottedActionKeys) {
      expect(listedKeys.has(key)).toBe(false)
    }
  })

  // ── AC4: list() 包含裸键（作为 supported 动作原子）─────────────────────────
  it('list() includes bare action keys as supported atoms', () => {
    const listedKeys = new Set(service.list().map(a => a.key))
    for (const key of bareActionKeys) {
      expect(listedKeys.has(key)).toBe(true)
    }
  })
})
