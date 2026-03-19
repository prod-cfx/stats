import type { StrategyHelpers } from './helpers.types'
import * as arrayHelpers from './array-helpers'
import * as financeHelpers from './finance-helpers'
import * as signalHelpers from './signal-helpers'
import * as technicalIndicators from './technical-indicators'

const SAFE_HELPER_SYMBOL = Symbol('ai.safeHelper')

type AnyFunction = (...args: any[]) => any
type SafeHelperFunction = AnyFunction & { [SAFE_HELPER_SYMBOL]: true }

function createSafeFunction(fn: AnyFunction): SafeHelperFunction {
  const safeFn: AnyFunction = (...args: any[]) => fn(...args)

  try {
    Object.defineProperty(safeFn, 'length', {
      value: fn.length,
      writable: false,
      enumerable: false,
      configurable: false,
    })
  }
  catch {
    // ignore
  }

  try {
    Object.defineProperty(safeFn, 'name', {
      value: fn.name,
      writable: false,
      enumerable: false,
      configurable: false,
    })
  }
  catch {
    // ignore
  }

  Object.defineProperty(safeFn, SAFE_HELPER_SYMBOL, {
    value: true,
    writable: false,
    enumerable: false,
    configurable: false,
  })

  try {
    Object.defineProperty(safeFn, 'prototype', {
      value: undefined,
      writable: false,
      enumerable: false,
      configurable: false,
    })
  }
  catch {
    // ignore
  }

  try {
    Object.defineProperty(safeFn, 'constructor', {
      value: undefined,
      writable: false,
      enumerable: false,
      configurable: false,
    })
  }
  catch {
    // ignore
  }

  try {
    Object.setPrototypeOf(safeFn, null)
  }
  catch {
    // ignore
  }

  return Object.freeze(safeFn as SafeHelperFunction)
}

function cloneHelperNamespace(source: any): any {
  if (typeof source === 'function') {
    return createSafeFunction(source as AnyFunction)
  }

  if (Array.isArray(source)) {
    return Object.freeze(source.map(item => cloneHelperNamespace(item)))
  }

  if (source && typeof source === 'object') {
    const target = Object.create(null) as Record<string, unknown>
    for (const [key, value] of Object.entries(source)) {
      target[key] = cloneHelperNamespace(value)
    }
    return Object.freeze(target)
  }

  return source
}

const SAFE_HELPERS = Object.freeze(
  cloneHelperNamespace({
    finance: financeHelpers,
    array: arrayHelpers,
    ta: technicalIndicators,
    signal: signalHelpers,
  }),
) as StrategyHelpers

export function getSafeHelpers(): StrategyHelpers {
  return SAFE_HELPERS
}

export function isSafeHelperFunction(value: unknown): value is AnyFunction {
  return typeof value === 'function' && Boolean((value as any)[SAFE_HELPER_SYMBOL])
}
