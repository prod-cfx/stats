
'use client'

import type { AdminAuthResponse } from '@/types/api'
import { App, Button, Card, Checkbox, Form, Input, Typography } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useEffect, useMemo, useState } from 'react'
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
    <div className="center-container">
      <Card title="管理员登录" className="auth-card">
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
        <Typography.Paragraph style={{ textAlign: 'center' }}>
          还没有管理员账号？ <Link href="/register">创建一个</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  )
}
