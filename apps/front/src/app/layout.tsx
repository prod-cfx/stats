import type { ReactNode } from 'react';

// 根 layout 只是一个占位符，实际的 <html> 和 <body> 在 [lng]/layout.tsx 中
// Next.js 要求必须有一个根 layout.tsx，但实际渲染由嵌套 layout 处理
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
