import React from 'react'

export function WidgetShell(props: {
  title: string
  description?: string
  onRemove?: () => void
  children: React.ReactNode
  contentStyle?: React.CSSProperties
}) {
  return (
    <div className="h-full w-full rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[color:var(--cf-border)] flex-shrink-0">
        <div className="min-w-0 react-draggable-handle cursor-move select-none">
          <div className="text-xs font-bold text-[color:var(--cf-text-strong)] truncate">{props.title}</div>
          {props.description ? <div className="text-[10px] text-[color:var(--cf-muted)] truncate">{props.description}</div> : null}
        </div>
        {props.onRemove ? (
          <button
            type="button"
            className="text-[10px] text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] react-draggable-cancel"
            onClick={props.onRemove}
            aria-label="remove-widget"
          >
            删除
          </button>
        ) : null}
      </div>
      {/* 硬性限制内容高度，防止内部组件撑高 */}
      <div className="p-2 flex-1 min-h-0 overflow-hidden relative flex flex-col react-draggable-cancel" style={props.contentStyle}>
        <div className="flex-1 min-h-0 overflow-hidden react-draggable-cancel">{props.children}</div>
      </div>
    </div>
  )
}
