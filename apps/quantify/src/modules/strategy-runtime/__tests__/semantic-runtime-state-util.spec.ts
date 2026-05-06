import {
  buildSemanticRuntimeState,
  ensureSemanticRuntimeStateKeys,
} from '../semantic-runtime-state.util'

describe('semantic runtime state util', () => {
  const hasOwn = (record: Record<string, unknown>, key: string) =>
    Object.prototype.hasOwnProperty.call(record, key)

  it('creates own default state for prototype-shaped state keys without polluting prototypes', () => {
    const state = buildSemanticRuntimeState(['toString', '__proto__', 'constructor'])

    expect(Object.getPrototypeOf(state)).toBeNull()
    expect(hasOwn(state, 'toString')).toBe(true)
    expect(hasOwn(state, '__proto__')).toBe(true)
    expect(hasOwn(state, 'constructor')).toBe(true)
    expect(Object.getPrototypeOf(state.toString)).toBeNull()
    expect(Object.getPrototypeOf(state.__proto__)).toBeNull()
    expect(Object.getPrototypeOf(state.constructor)).toBeNull()
    expect(Object.getPrototypeOf({})).toBe(Object.prototype)
    expect(Object.prototype.constructor).toBe(Object)
    expect(typeof Object.prototype.toString).toBe('function')
  })

  it('ensures missing dangerous keys using own-property checks on existing state', () => {
    const state = buildSemanticRuntimeState(['breakout'])

    ensureSemanticRuntimeStateKeys(state, ['toString', '__proto__', 'constructor'])

    expect(Object.keys(state).sort()).toEqual(['__proto__', 'breakout', 'constructor', 'toString'])
    expect(hasOwn(state, 'toString')).toBe(true)
    expect(hasOwn(state, '__proto__')).toBe(true)
    expect(hasOwn(state, 'constructor')).toBe(true)
    expect(Object.getPrototypeOf(state.toString)).toBeNull()
    expect(Object.getPrototypeOf(state.__proto__)).toBeNull()
    expect(Object.getPrototypeOf(state.constructor)).toBeNull()
  })
})
