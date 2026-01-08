import type { Metadata } from 'next'
import { AntdProvider } from '@/components/providers/antd-provider'
import { AuthProvider } from '@/components/providers/auth-provider'

import 'antd/dist/reset.css'
import './globals.css'

// Next.js App Router layout 必须导出 metadata，会触发 react-refresh 的误报告警；在此文件禁用该规则。
// eslint-disable-next-line react-refresh/only-export-components
export const metadata: Metadata = {
  title: 'Admin 控制台',
  description: '轻量级管理后台脚手架',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdProvider>
          <AuthProvider>{children}</AuthProvider>
        </AntdProvider>
      </body>
    </html>
  )
}
