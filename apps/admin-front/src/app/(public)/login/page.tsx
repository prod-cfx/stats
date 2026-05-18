
'use client'

import type { AdminAuthResponse } from '@/types/api'
import { CloseOutlined } from '@ant-design/icons'
import { App, Button, Checkbox, Form, Input, Typography } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { loginAdmin } from '@/lib/api'

const REMEMBER_KEY = 'admin.login.remember'
const USERNAME_KEY = 'admin.login.username'
const PASSWORD_KEY = 'admin.login.password'

export default function LoginPage() {
  const { message } = App.useApp()
  const [form] = Form.useForm<{ username: string; password: string }>()
  const router = useRouter()
  const { login, session } = useAuth()
  const entryButtonRef = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null)
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const initialCredentials = useMemo(() => {
    if (typeof window === 'undefined') {
      return { remember: false, username: '', password: '' }
    }
    const savedRemember = window.localStorage.getItem(REMEMBER_KEY) === 'true'
    const savedUsername = window.localStorage.getItem(USERNAME_KEY) || ''
    const savedPassword = window.localStorage.getItem(PASSWORD_KEY) || ''
    const defaultUsername = savedUsername || (process.env.NODE_ENV === 'production' ? '' : 'admin')
    const defaultPassword = savedPassword || (process.env.NODE_ENV === 'production' ? '' : 'admin123')
    return { remember: savedRemember, username: defaultUsername, password: defaultPassword }
  }, [])
  const [remember, setRemember] = useState(initialCredentials.remember)
  const [sheetOpen, setSheetOpen] = useState(false)

  const closeSheet = useCallback(() => {
    setSheetOpen(false)
    entryButtonRef.current?.focus()
  }, [])

  const handleSheetKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return

    const focusableElements = Array.from(
      sheetRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true')

    if (focusableElements.length === 0) {
      event.preventDefault()
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
      return
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }, [])

  useEffect(() => {
    if (session) {
      router.replace('/dashboard')
    }
  }, [session, router])

  useEffect(() => {
    form.setFieldsValue({
      username: initialCredentials.username,
      password: initialCredentials.password,
    })
  }, [form, initialCredentials])

  useEffect(() => {
    if (!sheetOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSheet()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    sheetRef.current
      ?.querySelector<HTMLInputElement>('input[name="username"], input#username, input[autocomplete="username"]')
      ?.focus()

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeSheet, sheetOpen])

  const openSheet = () => {
    setSheetOpen(true)
  }

  const handleFinish = async (values: { username: string; password: string }) => {
    try {
      const data: AdminAuthResponse = await loginAdmin(values)
      login({ accessToken: data.accessToken, admin: data.admin })
      if (typeof window !== 'undefined') {
        if (remember) {
          window.localStorage.setItem(USERNAME_KEY, values.username)
          window.localStorage.setItem(PASSWORD_KEY, values.password)
        } else {
          window.localStorage.removeItem(USERNAME_KEY)
          window.localStorage.removeItem(PASSWORD_KEY)
        }
        window.localStorage.setItem(REMEMBER_KEY, String(remember))
      }
      message.success('登录成功')
      router.push('/dashboard')
    } catch (error: any) {
      message.error(error?.message ?? '登录失败')
    }
  }

  return (
    <div className="login-screen">
      <main className="login-entry" aria-labelledby="login-entry-title">
        <div className="login-entry-content">
          <Typography.Title id="login-entry-title" level={1} className="login-entry-title">
            Admin 控制台
          </Typography.Title>
          <Button
            ref={entryButtonRef}
            type="primary"
            size="large"
            data-testid="login-sheet-entry"
            className="login-entry-button"
            onClick={openSheet}
          >
            管理员登录
          </Button>
          <Typography.Paragraph className="login-entry-register">
            还没有管理员账号？ <Link href="/register">创建一个</Link>
          </Typography.Paragraph>
        </div>
      </main>

      <div className="login-sheet-layer" aria-labelledby="login-sheet-title" hidden={!sheetOpen}>
        <button
          type="button"
          className="login-sheet-mask"
          aria-label="关闭登录面板"
          onClick={closeSheet}
        />
        <section
          ref={sheetRef}
          role={sheetOpen ? 'dialog' : undefined}
          aria-modal={sheetOpen ? 'true' : undefined}
          aria-labelledby="login-sheet-title"
          className="login-sheet auth-card"
          onKeyDown={handleSheetKeyDown}
        >
          <div className="login-sheet-header">
            <Typography.Title id="login-sheet-title" level={2} className="login-sheet-title">
              管理员登录
            </Typography.Title>
            <Button
              type="text"
              shape="circle"
              aria-label="关闭登录面板"
              className="login-sheet-close"
              icon={<CloseOutlined />}
              onClick={closeSheet}
            />
          </div>
          <Form layout="vertical" form={form} onFinish={handleFinish}>
            <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input placeholder="admin" autoComplete="username" />
            </Form.Item>
            <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password placeholder="••••••" autoComplete="current-password" />
            </Form.Item>
            <Form.Item>
              <Checkbox checked={remember} onChange={event => setRemember(event.target.checked)}>
                记住密码
              </Checkbox>
            </Form.Item>
            <Form.Item>
              <Button block type="primary" htmlType="submit">
                登录
              </Button>
            </Form.Item>
          </Form>
        </section>
      </div>
    </div>
  )
}
