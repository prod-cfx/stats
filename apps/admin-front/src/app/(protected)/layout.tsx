
'use client'

import type { MenuProps } from 'antd'
import { Avatar, Dropdown, Layout, Menu, Result, Spin } from 'antd'
import { usePathname, useRouter } from 'next/navigation'

import { useEffect, useMemo } from 'react'
import { useAuth } from '@/components/providers/auth-provider'

const NAV_ITEMS = [
  { key: '/dashboard', label: '面板', path: '/dashboard', permission: 'dashboard' },
  { key: '/roles', label: '角色管理', path: '/roles', permission: 'system.roles' },
  { key: '/menus', label: '菜单管理', path: '/menus', permission: 'system.menus' },
  { key: '/users', label: '管理员', path: '/users', permission: 'system.admins' },
  // 入口默认显示；实际数据权限由后端 RBAC 控制（无权限会被接口拦截）
  { key: '/data-pull-tasks', label: '数据拉取任务', path: '/data-pull-tasks' },
]

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { session, initializing, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const menuPermissions = useMemo(
    () => session?.admin?.menuPermissions ?? [],
    [session],
  )
  const username = session?.admin?.username ?? '-'
  const avatarInitial = username ? username.slice(0, 1).toUpperCase() : '-'

  const accessibleNavItems = useMemo(
    () => NAV_ITEMS.filter(item => !item.permission || menuPermissions.includes(item.permission)),
    [menuPermissions],
  )

  const selectedKeys = useMemo(() => {
    const current = accessibleNavItems.find(item => pathname?.startsWith(item.path))
    return current ? [current.key] : []
  }, [accessibleNavItems, pathname])

  const canAccessCurrent = useMemo(() => {
    if (!pathname) return true
    return accessibleNavItems.some(item => pathname.startsWith(item.path))
  }, [accessibleNavItems, pathname])

  useEffect(() => {
    // 方便验证当前浏览器拿到的 session 结构
    console.log('[ProtectedLayout] session snapshot', session)
    console.log('[ProtectedLayout] username', session?.admin?.username)
    console.log('[ProtectedLayout] menu permissions', session?.admin?.menuPermissions)

    if (!initializing && !session) {
      router.replace('/login')
    }
  }, [initializing, session, router])

  useEffect(() => {
    if (!initializing && session && accessibleNavItems.length && !canAccessCurrent) {
      router.replace(accessibleNavItems[0].path)
    }
  }, [accessibleNavItems, canAccessCurrent, initializing, router, session])

  const dropdownMenu: MenuProps = {
    items: [
      {
        key: 'username',
        label: `当前账号：${session?.admin?.username ?? '-'}`,
        disabled: true,
      },
      { type: 'divider' },
      { key: 'logout', label: '退出登录' },
    ],
    onClick: ({ key }) => {
      if (key === 'logout') {
        logout()
      }
    },
  }

  if (initializing || (!session && typeof window !== 'undefined')) {
    return (
      <div className="center-container">
        <Spin size="large" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <Layout className="app-shell">
      <Layout.Sider breakpoint="lg" collapsedWidth="0" className="app-sider">
        <div className="app-logo">Admin Scaffold</div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={selectedKeys}
          items={accessibleNavItems.map(item => ({
            key: item.key,
            label: item.label,
            onClick: () => router.push(item.path),
          }))}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="app-header">
          <Dropdown menu={dropdownMenu} placement="bottomRight" trigger={['click']}>
            <div className="user-avatar">
              <Avatar size="small">{avatarInitial}</Avatar>
              <span>{username}</span>
            </div>
          </Dropdown>
        </Layout.Header>
        <Layout.Content className="app-content">
          {accessibleNavItems.length === 0 ? (
            <Result status="403" title="暂无菜单权限" subTitle="请联系管理员为该账号分配菜单权限。" />
          ) : canAccessCurrent ? (
            children
          ) : (
            <Result status="403" title="无访问权限" subTitle="您没有访问该页面的权限，已自动限制。" />
          )}
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
