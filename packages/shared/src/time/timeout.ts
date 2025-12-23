export interface TimeoutGuard {
  promise: Promise<never>
  cancel: () => void
}

export function timeoutGuard(ms: number, message = 'Operation timeout'): TimeoutGuard {
  let timer: ReturnType<typeof setTimeout> | undefined
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message))
    }, ms)
  })
  const cancel = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }
  return { promise, cancel }
}

export async function withTimeout<T>(
  task: () => Promise<T>,
  ms: number,
  message?: string,
): Promise<T> {
  const guard = timeoutGuard(ms, message)
  try {
    const result = await Promise.race([task(), guard.promise])
    return result as T
  } finally {
    guard.cancel()
  }
}
