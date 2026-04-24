'use client'

import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { BetaCode, CreateBetaCodeBatchPayload } from '@/lib/api'
import { CopyOutlined, PlusOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Form,
  InputNumber,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createBetaCodeBatch,
  fetchBetaCodes,
  updateBetaCodeStatus,
} from '@/lib/api'

function getErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object')
    return undefined
  return (error as { message?: string }).message
}

export default function BetaCodesPage() {
  const { message } = App.useApp()
  const [codes, setCodes] = useState<BetaCode[]>([])
  const [generatedCodes, setGeneratedCodes] = useState<BetaCode[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [switchingIds, setSwitchingIds] = useState<Set<string>>(() => new Set())
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [form] = Form.useForm<CreateBetaCodeBatchPayload>()

  const loadCodes = useCallback(async (pageParam: number, limitParam: number) => {
    setLoading(true)
    try {
      const result = await fetchBetaCodes({ page: pageParam, limit: limitParam })
      setCodes(result.items)
      setPage(result.page)
      setLimit(result.limit)
      setTotal(result.total)
    }
    catch (error: unknown) {
      message.error(getErrorMessage(error) ?? '获取内测码失败')
    }
    finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void loadCodes(1, 20)
  }, [loadCodes])

  const openCreateModal = useCallback(() => {
    form.setFieldsValue({
      count: 20,
      maxUsesPerCode: 1,
    })
    setGeneratedCodes([])
    setModalOpen(true)
  }, [form])

  const handleCreate = useCallback(async () => {
    try {
      const values = await form.validateFields()
      setCreating(true)
      const created = await createBetaCodeBatch(values)
      setGeneratedCodes(created)
      message.success(`已生成 ${created.length} 个内测码`)
      await loadCodes(1, limit)
    }
    catch (error: unknown) {
      const errorMessage = getErrorMessage(error)
      if (errorMessage)
        message.error(errorMessage)
    }
    finally {
      setCreating(false)
    }
  }, [form, limit, loadCodes, message])

  const copyGeneratedCodes = useCallback(async () => {
    const text = generatedCodes.map(item => item.code).join('\n')
    if (!text)
      return

    try {
      await navigator.clipboard.writeText(text)
      message.success('已复制本批内测码')
    }
    catch {
      message.error('复制失败，请手动选择复制')
    }
  }, [generatedCodes, message])

  const handleStatusChange = useCallback(async (record: BetaCode, checked: boolean) => {
    setSwitchingIds(prev => new Set(prev).add(record.id))
    try {
      await updateBetaCodeStatus(record.id, checked)
      message.success(checked ? '内测码已启用' : '内测码已停用')
      await loadCodes(page, limit)
    }
    catch (error: unknown) {
      message.error(getErrorMessage(error) ?? '更新内测码状态失败')
    }
    finally {
      setSwitchingIds((prev) => {
        const next = new Set(prev)
        next.delete(record.id)
        return next
      })
    }
  }, [limit, loadCodes, message, page])

  const handleTableChange = useCallback((pagination: TablePaginationConfig) => {
    const nextPage = pagination.current ?? 1
    const nextLimit = pagination.pageSize ?? limit
    void loadCodes(nextPage, nextLimit)
  }, [limit, loadCodes])

  const columns: ColumnsType<BetaCode> = useMemo(
    () => [
      {
        title: '内测码',
        dataIndex: 'code',
        render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
      },
      {
        title: '状态',
        dataIndex: 'isActive',
        width: 120,
        render: (value: boolean) => (
          <Tag color={value ? 'success' : 'default'}>
            {value ? '启用' : '停用'}
          </Tag>
        ),
      },
      {
        title: '使用量',
        width: 120,
        render: (_: unknown, record: BetaCode) => `${record.usedCount}/${record.maxUses}`,
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 220,
        render: (value: string) => (value ? new Date(value).toLocaleString() : '—'),
      },
      {
        title: '操作',
        width: 140,
        render: (_: unknown, record: BetaCode) => (
          <Switch
            checked={record.isActive}
            checkedChildren="启用"
            unCheckedChildren="停用"
            loading={switchingIds.has(record.id)}
            onChange={checked => void handleStatusChange(record, checked)}
          />
        ),
      },
    ],
    [handleStatusChange, switchingIds],
  )

  return (
    <div className="page-container">
      <Card
        title="内测码"
        className="dashboard-card"
        extra={(
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            批量生成
          </Button>
        )}
      >
        <Table<BetaCode>
          rowKey="id"
          columns={columns}
          dataSource={codes}
          loading={loading}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            showTotal: value => `共 ${value} 个内测码`,
          }}
          onChange={handleTableChange}
        />
      </Card>

      <Modal
        title="批量生成内测码"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        okText="生成"
        confirmLoading={creating}
        width={640}
      >
        <Form layout="vertical" form={form}>
          <Space size="large" align="start">
            <Form.Item
              label="生成数量"
              name="count"
              initialValue={20}
              rules={[{ required: true, message: '请输入生成数量' }]}
            >
              <InputNumber min={1} max={500} precision={0} style={{ width: 180 }} />
            </Form.Item>
            <Form.Item
              label="每码最大使用次数"
              name="maxUsesPerCode"
              initialValue={1}
              rules={[{ required: true, message: '请输入使用次数' }]}
            >
              <InputNumber min={1} max={1000} precision={0} style={{ width: 180 }} />
            </Form.Item>
          </Space>
        </Form>

        {generatedCodes.length > 0 && (
          <Card
            size="small"
            title="本批生成结果"
            extra={(
              <Button icon={<CopyOutlined />} size="small" onClick={copyGeneratedCodes}>
                复制
              </Button>
            )}
          >
            <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
              {generatedCodes.map(item => item.code).join('\n')}
            </Typography.Paragraph>
          </Card>
        )}
      </Modal>
    </div>
  )
}
