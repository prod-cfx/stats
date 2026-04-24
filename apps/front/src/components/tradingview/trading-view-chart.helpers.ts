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
