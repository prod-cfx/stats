
'use client'

import type { AdminMenuNode} from '@/lib/api';
import { App, Button, Card, Form, Input, Select, Space, Table, Tag } from 'antd'

import { useCallback, useEffect, useState } from 'react'
import { createMenu, fetchAdminMenus } from '@/lib/api'

export default function MenusPage() {
  const { message } = App.useApp()
  const [menus, setMenus] = useState<AdminMenuNode[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAdminMenus()
      setMenus(data)
    } catch (error: any) {
      message.error(error?.message ?? '加载菜单失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const createMenuAction = async (values: any) => {
    try {
      await createMenu(values)
      message.success('菜单已创建')
      await load()
    } catch (error: any) {
      message.error(error?.message ?? '创建失败')
    }
  }

  return (
    <div className="page-container">
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Card title="新增菜单">
          <Form layout="inline" onFinish={createMenuAction}>
            <Form.Item name="title" rules={[{ required: true, message: '菜单标题必填' }]}> 
              <Input placeholder="设置" />
            </Form.Item>
            <Form.Item name="type" initialValue="MENU">
              <Select
                style={{ width: 130 }}
                options={[
                  { value: 'DIRECTORY', label: '目录' },
                  { value: 'MENU', label: '页面' },
                  { value: 'FEATURE', label: '功能点' },
                ]}
              />
            </Form.Item>
            <Form.Item name="code">
              <Input placeholder="menu.settings" />
            </Form.Item>
            <Form.Item name="path">
              <Input placeholder="/settings" />
            </Form.Item>
            <Form.Item name="parentId">
              <Select
                allowClear
                placeholder="父级菜单"
                style={{ width: 160 }}
                options={menus.map(menu => ({ label: menu.title, value: menu.id }))}
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
            </Form.Item>
          </Form>
        </Card>
        <Card title="全部菜单">
          <Table<AdminMenuNode>
            loading={loading}
            dataSource={menus}
            rowKey="id"
            pagination={false}
            columns={[
              { title: '标题', dataIndex: 'title' },
              { title: '类型', dataIndex: 'type', render: type => <Tag>{type}</Tag> },
              { title: '编码', dataIndex: 'code', render: value => value || '—' },
              { title: '路径', dataIndex: 'path', render: value => value || '—' },
            ]}
          />
        </Card>
      </Space>
    </div>
  )
}
