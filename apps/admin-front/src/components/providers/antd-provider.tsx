
'use client'

import { App, ConfigProvider } from 'antd'

import '@ant-design/v5-patch-for-react-19'

export function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#1677ff' } }}>
      <App>{children}</App>
    </ConfigProvider>
  )
}
