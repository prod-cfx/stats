 'use client'

import type { ColumnsType } from 'antd/es/table'
import type { DataPullExecutionLog, DataPullTask, RegisteredJobInfo } from '@/lib/api'
import { App, Badge, Button, Card, Drawer, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Tooltip } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createDataPullTask,
  deleteDataPullTask,
  fetchDataPullTaskExecutions,
  fetchDataPullTasks,
  fetchRegisteredJobs,
  interruptDataPullTask,
  triggerDataPullTask,
  updateDataPullTask,
} from '@/lib/api'

interface TaskFormValues {
  /** Job 类型（从已注册的 key 中选择） */
  jobKey: string
  /** 任务后缀（可选，用于区分同类型的多个任务实例，如 BTC、ETH） */
  keySuffix?: string
  name: string
  source?: string
  type?: string
  cron?: string
  intervalSeconds?: number
  enabled?: boolean
  cursor?: string
  /**
   * 任务级配置参数（JSON 字符串），会在提交前解析为对象写入 data_pull_tasks.meta
   */
  meta?: string
}

/**
 * 解析任务 key，拆分为 jobKey 和 suffix
 * 例如："coinglass-aggregated-liquidation:BTC" => { jobKey: "coinglass-aggregated-liquidation", suffix: "BTC" }
 */
function parseTaskKey(taskKey: string): { jobKey: string; suffix?: string } {
  const colonIndex = taskKey.indexOf(':')
  if (colonIndex > 0) {
    return {
      jobKey: taskKey.slice(0, colonIndex),
      suffix: taskKey.slice(colonIndex + 1),
    }
  }
  return { jobKey: taskKey }
}

/**
 * 组合 jobKey 和 suffix 为完整的任务 key
 */
