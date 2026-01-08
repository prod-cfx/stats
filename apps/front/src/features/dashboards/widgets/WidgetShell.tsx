import React from 'react'

export function WidgetShell(props: {
  title: string
  description?: string
  onRemove?: () => void
  children: React.ReactNode
  contentStyle?: React.CSSProperties
}) {
  return (
    <div className="h-full w-full rounded-xl border border-white/10 bg-white/5 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <div className="min-w-0 react-draggable-handle cursor-move select-none">
          <div className="text-sm font-semibold text-white truncate">{props.title}</div>
          {props.description ? <div className="text-xs text-white/50 truncate">{props.description}</div> : null}
        </div>
        {props.onRemove ? (
          <button
            className="text-xs text-white/60 hover:text-white"
            onClick={props.onRemove}
            aria-label="remove-widget"
          >
            删除
          </button>
        ) : null}
      </div>
      <div className="p-4 flex-1 min-h-0 overflow-hidden relative" style={props.contentStyle}>{props.children}</div>
    </div>
  )
}

