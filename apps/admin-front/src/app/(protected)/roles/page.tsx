
'use client'

import type {
  AdminRole} from '@/lib/api';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createRole,
  fetchAdminMenus,
  fetchAdminRoles,
  updateRole,
} from '@/lib/api'

interface RoleFormValues {
  code: string
  name: string
  description?: string
  menuPermissions?: string[]
}

export default function RolesPage() {
  const { message } = App.useApp()
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOptions, setMenuOptions] = useState<Array<{ label: string; value: string }>>([])
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null)
  const [createForm] = Form.useForm<RoleFormValues>()
  const [editForm] = Form.useForm<Omit<RoleFormValues, 'code'>>()

  const loadRoles = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAdminRoles()
      setRoles(data)
    } catch (error: any) {
      message.error(error?.message ?? '获取角色失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  const loadMenus = useCallback(async () => {
    try {
      const data = await fetchAdminMenus()
      const options = data
        .filter(node => node.code)
        .map(node => ({
          label: node.code ? `${node.title} (${node.code})` : node.title,
          value: node.code!,
        }))
      setMenuOptions(options)
    } catch (error: any) {
      message.error(error?.message ?? '加载菜单失败')
    }
  }, [message])

  useEffect(() => {
    void loadRoles()
    void loadMenus()
  }, [loadRoles, loadMenus])

  const handleCreateRole = async (values: RoleFormValues) => {
    try {
      await createRole({
        code: values.code,
        name: values.name,
        description: values.description,
        menuPermissions: values.menuPermissions ?? [],
      })
      message.success('角色创建成功')
      createForm.resetFields()
      await loadRoles()
    } catch (error: any) {
      message.error(error?.message ?? '创建失败')
    }
  }

  const menuLabelMap = useMemo(
    () => new Map(menuOptions.map(option => [option.value, option.label])),
    [menuOptions],
  )

  const openEditModal = (role: AdminRole) => {
    setEditingRole(role)
    editForm.setFieldsValue({
      name: role.name,
      description: role.description ?? undefined,
      menuPermissions: role.menuPermissions ?? [],
    })
    setEditModalOpen(true)
  }

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields()
      if (!editingRole) return
      await updateRole(editingRole.id, {
        name: values.name,
        description: values.description,
        menuPermissions: values.menuPermissions ?? [],
      })
      message.success('角色已更新')
      setEditModalOpen(false)
      setEditingRole(null)
      await loadRoles()
    } catch (error: any) {
      if (error?.message) message.error(error.message)
    }
  }

  return (
    <div className="page-container">
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Card title="新建角色">
          <Form layout="inline" form={createForm} onFinish={handleCreateRole}>
            <Form.Item name="code" rules={[{ required: true, message: '角色编码必填' }]}> 
              <Input placeholder="admin" />
            </Form.Item>
            <Form.Item name="name" rules={[{ required: true, message: '角色名称必填' }]}> 
              <Input placeholder="超级管理员" />
            </Form.Item>
            <Form.Item name="description"> 
              <Input placeholder="备注" />
            </Form.Item>
            <Form.Item name="menuPermissions">
              <Select
                mode="multiple"
                allowClear
                style={{ minWidth: 220 }}
                placeholder="关联菜单（可选）"
                options={menuOptions}
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
            </Form.Item>
          </Form>
        </Card>
        <Card title="角色列表">
          <Table<AdminRole>
            loading={loading}
            dataSource={roles}
            rowKey="id"
            pagination={false}
            columns={[
              { title: '编码', dataIndex: 'code' },
              { title: '名称', dataIndex: 'name' },
              { title: '描述', dataIndex: 'description', render: value => value || '-' },
              {
                title: '菜单权限',
                dataIndex: 'menuPermissions',
                render: perms =>
                  perms?.length
                    ? perms.map((code: string) => (
                        <Tag key={code}>{menuLabelMap.get(code) ?? code}</Tag>
                      ))
                    : '—',
              },
              {
                title: '操作',
                render: (_, record) => (
                  <Button type="link" onClick={() => openEditModal(record)}>
                    编辑
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      </Space>

      <Modal
        title={editingRole ? `编辑：${editingRole.name}` : '编辑角色'}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleEditSubmit}
        okText="保存"
      >
        <Form layout="vertical" form={editForm}>
          <Form.Item label="角色名称" name="name" rules={[{ required: true, message: '请输入角色名称' }]}> 
            <Input placeholder="角色名称" />
          </Form.Item>
          <Form.Item label="描述" name="description"> 
            <Input placeholder="可选备注" />
          </Form.Item>
          <Form.Item label="菜单权限" name="menuPermissions"> 
            <Select
              mode="multiple"
              allowClear
              placeholder="选择可访问的菜单"
              options={menuOptions}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
