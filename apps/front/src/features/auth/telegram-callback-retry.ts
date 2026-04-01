export function isRetryableTelegramDesktopError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const match = /^HTTP_(\d{3})$/i.exec(error.message.trim())
  if (!match) {
    return false
  }

  const status = Number(match[1])
  return status === 408 || status === 425 || status === 429 || status >= 500
}
