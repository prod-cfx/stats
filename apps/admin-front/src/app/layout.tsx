import type { Metadata } from 'next'
import { AntdProvider } from '@/components/providers/AntdProvider'
import { AuthProvider } from '@/components/providers/AuthProvider'

import 'antd/dist/reset.css'
import './globals.css'

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
