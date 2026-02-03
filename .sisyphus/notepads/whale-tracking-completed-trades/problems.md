## 2026-02-03 - LSP diagnostics stuck on TS2786

- 现象：`lsp_diagnostics` 持续报告 `ProfileDataTabs.tsx` 存在 lucide-react 的 TS2786（"cannot be used as a JSX component"），且报错路径引用已不存在/不匹配的 `@types/react@18.3.27`。
- 已尝试：
  - 将 lucide 图标 JSX 改为 `React.createElement`
  - 动态 import/require
  - 最终彻底移除 lucide-react（改为内联 SVG）
- 结果：`dx build front --dev`、`tsc` 均通过，且 `ProfileDataTabs.tsx`/`CompletedTradesTable.tsx` 的 LSP 诊断为 clean；但对历史报错行号/符号的 TS2786 仍会偶发出现，疑似工具缓存/Program 解析问题。
- 结论：若后续再出现同类“旧行号/旧路径”诊断，优先视为 LSP 缓存/工具问题；以 `dx build front --dev` 为准。
