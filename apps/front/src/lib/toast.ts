/**
 * Simple toast notification utility
 * Creates temporary toast notifications without requiring a Provider
 */

interface ToastOptions {
  title: string
  description?: string
  duration?: number
}

type ToastType = 'success' | 'error' | 'warning' | 'info'

function createToastElement(type: ToastType, options: ToastOptions): HTMLDivElement {
  const toast = document.createElement('div')
  
  const typeStyles = {
    success: { icon: 'bg-emerald-500/10 text-emerald-500', accent: 'bg-emerald-500' },
    error: { icon: 'bg-red-500/10 text-red-500', accent: 'bg-red-500' },
    warning: { icon: 'bg-amber-500/10 text-amber-500', accent: 'bg-amber-500' },
    info: { icon: 'bg-primary/10 text-primary', accent: 'bg-primary' },
  }

  const iconPaths = {
    success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  }

  toast.className = 'pointer-events-auto relative overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3.5 py-3 text-[color:var(--cf-text)] shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200 dark:shadow-black/30'
  toast.setAttribute('role', 'status')

  const accent = document.createElement('div')
  accent.className = `absolute inset-y-2 left-0 w-0.5 rounded-full ${typeStyles[type].accent}`

  const row = document.createElement('div')
  row.className = 'flex items-start gap-2.5'

  const iconWrap = document.createElement('span')
  iconWrap.className = `mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${typeStyles[type].icon}`

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  icon.setAttribute('class', 'h-4 w-4')
  icon.setAttribute('fill', 'none')
  icon.setAttribute('stroke', 'currentColor')
  icon.setAttribute('viewBox', '0 0 24 24')

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('d', iconPaths[type])
  icon.appendChild(path)
  iconWrap.appendChild(icon)

  const content = document.createElement('div')
  content.className = 'min-w-0 flex-1'

  const title = document.createElement('p')
  title.className = 'truncate text-sm font-semibold text-[color:var(--cf-text-strong)]'
  title.textContent = options.title
  content.appendChild(title)

  if (options.description) {
    const description = document.createElement('p')
    description.className = 'mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--cf-muted)]'
    description.textContent = options.description
    content.appendChild(description)
  }

  const close = document.createElement('button')
  close.type = 'button'
  close.className = '-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[color:var(--cf-muted)] transition hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)] toast-close'
  close.setAttribute('aria-label', 'Dismiss notification')

  const closeIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  closeIcon.setAttribute('class', 'h-4 w-4')
  closeIcon.setAttribute('fill', 'none')
  closeIcon.setAttribute('stroke', 'currentColor')
  closeIcon.setAttribute('viewBox', '0 0 24 24')

  const closePath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  closePath.setAttribute('stroke-linecap', 'round')
  closePath.setAttribute('stroke-linejoin', 'round')
  closePath.setAttribute('stroke-width', '2')
  closePath.setAttribute('d', 'M6 18L18 6M6 6l12 12')
  closeIcon.appendChild(closePath)
  close.appendChild(closeIcon)

  row.append(iconWrap, content, close)
  toast.append(accent, row)

  return toast
}

function showToast(type: ToastType, options: ToastOptions) {
  // Get or create container
  let container = document.getElementById('toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-container'
    container.className = 'pointer-events-none fixed right-4 top-5 z-[9999] flex w-[calc(100vw-2rem)] max-w-[360px] flex-col gap-2 sm:right-6'
    document.body.appendChild(container)
  }

  const toast = createToastElement(type, options)
  toast.style.pointerEvents = 'auto'
  container.appendChild(toast)

  // Close button handler
  const closeBtn = toast.querySelector('.toast-close')
  const removeToast = () => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(-8px)'
    setTimeout(() => {
      toast.remove()
      if (container && container.children.length === 0) {
        container.remove()
      }
    }, 200)
  }

  closeBtn?.addEventListener('click', removeToast)

  // Auto remove
  const duration = options.duration ?? 3000
  if (duration > 0) {
    setTimeout(removeToast, duration)
  }
}

export const toast = {
  success: (options: ToastOptions) => showToast('success', options),
  error: (options: ToastOptions) => showToast('error', options),
  warning: (options: ToastOptions) => showToast('warning', options),
  info: (options: ToastOptions) => showToast('info', options),
}
