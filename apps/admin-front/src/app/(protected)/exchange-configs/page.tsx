'use client'

import type { ColumnsType } from 'antd/es/table'
import type {
  CreateExchangeConfigPayload,
  ExchangeConfigResponse,
  UpdateExchangeConfigPayload,
} from '@/lib/api'
import {
  App,
  Avatar,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createExchangeConfig,
  deleteExchangeConfig,
  fetchExchangeConfigs,
  updateExchangeConfig,
} from '@/lib/api'

const venueTypeOptions = [
  { label: 'CEX（中心化交易所）', value: 'CEX' },
  { label: 'DEX（去中心化交易所）', value: 'DEX' },
]

interface HttpErrorLike {
  message?: string
  response?: {
    status?: number
  }
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object')
    return undefined
  return (error as HttpErrorLike).response?.status
}

function getErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object')
    return undefined
  return (error as HttpErrorLike).message
}

function safeStringifyJson(value: unknown) {
  if (value === undefined || value === null)
    return ''
  try {
    return JSON.stringify(value, null, 2)
  }
  catch {
    return ''
  }
}

function safeParseJson(text: string): Record<string, unknown> | null | undefined {
  const trimmed = text.trim()
  if (!trimmed)
    return undefined
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      return parsed as Record<string, unknown>
    return null
  }
  catch {
    return null
  }
}

