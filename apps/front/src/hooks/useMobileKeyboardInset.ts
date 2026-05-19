import type { CSSProperties, FocusEventHandler } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface UseMobileKeyboardInsetOptions {
  enabled?: boolean
  blurResetDelayMs?: number
}

interface MobileKeyboardInsetResult {
  isKeyboardOpen: boolean
  keyboardInset: number
  onBlur: FocusEventHandler<HTMLElement>
  onFocus: FocusEventHandler<HTMLElement>
  style: CSSProperties
}

const DEFAULT_BLUR_RESET_DELAY_MS = 120

function readKeyboardInset(): number {
  if (typeof window === 'undefined') return 0
  const viewport = window.visualViewport
  if (!viewport) return 0
  const inset = window.innerHeight - (viewport.height + viewport.offsetTop)
  return Math.max(0, Math.ceil(inset))
}

export function useMobileKeyboardInset({
  enabled = true,
  blurResetDelayMs = DEFAULT_BLUR_RESET_DELAY_MS,
}: UseMobileKeyboardInsetOptions = {}): MobileKeyboardInsetResult {
  const [focused, setFocused] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const resetTimerRef = useRef<number | null>(null)
  const focusedRef = useRef(false)

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current === null) return
    window.clearTimeout(resetTimerRef.current)
    resetTimerRef.current = null
  }, [])

  const syncKeyboardInset = useCallback(() => {
    if (!enabled || !focusedRef.current) {
      setKeyboardInset(0)
      return
    }
    setKeyboardInset(readKeyboardInset())
  }, [enabled])

  const onFocus = useCallback<FocusEventHandler<HTMLElement>>(() => {
    if (!enabled) return
    clearResetTimer()
    focusedRef.current = true
    setFocused(true)
    setKeyboardInset(readKeyboardInset())
  }, [clearResetTimer, enabled])

  const onBlur = useCallback<FocusEventHandler<HTMLElement>>((event) => {
    if (!enabled) return
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
    clearResetTimer()
    focusedRef.current = false
    resetTimerRef.current = window.setTimeout(() => {
      setFocused(false)
      setKeyboardInset(0)
      resetTimerRef.current = null
    }, blurResetDelayMs)
  }, [blurResetDelayMs, clearResetTimer, enabled])

  useEffect(() => {
    if (!enabled) {
      focusedRef.current = false
      setFocused(false)
      setKeyboardInset(0)
      return
    }

    const viewport = window.visualViewport
    const handleViewportChange = () => syncKeyboardInset()

    viewport?.addEventListener('resize', handleViewportChange)
    viewport?.addEventListener('scroll', handleViewportChange)
    window.addEventListener('resize', handleViewportChange)

    return () => {
      viewport?.removeEventListener('resize', handleViewportChange)
      viewport?.removeEventListener('scroll', handleViewportChange)
      window.removeEventListener('resize', handleViewportChange)
      clearResetTimer()
    }
  }, [clearResetTimer, enabled, syncKeyboardInset])

  const style = useMemo(
    () => ({ '--mobile-keyboard-inset': `${keyboardInset}px` }) as CSSProperties,
    [keyboardInset],
  )

  return {
    isKeyboardOpen: focused && keyboardInset > 0,
    keyboardInset,
    onBlur,
    onFocus,
    style,
  }
}