function buildTaskKey(jobKey: string, suffix?: string): string {
  if (suffix && suffix.trim()) {
    return `${jobKey}:${suffix.trim()}`
  }
  return jobKey
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
  // 已注册的 Job 信息（用于下拉选择和显示 meta 格式说明）
  const [registeredJobs, setRegisteredJobs] = useState<RegisteredJobInfo[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  // 当前选中的 Job（用于显示 meta 格式说明）
  const [selectedJobKey, setSelectedJobKey] = useState<string | undefined>()
  // 日志抽屉相关状态
  const [logDrawerVisible, setLogDrawerVisible] = useState(false)
  const [logLoading, setLogLoading] = useState(false)
  const [logTask, setLogTask] = useState<DataPullTask | null>(null)
  const [logItems, setLogItems] = useState<DataPullExecutionLog[]>([])
  const [logTotal, setLogTotal] = useState(0)
  const [logPage, setLogPage] = useState(1)
  const [logLimit, setLogLimit] = useState(20)
  const [triggeringId, setTriggeringId] = useState<number | null>(null)

  const loadTasks = useCallback(
    async (pageParam: number, limitParam: number, filters?: { key?: string; name?: string; enabled?: boolean }) => {
      setLoading(true)
      try {
        const result = await fetchDataPullTasks({
          page: pageParam,
          limit: limitParam,
          key: filters?.key,
          name: filters?.name,
          enabled: filters?.enabled,
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
    [message],
  )

  const loadTaskLogs = useCallback(
    async (task: DataPullTask, pageParam: number, limitParam: number) => {
      setLogLoading(true)
      try {
        const result = await fetchDataPullTaskExecutions(task.id, pageParam, limitParam)
        setLogTask(task)
        setLogItems(result.items)
        setLogTotal(result.total)
        setLogPage(result.page)
        setLogLimit(result.limit)
        setLogDrawerVisible(true)
      } catch (error: any) {
        message.error(error?.message ?? '获取任务执行日志失败')
      } finally {
        setLogLoading(false)
      }
    },
    [message],
  )

  const openLogDrawer = useCallback(
    (task: DataPullTask) => {
      void loadTaskLogs(task, 1, logLimit)
    },
    [loadTaskLogs, logLimit],
  )

  // 加载已注册的 Job 信息
  const loadRegisteredJobs = useCallback(async () => {
    setJobsLoading(true)
    try {
      const jobs = await fetchRegisteredJobs()
      setRegisteredJobs(jobs)
    } catch (error: any) {
      message.error(error?.message ?? '获取已注册 Job 信息失败')
    } finally {
      setJobsLoading(false)
    }
  }, [message])

  // 获取当前选中的 Job 信息
  const selectedJob = useMemo(() => {
    if (!selectedJobKey) return null
    return registeredJobs.find(job => job.key === selectedJobKey) ?? null
  }, [selectedJobKey, registeredJobs])

  useEffect(() => {
    void loadTasks(1, 20)
    void loadRegisteredJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreateModal = useCallback(() => {
    setCurrentTask(null)
    setSelectedJobKey(undefined)
    form.resetFields()
    form.setFieldsValue({
      enabled: true,
      intervalSeconds: 60,
    })
    setModalVisible(true)
  }, [form])

  const openEditModal = useCallback((task: DataPullTask) => {
    setCurrentTask(task)
    const { jobKey, suffix } = parseTaskKey(task.key)
    setSelectedJobKey(jobKey)
    form.setFieldsValue({
      jobKey,
      keySuffix: suffix,
      name: task.name,
      source: task.source ?? undefined,
      type: task.type ?? undefined,
      cron: task.cron ?? undefined,
      intervalSeconds: task.intervalSeconds ?? undefined,
      enabled: task.enabled,
      cursor: task.cursor ?? undefined,
      meta: (task as any).meta ? JSON.stringify((task as any).meta, null, 2) : undefined,
    })
    setModalVisible(true)
  }, [form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      let parsedMeta: Record<string, unknown> | null | undefined
      if (values.meta && values.meta.trim()) {
        try {
          parsedMeta = JSON.parse(values.meta) as Record<string, unknown>
        } catch {
          message.error('任务配置 meta 必须是合法的 JSON')
          return
        }
      }

      // 组合完整的任务 key
      const fullKey = buildTaskKey(values.jobKey, values.keySuffix)

      if (currentTask) {
        await updateDataPullTask(currentTask.id, {
          name: values.name,
          source: values.source ?? null,
          type: values.type ?? null,
          cron: values.cron ?? null,
          intervalSeconds: values.intervalSeconds ?? null,
          enabled: values.enabled ?? true,
          cursor: values.cursor ?? null,
          meta: parsedMeta ?? null,
        })
        message.success('任务已更新')
      } else {
        await createDataPullTask({
          key: fullKey,
          name: values.name,
          source: values.source,
          type: values.type,
          cron: values.cron,
          intervalSeconds: values.intervalSeconds,
          enabled: values.enabled,
          cursor: values.cursor,
          meta: parsedMeta ?? null,
        })
        message.success('任务已创建')
      }
      setModalVisible(false)
      void loadTasks(page, limit, { key: queryKey, name: queryName, enabled: queryEnabled })
    } catch (error: any) {
      // 处理各种错误格式
      const errorMsg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.data?.message ||
        error?.message ||
        '操作失败，请重试'
      message.error(errorMsg)
      console.error('创建/更新任务失败:', error)
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
          void loadTasks(page, limit, { key: queryKey, name: queryName, enabled: queryEnabled })
        } catch (error: any) {
          message.error(error?.message ?? '删除失败')
        }
      },
    })
  }, [loadTasks, message, page, limit, queryKey, queryName, queryEnabled])

  const handleTrigger = useCallback(
    async (task: DataPullTask) => {
      setTriggeringId(task.id)
      try {
        const exec = await triggerDataPullTask(task.id)
        message.success(
          `任务已触发，状态：${exec.status}${
            typeof exec.fetchedCount === 'number' ? `，拉取条数：${exec.fetchedCount}` : ''
          }`,
        )
        // 触发后刷新列表和日志
        void loadTasks(page, limit, { key: queryKey, name: queryName, enabled: queryEnabled })
        // 如果当前打开的是该任务的日志抽屉，则刷新日志
        if (logTask && logTask.id === task.id) {
          void loadTaskLogs(task, 1, logLimit)
        }
      } catch (error: any) {
        const errorMsg =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.data?.message ||
          error?.message ||
          '触发任务失败'
        message.error(errorMsg)
      } finally {
        setTriggeringId(null)
      }
    },
    [loadTasks, loadTaskLogs, logLimit, logTask, message, page, limit, queryKey, queryName, queryEnabled],
  )

  const handleInterrupt = useCallback(
    async (task: DataPullTask) => {
      Modal.confirm({
        title: `确认中断任务「${task.name}」?`,
        content: '中断后任务状态将重置为 IDLE，可以被重新调度。正在执行的 Job 不会立即停止，但会在完成或超时后标记为失败。',
        okText: '中断',
        okButtonProps: { danger: true },
        cancelText: '取消',
        async onOk() {
          try {
            const result = await interruptDataPullTask(task.id)
            message.success(result.message)
            void loadTasks(page, limit, { key: queryKey, name: queryName, enabled: queryEnabled })
          } catch (error: unknown) {
            const errorMsg =
              (typeof error === 'object' && error !== null
                ? (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message
                  ?? (error as { message?: string }).message
                : undefined) ||
              '中断任务失败'
            message.error(errorMsg)
          }
        },
      })
    },
    [loadTasks, message, page, limit, queryKey, queryName, queryEnabled],
  )

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
        width: 360,
        render: (_, record) => (
          <>
            <Button type="link" onClick={() => openEditModal(record)}>
              编辑
            </Button>
            <Button type="link" onClick={() => openLogDrawer(record)}>
              查看日志
            </Button>
            <Button
              type="link"
              onClick={() => handleTrigger(record)}
              loading={triggeringId === record.id}
            >
              立即执行
            </Button>
            <Button
              type="link"
              danger
              disabled={record.lastStatus !== 'RUNNING'}
              onClick={() => handleInterrupt(record)}
            >
              中断
            </Button>
            <Button type="link" danger onClick={() => handleDelete(record)}>
              删除
            </Button>
          </>
        ),
      },
    ],
    [handleDelete, handleInterrupt, handleTrigger, openEditModal, openLogDrawer, statusBadge, triggeringId],
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
          <Button type="primary" onClick={() => loadTasks(1, limit, { key: queryKey, name: queryName, enabled: queryEnabled })}>
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
              void loadTasks(p, ps, { key: queryKey, name: queryName, enabled: queryEnabled })
            },
          }}
        />
      </Card>

      <Drawer
        title={logTask ? `执行日志 - ${logTask.name}` : '执行日志'}
        width={840}
        open={logDrawerVisible}
        onClose={() => setLogDrawerVisible(false)}
        destroyOnClose
      >
        <Table<DataPullExecutionLog>
          rowKey="id"
          size="small"
          loading={logLoading}
          dataSource={logItems}
          pagination={{
            current: logPage,
            pageSize: logLimit,
            total: logTotal,
            showSizeChanger: true,
            onChange: (p, ps) => {
              if (logTask) {
                void loadTaskLogs(logTask, p, ps)
              }
            },
          }}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 80 },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (status: string) => {
                if (status === 'SUCCESS') return <Badge status="success" text="成功" />
                if (status === 'FAILED') return <Badge status="error" text="失败" />
                if (status === 'SKIPPED') return <Tag>跳过</Tag>
                return <Tag>{status}</Tag>
              },
            },
            {
              title: '开始时间',
              dataIndex: 'startedAt',
              width: 200,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: '结束时间',
              dataIndex: 'finishedAt',
              width: 200,
              render: (value?: string | null) => (value ? new Date(value).toLocaleString() : '—'),
            },
            {
              title: '拉取条数',
              dataIndex: 'fetchedCount',
              width: 100,
            },
            {
              title: '错误信息',
              dataIndex: 'errorMessage',
              ellipsis: true,
              render: (value?: string | null) => value || '—',
            },
          ]}
        />
      </Drawer>

      <Modal
        title={currentTask ? '编辑数据拉取任务' : '新建数据拉取任务'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        afterClose={() => {
          form.resetFields()
          setCurrentTask(null)
          setSelectedJobKey(undefined)
        }}
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            label={
              <Space>
                任务 Key
                <Tooltip title="格式：Job类型:后缀（后缀可选）。例如 coinglass-aggregated-liquidation:BTC 表示拉取 BTC 的清算数据">
                  <span style={{ color: '#999', cursor: 'help' }}>ⓘ</span>
                </Tooltip>
              </Space>
            }
            required
          >
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item
                name="jobKey"
                noStyle
                rules={[{ required: true, message: '请选择 Job 类型' }]}
              >
                <Select
                  placeholder="选择 Job 类型"
                  disabled={!!currentTask}
                  loading={jobsLoading}
                  showSearch
                  optionFilterProp="label"
                  style={{ width: '60%' }}
                  options={registeredJobs.map(job => ({ value: job.key, label: job.name || job.key }))}
                  notFoundContent={jobsLoading ? '加载中...' : '暂无可用的 Job'}
                  onChange={(value: string) => {
                    setSelectedJobKey(value)
                    // 如果有 metaSchema.example，自动填充 meta
                    const job = registeredJobs.find(j => j.key === value)
                    if (job?.metaSchema?.example) {
                      // 深拷贝一次，避免潜在的循环引用或共享引用导致 rc-field-form 报告
                      const safeExample = JSON.parse(JSON.stringify(job.metaSchema.example))
                      form.setFieldValue('meta', JSON.stringify(safeExample, null, 2))
                    }
                  }}
                />
              </Form.Item>
              <Form.Item name="keySuffix" noStyle>
                <Input
                  prefix=":"
                  placeholder="后缀（可选，如 BTC、ETH）"
                  disabled={!!currentTask}
                  style={{ width: '40%' }}
                />
              </Form.Item>
            </Space.Compact>
          </Form.Item>

          {/* 显示选中 Job 的 meta 格式说明 */}
          {selectedJob?.metaSchema && (
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 6, fontSize: 13 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>{selectedJob.metaSchema.description}</div>
              <div style={{ marginBottom: 8 }}>
                <strong>配置字段：</strong>
                <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                  {selectedJob.metaSchema.fields.map(field => (
                    <li key={field.name}>
                      <code>{field.name}</code>
                      {field.required && <Tag color="red" style={{ marginLeft: 4, fontSize: 10 }}>必填</Tag>}
                      <span style={{ color: '#666' }}> - {field.description}</span>
                      {field.options && (
                        <span style={{ color: '#999' }}> 可选值: {field.options.join(', ')}</span>
                      )}
                      {field.defaultValue !== undefined && (
                        <span style={{ color: '#999' }}> 默认: {String(field.defaultValue)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

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

          <Form.Item
            label="任务配置 meta（JSON，可选）"
            name="meta"
            tooltip="用于为该任务传入自定义配置，例如 Polymarket 的 category/tags，必须是合法的 JSON 对象"
          >
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 8 }}
              placeholder='例如：{"category":"crypto","tags":["BTC","ETH"]}'
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

