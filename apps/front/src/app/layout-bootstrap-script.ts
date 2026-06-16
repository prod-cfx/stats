export const ROOT_LAYOUT_BOOTSTRAP_SCRIPT = `
  // Theme init: apply before paint to avoid flicker
  ;(() => {
    try {
      const key = 'cf-theme'
      const stored = localStorage.getItem(key)
      const theme = stored === 'light' || stored === 'dark' ? stored : 'dark'
      document.documentElement.dataset.theme = theme
      document.documentElement.classList.toggle('dark', theme === 'dark')
      document.documentElement.style.colorScheme = theme
    } catch {}
  })()

  // Ignore extension-injected ethereum redefinition errors
  window.addEventListener('error', (event) => {
    if (event.message && (
      event.message.includes('Cannot redefine property: ethereum') ||
      event.message.includes('inpage.js')
    )) {
      event.stopImmediatePropagation();
    }
  }, true);
`
