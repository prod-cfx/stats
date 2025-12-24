'use client'

import type { ColumnsType } from 'antd/es/table'
import type { DataPullTask } from '@/lib/api'
import {
  App,
  Badge,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
  Table,
  Tag,
} from 'antd'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createDataPullTask,
  deleteDataPullTask,
  fetchDataPullTasks,
  updateDataPullTask,
} from '@/lib/api'

interface TaskFormValues {
  key: string
  name: string
  source?: string
  type?: string
  cron?: string
  intervalSeconds?: number
  enabled?: boolean
  cursor?: string
}

export default function DataPullTasksPage() {
  const { message } = App.useApp()
  const [tasks, setTasks] = useState<DataPullTask[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [queryKey, setQueryKey] = useState<string | undefined>()
  const [queryName, setQueryName] = useState<string | undefined>()
  const [queryEnabled, setQueryEnabled] = useState<boolean | undefined>()
  const [modalVisible, setModalVisible] = useState(false)
  const [currentTask, setCurrentTask] = useState<DataPullTask | null>(null)
  const [form] = Form.useForm<TaskFormValues>()

  const loadTasks = useCallback(
    async (pageParam = page, limitParam = limit) => {
      setLoading(true)
      try {
        const result = await fetchDataPullTasks({
          page: pageParam,
          limit: limitParam,
          key: queryKey,
          name: queryName,
          enabled: queryEnabled,
        })
        setTasks(result.items)
        setTotal(result.total)
        setPage(result.page)
        setLimit(result.limit)
      } catch (error: any) {
        message.error(error?.message ?? '获取数据拉取任务失败')
      } finally {
        setLoading(false)
      }
    },
    [limit, message, page, queryEnabled, queryKey, queryName],
  )

  useEffect(() => {
    void loadTasks()
  }, [loadTasks])

  const openCreateModal = useCallback(() => {
    setCurrentTask(null)
    form.resetFields()
    form.setFieldsValue({
      enabled: true,
      intervalSeconds: 60,
    })
    setModalVisible(true)
  }, [form])

  const openEditModal = useCallback((task: DataPullTask) => {
    setCurrentTask(task)
    form.setFieldsValue({
      key: task.key,
      name: task.name,
      source: task.source ?? undefined,
      type: task.type ?? undefined,
      cron: task.cron ?? undefined,
      intervalSeconds: task.intervalSeconds ?? undefined,
      enabled: task.enabled,
      cursor: task.cursor ?? undefined,
    })
    setModalVisible(true)
  }, [form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (currentTask) {
        await updateDataPullTask(currentTask.id, {
          name: values.name,
          source: values.source ?? null,
          type: values.type ?? null,
          cron: values.cron ?? null,
          intervalSeconds: values.intervalSeconds ?? null,
          enabled: values.enabled ?? true,
          cursor: values.cursor ?? null,
        })
        message.success('任务已更新')
      } else {
        await createDataPullTask({
          key: values.key,
          name: values.name,
          source: values.source,
          type: values.type,
          cron: values.cron,
          intervalSeconds: values.intervalSeconds,
          enabled: values.enabled,
          cursor: values.cursor,
        })
        message.success('任务已创建')
      }
      setModalVisible(false)
      void loadTasks()
    } catch (error: any) {
      if (error?.message) {
        message.error(error.message)
      }
    }
  }

  const handleDelete = useCallback((task: DataPullTask) => {
    Modal.confirm({
      title: `确认删除任务「${task.name}」?`,
      content: '删除后无法恢复，请确认该任务不再使用。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      async onOk() {
        try {
          await deleteDataPullTask(task.id)
          message.success('任务已删除')
          void loadTasks()
        } catch (error: any) {
          message.error(error?.message ?? '删除失败')
        }
      },
    })
  }, [loadTasks, message])

  const statusBadge = useCallback((task: DataPullTask) => {
    if (!task.lastStatus) {
      return <Tag>未执行</Tag>
    }
    switch (task.lastStatus) {
      case 'SUCCESS':
        return <Badge status="success" text="成功" />
      case 'FAILED':
        return <Badge status="error" text="失败" />
      case 'RUNNING':
        return <Badge status="processing" text="执行中" />
      default:
        return <Tag>{task.lastStatus}</Tag>
    }
  }, [])

  const columns: ColumnsType<DataPullTask> = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 80 },
      { title: 'Key', dataIndex: 'key', width: 200 },
      { title: '名称', dataIndex: 'name', width: 200 },
      { title: '来源', dataIndex: 'source', render: value => value || '—' },
      { title: '类型', dataIndex: 'type', render: value => value || '—' },
      {
        title: '调度',
        render: (_, record) =>
          record.intervalSeconds
            ? `${record.intervalSeconds}s${record.cron ? ` / ${record.cron}` : ''}`
            : record.cron || '—',
      },
      {
        title: '启用',
        dataIndex: 'enabled',
        render: value => (value ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
      },
      {
        title: '最近状态',
        render: (_, record) => statusBadge(record),
      },
      {
        title: '最近运行时间',
        dataIndex: 'lastRunAt',
        render: value => (value ? new Date(value).toLocaleString() : '—'),
      },
      {
        title: '最近成功时间',
        dataIndex: 'lastSuccessAt',
        render: value => (value ? new Date(value).toLocaleString() : '—'),
      },
      {
        title: '操作',
        fixed: 'right',
        width: 180,
        render: (_, record) => (
          <>
            <Button type="link" onClick={() => openEditModal(record)}>
              编辑
            </Button>
            <Button type="link" danger onClick={() => handleDelete(record)}>
              删除
            </Button>
          </>
        ),
      },
    ],
    [handleDelete, openEditModal, statusBadge],
  )

  return (
    <div className="page-container">
      <Card
        title="数据拉取任务"
        className="dashboard-card"
        extra={
          <Button type="primary" onClick={openCreateModal}>
            新建任务
          </Button>
        }
      >
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Input
            placeholder="按 key 搜索"
            allowClear
            style={{ width: 200 }}
            value={queryKey}
            onChange={e => setQueryKey(e.target.value || undefined)}
          />
          <Input
            placeholder="按名称搜索"
            allowClear
            style={{ width: 200 }}
            value={queryName}
            onChange={e => setQueryName(e.target.value || undefined)}
          />
          <Select
            allowClear
            placeholder="状态筛选"
            style={{ width: 160 }}
            value={typeof queryEnabled === 'boolean' ? String(queryEnabled) : undefined}
            onChange={value => {
              if (value === undefined) {
                setQueryEnabled(undefined)
              } else {
                setQueryEnabled(value === 'true')
              }
            }}
            options={[
              { value: 'true', label: '仅启用' },
              { value: 'false', label: '仅停用' },
            ]}
          />
          <Button type="primary" onClick={() => loadTasks(1, limit)}>
            查询
          </Button>
        </div>

        <Table<DataPullTask>
          rowKey="id"
          columns={columns}
          dataSource={tasks}
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p)
              setLimit(ps)
              void loadTasks(p, ps)
            },
          }}
        />
      </Card>

      <Modal
        title={currentTask ? '编辑数据拉取任务' : '新建数据拉取任务'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        afterClose={() => {
          form.resetFields()
          setCurrentTask(null)
        }}
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            label="任务 Key"
            name="key"
            rules={[{ required: true, message: '请输入任务 key' }]}
          >
            <Input placeholder="example.kline_1m" disabled={!!currentTask} />
          </Form.Item>

          <Form.Item
            label="任务名称"
            name="name"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="示例 K 线 1m 拉取" />
          </Form.Item>

          <Form.Item label="数据来源" name="source">
            <Input placeholder="如 binance / newsapi" />
          </Form.Item>

          <Form.Item label="任务类型" name="type">
            <Input placeholder="如 kline_1m / news_latest" />
          </Form.Item>

          <Form.Item label="Cron 表达式" name="cron">
            <Input placeholder="可选，例如 */5 * * * *" />
          </Form.Item>

          <Form.Item label="最小执行间隔（秒）" name="intervalSeconds">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="例如 60" />
          </Form.Item>

          <Form.Item label="是否启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="初始/当前游标" name="cursor">
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 4 }}
              placeholder="可选，用于控制增量拉取的起点，如时间戳或 ID"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}


