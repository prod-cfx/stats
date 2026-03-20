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
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    info: 'bg-primary/10 border-primary/30 text-primary',
  }

  const iconPaths = {
    success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  }

  toast.className = `
    min-w-[320px] max-w-md
    rounded-lg border backdrop-blur-sm
    px-4 py-3
    shadow-lg
    animate-in slide-in-from-top-2 fade-in duration-200
    ${typeStyles[type]}
  `.trim().replace(/\s+/g, ' ')

  toast.innerHTML = `
    <div class="flex items-start gap-3">
      <svg class="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPaths[type]}" />
      </svg>
      <div class="flex-1">
        <p class="text-sm font-medium">${options.title}</p>
        ${options.description ? `<p class="mt-1 text-xs opacity-90">${options.description}</p>` : ''}
      </div>
      <button type="button" class="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity toast-close">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  `

  return toast
}

function showToast(type: ToastType, options: ToastOptions) {
  // Get or create container
  let container = document.getElementById('toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-container'
    container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none'
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