export default function ExchangeConfigsPage() {
  const { message, modal } = App.useApp()
  const [configs, setConfigs] = useState<ExchangeConfigResponse[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editing, setEditing] = useState<ExchangeConfigResponse | null>(null)
  const [createForm] = Form.useForm<CreateExchangeConfigPayload & { metadataText?: string }>()
  const [editForm] = Form.useForm<UpdateExchangeConfigPayload & { metadataText?: string }>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchExchangeConfigs({ page, limit })
      setConfigs(data.items)
      setTotal(data.total)
    }
    catch (error: unknown) {
      message.error(getErrorMessage(error) ?? '获取交易所配置失败')
    }
    finally {
      setLoading(false)
    }
  }, [limit, message, page])

  useEffect(() => {
    void load()
  }, [load])

  const openEdit = useCallback((record: ExchangeConfigResponse) => {
    setEditing(record)
    editForm.setFieldsValue({
      code: record.code,
      name: record.name,
      avatarUrl: record.avatarUrl ?? undefined,
      intro: record.intro ?? undefined,
      websiteUrl: record.websiteUrl ?? undefined,
      venueType: record.venueType ?? undefined,
      enabled: record.enabled,
      sort: record.sort,
      metadataText: safeStringifyJson(record.metadata),
    })
    setEditModalOpen(true)
  }, [editForm])

  const handleDelete = useCallback((record: ExchangeConfigResponse) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除交易所配置「${record.code} / ${record.name}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteExchangeConfig(record.id)
          message.success('删除成功')
          await load()
        }
        catch (error: unknown) {
          const status = getErrorStatus(error)
          if (status === 404) {
            message.error('配置不存在，可能已被删除')
            await load()
          }
          else if (status === 403) {
            message.error('没有权限执行此操作')
          }
          else {
            message.error(getErrorMessage(error) ?? '删除失败，请稍后重试')
          }
        }
      },
    })
  }, [load, message, modal])

  const columns: ColumnsType<ExchangeConfigResponse> = useMemo(() => {
    return [
      {
        title: 'Logo',
        dataIndex: 'avatarUrl',
        width: 80,
        render: (url: string | null | undefined, record: ExchangeConfigResponse) => (
          <Avatar shape="square" size={40} src={url ?? undefined} alt={record.name}>
            {record.name?.slice?.(0, 1)?.toUpperCase?.() ?? '?'}
          </Avatar>
        ),
      },
      {
        title: 'Code',
        dataIndex: 'code',
        width: 140,
        render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
      },
      {
        title: '名称',
        dataIndex: 'name',
        width: 220,
      },
      {
        title: '类型',
        dataIndex: 'venueType',
        width: 120,
        render: (value: string | null | undefined) =>
          value ? <Tag color={value === 'CEX' ? 'blue' : 'green'}>{value}</Tag> : <Tag>未设置</Tag>,
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        width: 90,
        render: (value: boolean) => (
          <Tag color={value ? 'success' : 'default'}>
            {value ? '启用' : '禁用'}
          </Tag>
        ),
      },
      {
        title: '排序',
        dataIndex: 'sort',
        width: 90,
      },
      {
        title: '官网',
        dataIndex: 'websiteUrl',
        width: 220,
        ellipsis: true,
        render: (value: string | null | undefined) =>
          value
            ? (
                <Typography.Link href={value} target="_blank" rel="noreferrer">
                  {value}
                </Typography.Link>
              )
            : '-',
      },
      {
        title: '简介',
        dataIndex: 'intro',
        width: 260,
        ellipsis: true,
        render: (value: string | null | undefined) => value || '-',
      },
      {
        title: '操作',
        fixed: 'right' as const,
        width: 160,
        render: (_: unknown, record: ExchangeConfigResponse) => (
          <Space>
            <Button type="link" size="small" onClick={() => openEdit(record)}>
              编辑
            </Button>
            <Button type="link" size="small" danger onClick={() => handleDelete(record)}>
              删除
            </Button>
          </Space>
        ),
      },
    ]
  }, [handleDelete, openEdit])

  const handleCreate = async (values: CreateExchangeConfigPayload & { metadataText?: string }) => {
    const metadata = values.metadataText ? safeParseJson(values.metadataText) : undefined
    if (metadata === null) {
      message.error('扩展信息(JSON) 格式不合法：必须是 JSON 对象')
      return
    }

    try {
      await createExchangeConfig({
        code: values.code,
        name: values.name,
        avatarUrl: values.avatarUrl,
        intro: values.intro,
        websiteUrl: values.websiteUrl,
        venueType: values.venueType,
        enabled: values.enabled,
        sort: values.sort,
        metadata,
      })
      message.success('创建成功')
      setCreateModalOpen(false)
      createForm.resetFields()
      await load()
    }
    catch (error: unknown) {
      const status = getErrorStatus(error)
      if (status === 409) message.error('Code 已存在，请换一个')
      else if (status === 400) message.error('输入数据格式错误，请检查后重试')
      else if (status === 403) message.error('没有权限执行此操作')
      else message.error(getErrorMessage(error) ?? '创建失败，请稍后重试')
    }
  }

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields()
      if (!editing) return

      const metadata = values.metadataText ? safeParseJson(values.metadataText) : undefined
      if (metadata === null) {
        message.error('扩展信息(JSON) 格式不合法：必须是 JSON 对象')
        return
      }

      await updateExchangeConfig(editing.id, {
        code: values.code,
        name: values.name,
        avatarUrl: values.avatarUrl,
        intro: values.intro,
        websiteUrl: values.websiteUrl,
        venueType: values.venueType,
        enabled: values.enabled,
        sort: values.sort,
        metadata,
      })
      message.success('已更新')
      setEditModalOpen(false)
      setEditing(null)
      await load()
    }
    catch (error: unknown) {
      const status = getErrorStatus(error)
      if (status === 404) message.error('配置不存在，可能已被删除')
      else if (status === 409) message.error('Code 已存在，请换一个')
      else if (status === 400) message.error('输入数据格式错误，请检查后重试')
      else if (status === 403) message.error('没有权限执行此操作')
      else message.error(getErrorMessage(error) ?? '更新失败，请稍后重试')
    }
  }

  return (
    <div className="page-container">
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Card
          title="交易所配置"
          extra={(
            <Button type="primary" onClick={() => setCreateModalOpen(true)}>
              新建配置
            </Button>
          )}
        >
          <Table<ExchangeConfigResponse>
            loading={loading}
            dataSource={configs}
            rowKey="id"
            pagination={{
              current: page,
              pageSize: limit,
              total,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
            }}
            onChange={(pagination) => {
              const nextPage = pagination.current ?? 1
              const nextLimit = pagination.pageSize ?? 20
              if (nextPage !== page) setPage(nextPage)
              if (nextLimit !== limit) setLimit(nextLimit)
            }}
            scroll={{ x: 1400 }}
            columns={columns}
          />
        </Card>
      </Space>

      <Modal
        title="新建交易所配置"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => createForm.submit()}
        okText="创建"
        width={760}
      >
        <Form layout="vertical" form={createForm} onFinish={handleCreate}>
          <Space style={{ width: '100%' }} size="large" align="start">
            <Form.Item
              label="Code（唯一标识）"
              name="code"
              rules={[
                { required: true, message: '请输入 code' },
                { pattern: /^[A-Z0-9_]+$/, message: '只能包含大写字母/数字/下划线' },
              ]}
              style={{ width: 240 }}
              tooltip="建议与订单薄等配置中的 venue 保持一致，例如 BINANCE、OKX、UNISWAP_V3"
            >
              <Input placeholder="BINANCE" />
            </Form.Item>
            <Form.Item
              label="名称"
              name="name"
              rules={[{ required: true, message: '请输入名称' }]}
              style={{ width: 320 }}
            >
              <Input placeholder="Binance" />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }} size="large" align="start">
            <Form.Item label="类型" name="venueType" style={{ width: 240 }}>
              <Select allowClear options={venueTypeOptions} placeholder="可选" />
            </Form.Item>
            <Form.Item label="排序" name="sort" initialValue={100} style={{ width: 240 }}>
              <InputNumber min={0} max={100000} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="是否启用" name="enabled" valuePropName="checked" initialValue style={{ width: 160 }}>
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item label="Logo URL" name="avatarUrl">
            <Input placeholder="https://.../logo.png" />
          </Form.Item>

          <Form.Item label="官网链接" name="websiteUrl">
            <Input placeholder="https://www.binance.com" />
          </Form.Item>

          <Form.Item label="简介" name="intro">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>

          <Form.Item label="扩展信息(JSON)" name="metadataText" tooltip="可选；必须是 JSON 对象">
            <Input.TextArea rows={4} placeholder='例如：{ "country": "CN", "aliases": ["binance"] }' />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editing ? `编辑：${editing.code}` : '编辑交易所配置'}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleEditSubmit}
        okText="保存"
        width={760}
      >
        <Form layout="vertical" form={editForm}>
          <Space style={{ width: '100%' }} size="large" align="start">
            <Form.Item
              label="Code（唯一标识）"
              name="code"
              rules={[
                { required: true, message: '请输入 code' },
                { pattern: /^[A-Z0-9_]+$/, message: '只能包含大写字母/数字/下划线' },
              ]}
              style={{ width: 240 }}
            >
              <Input placeholder="BINANCE" />
            </Form.Item>
            <Form.Item
              label="名称"
              name="name"
              rules={[{ required: true, message: '请输入名称' }]}
              style={{ width: 320 }}
            >
              <Input placeholder="Binance" />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }} size="large" align="start">
            <Form.Item label="类型" name="venueType" style={{ width: 240 }}>
              <Select allowClear options={venueTypeOptions} placeholder="可选" />
            </Form.Item>
            <Form.Item label="排序" name="sort" style={{ width: 240 }}>
              <InputNumber min={0} max={100000} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="是否启用" name="enabled" valuePropName="checked" style={{ width: 160 }}>
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item label="Logo URL" name="avatarUrl">
            <Input placeholder="https://.../logo.png" />
          </Form.Item>

          <Form.Item label="官网链接" name="websiteUrl">
            <Input placeholder="https://www.binance.com" />
          </Form.Item>

          <Form.Item label="简介" name="intro">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>

          <Form.Item label="扩展信息(JSON)" name="metadataText" tooltip="可选；必须是 JSON 对象">
            <Input.TextArea rows={4} placeholder='例如：{ "country": "CN", "aliases": ["binance"] }' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

