/**
 * INVARIANT: action atom resolve 契约 — Issue #1334 PR4
 *
 * 守门三条：
 *   1. bare-key 动作标签（open_long / close_long 等）必须能从 SemanticAtomRegistryService
 *      resolve 出 supported_executable，category='action'。
 *      （SemanticState.actions[].key 历史值是这些裸标签，dispatcher 层必须能消费。）
 *
 *   2. dotted-prefix 版本（action.open_long 等）在 ATOM_CONTRACT_REGISTRY 中注册，
 *      resolve 必须返回 supported_executable。
 *
 *   3. list() 必须包含 action.open_long / action.close_long /
 *      action.open_short / action.close_short 这四个 dotted 键。
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

  // ── AC2: dotted-prefix → supported_executable ─────────────────────────────
  const DOTTED_ACTION_KEYS = [
    'action.open_long',
    'action.close_long',
    'action.open_short',
    'action.close_short',
  ] as const

  describe('dotted action keys resolve as supported_executable', () => {
    for (const key of DOTTED_ACTION_KEYS) {
      it(`${key}: resolve → supported_executable`, () => {
        const atom = service.resolve(key)
        expect(atom.supportStatus).toBe('supported_executable')
      })
    }
  })

  // ── AC3: list() 包含 dotted 动作键 ─────────────────────────────────────────
  it('list() contains dotted action keys', () => {
    const listedKeys = new Set(service.list().map(a => a.key))
    for (const key of DOTTED_ACTION_KEYS) {
      expect(listedKeys.has(key)).toBe(true)
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
