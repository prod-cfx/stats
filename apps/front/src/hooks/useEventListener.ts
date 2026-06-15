import { useEffect, useRef } from 'react'

type EventTargetLike = Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | null | undefined

interface UseEventListener {
  <K extends keyof WindowEventMap>(
    target: Window | null | undefined,
    type: K,
    listener: (event: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void
  <K extends keyof DocumentEventMap>(
    target: Document | null | undefined,
    type: K,
    listener: (event: DocumentEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void
  <K extends keyof HTMLElementEventMap>(
    target: HTMLElement | null | undefined,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void
  (
    target: EventTargetLike,
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ): void
}

export const useEventListener = ((
  target: EventTargetLike,
  type: string,
  listener: EventListener,
  options?: boolean | AddEventListenerOptions,
) => {
  const listenerRef = useRef(listener)

  useEffect(() => {
    listenerRef.current = listener
  }, [listener])

  useEffect(() => {
    if (!target) return

    const wrapped: EventListener = event => listenerRef.current(event)
    target.addEventListener(type, wrapped, options)

    return () => target.removeEventListener(type, wrapped, options)
  }, [target, type, options])
}) as UseEventListener
