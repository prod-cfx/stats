
'use client'

import type { AdminAuthResponse } from '@/types/api'
import { App, Button, Card, Form, Input, Typography } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useEffect } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { registerAdmin } from '@/lib/api'

export default function RegisterPage() {
  const { message } = App.useApp()
  const { login, session } = useAuth()
  const router = useRouter()
  const [form] = Form.useForm<{ username: string; password: string; email?: string }>()

  useEffect(() => {
    if (session) {
      router.replace('/dashboard')
    }
  }, [session, router])

  const handleFinish = async (values: { username: string; password: string; email?: string }) => {
    try {
      const data: AdminAuthResponse = await registerAdmin(values)
      login({ accessToken: data.accessToken, admin: data.admin })
      message.success('注册成功，已自动登录')
      router.push('/dashboard')
    } catch (error: any) {
      message.error(error?.message ?? '注册失败')
    }
  }

  return (
    <div className="center-container">
      <Card title="创建管理员" className="auth-card">
        <Form layout="vertical" form={form} onFinish={handleFinish}>
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}> 
            <Input placeholder="admin" autoComplete="username" />
          </Form.Item>
          <Form.Item label="邮箱" name="email" rules={[{ type: 'email', message: '邮箱格式不正确' }]}> 
            <Input placeholder="admin@example.com" autoComplete="email" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, min: 6, message: '至少 6 位密码' }]}> 
            <Input.Password placeholder="••••••" autoComplete="new-password" />
          </Form.Item>
          <Form.Item>
            <Button block type="primary" htmlType="submit">
              注册并登录
            </Button>
          </Form.Item>
        </Form>
        <Typography.Paragraph style={{ textAlign: 'center' }}>
          已有账号？ <Link href="/login">去登录</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  )
}
