
'use client'

import { Button, Card, Space, Typography } from 'antd'
import Link from 'next/link'

import { useAuth } from '@/components/providers/auth-provider'

export default function DashboardPage() {
  const { session, logout } = useAuth()

  return (
    <div className="page-container">
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Card title="概览" className="dashboard-card">
          <Typography.Paragraph>
            当前登录管理员：<strong>{session?.admin?.username ?? '-'}</strong>
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary">
            该面板仅展示管理员/角色/菜单的基础管理示例，可作为后续扩展的脚手架。
          </Typography.Paragraph>
          <Button onClick={logout}>退出登录</Button>
        </Card>
        <Space direction="vertical">
          <Link href="/roles">前往角色管理 →</Link>
          <Link href="/menus">前往菜单管理 →</Link>
          <Link href="/users">前往管理员管理 →</Link>
          <Link href="/data-pull-tasks">前往数据拉取任务 →</Link>
          <Link href="/strategy-templates">前往策略模板管理 →</Link>
          <Link href="/orderbook-configs">前往订单薄配置管理 →</Link>
          <Link href="/exchange-configs">前往交易所配置管理 →</Link>
        </Space>
      </Space>
    </div>
  )
}
