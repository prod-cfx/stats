
'use client'

import type { ColumnsType } from 'antd/es/table'
import type { AdminRole, AdminUser } from '@/lib/api'
import { App, Button, Card, Form, Input, Modal, Select, Switch, Table, Tag } from 'antd'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createAdminUser,
  fetchAdminRoles,
  fetchAdminUsers,
  updateAdminUser,
} from '@/lib/api'

interface UserFormValues {
  username: string
  email?: string
  nickName?: string
  password?: string
  roleIds?: string[]
  isFrozen?: boolean
}

export default function AdminUsersPage() {
  const { message } = App.useApp()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null)
  const [form] = Form.useForm<UserFormValues>()

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAdminUsers()
      setUsers(data)
    } catch (error: any) {
      message.error(error?.message ?? '获取管理员失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  const fetchRoles = useCallback(async () => {
    try {
      const data = await fetchAdminRoles()
      setRoles(data)
    } catch (error: any) {
      message.error(error?.message ?? '获取角色失败')
    }
  }, [message])

  useEffect(() => {
    void fetchRoles()
    void fetchUsers()
  }, [fetchRoles, fetchUsers])

  const openCreateModal = useCallback(() => {
    setCurrentUser(null)
    form.resetFields()
    form.setFieldsValue({ isFrozen: false })
    setModalVisible(true)
  }, [form])

  const openEditModal = useCallback((user: AdminUser) => {
    setCurrentUser(user)
    form.setFieldsValue({
      username: user.username,
      email: user.email ?? undefined,
      nickName: user.nickName ?? undefined,
      roleIds: user.roles.map(role => role.id),
      isFrozen: user.isFrozen,
    })
    setModalVisible(true)
  }, [form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (currentUser) {
        await updateAdminUser(currentUser.id, {
          email: values.email ?? undefined,
          nickName: values.nickName ?? undefined,
          roleIds: values.roleIds ?? [],
          isFrozen: values.isFrozen ?? false,
        })
        message.success('管理员已更新')
      } else {
        await createAdminUser({
          username: values.username,
          password: values.password!,
          email: values.email ?? undefined,
          nickName: values.nickName ?? undefined,
          roleIds: values.roleIds ?? [],
        })
        message.success('管理员已创建')
      }
      setModalVisible(false)
      fetchUsers()
    } catch (error: any) {
      if (error?.message) {
        message.error(error.message)
      }
    }
  }

  const columns: ColumnsType<AdminUser> = useMemo(
    () => [
      { title: '用户名', dataIndex: 'username' },
      { title: '邮箱', dataIndex: 'email', render: value => value || '—' },
      {
        title: '角色',
        render: (_, record) =>
          record.roles?.length ? record.roles.map(role => role.name).join(' / ') : '—',
      },
      {
        title: '状态',
        dataIndex: 'isFrozen',
        render: value => (value ? <Tag color="red">已冻结</Tag> : <Tag color="green">正常</Tag>),
      },
      {
        title: '操作',
        render: (_, record) => (
          <Button type="link" onClick={() => openEditModal(record)}>
            编辑
          </Button>
        ),
      },
    ],
    [openEditModal],
  )

  return (
    <div className="page-container">
      <Card
        title="管理员管理"
        className="dashboard-card"
        extra={
          <Button type="primary" onClick={openCreateModal}>
            新建管理员
          </Button>
        }
      >
        <Table<AdminUser>
          rowKey="id"
          columns={columns}
          dataSource={users}
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={currentUser ? '编辑管理员' : '新建管理员'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
      >
        <Form layout="vertical" form={form}>
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}> 
            <Input placeholder="admin" disabled={!!currentUser} />
          </Form.Item>

          {!currentUser && (
            <Form.Item label="密码" name="password" rules={[{ required: true, min: 6, message: '请输入至少 6 位密码' }]}> 
              <Input.Password placeholder="••••••" />
            </Form.Item>
          )}

          <Form.Item label="邮箱" name="email" rules={[{ type: 'email', message: '邮箱格式不正确' }]}> 
            <Input placeholder="admin@example.com" />
          </Form.Item>

          <Form.Item label="昵称" name="nickName"> 
            <Input placeholder="管理员昵称" />
          </Form.Item>

          <Form.Item label="绑定角色" name="roleIds"> 
            <Select
              mode="multiple"
              placeholder="请选择角色"
              options={roles.map(role => ({ label: role.name, value: role.id }))}
            />
          </Form.Item>

          <Form.Item label="是否冻结" name="isFrozen" valuePropName="checked"> 
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
