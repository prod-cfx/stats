interface LongShortRatioLike {
  timestamp: string
  longShortRatio: string
}

interface LongShortRatioPaginatedPayload<T> {
  items?: T[]
}

interface WidgetLike<TChart = unknown> {
  activeChart?: () => TChart
  chart?: () => TChart
}

interface StudyLike {
  id: unknown
  name?: string
}

interface StudyChartLike {
  contentWindow?: Window | null
  executeActionById?: (actionId: string) => void
  getAllStudies?: () => StudyLike[]
  removeEntity?: (id: unknown) => void
}

interface HeaderWidgetLike extends WidgetLike<StudyChartLike> {
  _innerWindow?: () => Window | undefined
  _iFrame?: { contentWindow?: Window | null }
  _iframe?: { contentWindow?: Window | null }
}

export function extractLongShortRatioItems<T extends LongShortRatioLike>(
  payload: T[] | LongShortRatioPaginatedPayload<T> | null | undefined,
): T[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.items)) {
    return payload.items
  }

  return []
}

export function getSafeChartFromWidget<TChart>(widget: WidgetLike<TChart> | null | undefined): TChart | null {
  if (!widget) {
    return null
  }

  try {
    const activeChart = widget.activeChart?.()
    if (activeChart) {
      return activeChart
    }
  } catch {
    // Fall through to legacy chart accessor.
  }

  try {
    const chart = widget.chart?.()
    return chart ?? null
  } catch {
    return null
  }
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value
    && typeof (value as { then?: unknown }).then === 'function'
}

export function resolveMaybePromiseId(maybe: unknown, onResolved: (id: string) => void) {
  if (!maybe) return
  if (isThenable(maybe)) {
    void Promise.resolve(maybe)
      .then(id => {
        if (id) onResolved(String(id))
      })
      .catch(() => {
        // ignore promise rejection
      })
    return
  }
  onResolved(String(maybe))
}

export function findAndDedupeStudyByName(chart: StudyChartLike | null | undefined, studyName: string): string | null {
  try {
    const studies = chart?.getAllStudies?.()
    if (!Array.isArray(studies) || studies.length === 0) return null
    const matches = studies.filter(s => s?.name === studyName)
    if (matches.length === 0) return null
    const keep = matches[0]
    for (let i = 1; i < matches.length; i++) {
      const study = matches[i]
      try {
        chart?.removeEntity?.(study.id)
      } catch {
        // ignore
      }
    }
    return keep?.id ? String(keep.id) : null
  } catch {
    return null
  }
}

export function moveButtonsToHeaderRight(widget: HeaderWidgetLike | null | undefined, buttons: HTMLElement[]) {
  try {
    const win =
      (typeof widget?._innerWindow === 'function' ? widget._innerWindow() : undefined) ||
      widget?._iFrame?.contentWindow ||
      widget?._iframe?.contentWindow ||
      widget?.activeChart?.()?.contentWindow
    const doc = win?.document
    if (!doc) return

    const headerRoot =
      doc.querySelector('.header-chart-panel') ||
      doc.querySelector('[class*="header-chart-panel"]') ||
      doc.querySelector('.tradingview-widget-header') ||
      doc.body
    if (!headerRoot) return

    const allButtons = Array.from(headerRoot.querySelectorAll('button'))
      .map(b => ({ b, rect: b.getBoundingClientRect() }))
      .filter(x => x.rect.width > 2 && x.rect.height > 2 && x.rect.top >= 0 && x.rect.top < 150)

    if (allButtons.length === 0) {
      buttons.forEach(btn => headerRoot.appendChild(btn))
      return
    }

    allButtons.sort((a, b) => b.rect.right - a.rect.right)
    const rightmostBtn = allButtons[0].b

    let group: HTMLElement | null = rightmostBtn.closest('div')
    while (group) {
      const cs = win.getComputedStyle(group)
      if (cs.display === 'flex' && group.querySelectorAll('button').length >= 1) break
      group = group.parentElement
    }
    if (!group) group = rightmostBtn.parentElement
    if (!group) return

    const groupButtons = Array.from(group.querySelectorAll('button'))
      .map(b => ({ b, rect: b.getBoundingClientRect() }))
      .filter(x => x.rect.width > 2 && x.rect.height > 2)
    groupButtons.sort((a, b) => b.rect.right - a.rect.right)
    const anchor = groupButtons[0]?.b || null

    buttons.forEach(btn => {
      try {
        if (anchor && anchor.parentElement === group) {
          const next = anchor.nextSibling
          if (next) group.insertBefore(btn, next)
          else group.appendChild(btn)
        } else {
          group.appendChild(btn)
        }
      } catch {
        // ignore
      }
    })
  } catch {
    // ignore
  }
}

export function tryExecuteActionInsertIndicator(widget: WidgetLike<StudyChartLike> | null | undefined) {
  const chart = getSafeChartFromWidget(widget)
  try {
    chart?.executeActionById?.('insertIndicator')
    return
  } catch {
    // ignore
  }
  try {
    widget?.activeChart?.()?.executeActionById?.('insertIndicator')
  } catch {
    // ignore
  }
}
