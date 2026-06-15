export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to legacy copy for denied permissions or transient Clipboard API failures.
    }
  }

  if (typeof document === 'undefined') return false

  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    el.style.top = '0'
    document.body.appendChild(el)
    try {
      el.select()
      return document.execCommand('copy')
    } finally {
      el.remove()
    }
  } catch {
    return false
  }
}
