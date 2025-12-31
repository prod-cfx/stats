'use client'

import type {
  CreateOrderbookPairConfigPayload,
  ExchangeConfigResponse,
  OrderbookPairConfigResponse,
  UpdateOrderbookPairConfigPayload,
} from '@/lib/api'
import {
  App,
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
} from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createOrderbookConfig,
  deleteOrderbookConfig,
  fetchExchangeConfigs,
  fetchOrderbookConfigs,
  fetchOrderbookSnapshotByConfigId,
  updateOrderbookConfig,
} from '@/lib/api'

const venueTypeOptions = [
  { label: 'CEX（中心化交易所）', value: 'CEX' },
  { label: 'DEX（去中心化交易所）', value: 'DEX' },
]

const instrumentTypeOptions = [
  { label: '现货 (SPOT)', value: 'SPOT' },
  { label: '永续合约 (PERPETUAL)', value: 'PERPETUAL' },
  { label: '期货 (FUTURE)', value: 'FUTURE' },
]

export default function OrderbookConfigsPage() {
  const { message, modal } = App.useApp()
  const [configs, setConfigs] = useState<OrderbookPairConfigResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [venues, setVenues] = useState<ExchangeConfigResponse[]>([])
  const [venueLoading, setVenueLoading] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<OrderbookPairConfigResponse | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [viewingConfig, setViewingConfig] = useState<OrderbookPairConfigResponse | null>(null)
  const [orderbookPreview, setOrderbookPreview] = useState<{
    bids: { price: number; size: number }[]
    asks: { price: number; size: number }[]
    exchangeTs?: number
    receivedTs?: number
  } | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [viewError, setViewError] = useState<string | null>(null)
  const [createForm] = Form.useForm<CreateOrderbookPairConfigPayload>()
  const [editForm] = Form.useForm<UpdateOrderbookPairConfigPayload>()
  const viewRequestIdRef = useRef(0)

  const loadConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchOrderbookConfigs()
      setConfigs(data)
    }
    catch (error: any) {
      message.error(error?.message ?? '获取配置失败')
    }
    finally {
      setLoading(false)
    }
  }, [message])

  const loadVenues = useCallback(async () => {
    setVenueLoading(true)
    try {
      const data = await fetchExchangeConfigs({ page: 1, limit: 100, enabled: true })
      setVenues(data.items)
    }
    catch (error: any) {
      message.error(error?.message ?? '获取交易所列表失败')
    }
    finally {
      setVenueLoading(false)
    }
  }, [message])

  const openViewModal = async (config: OrderbookPairConfigResponse) => {
    // 为本次查看生成唯一请求 ID，用于避免关闭后再次被异步结果唤起
    const requestId = viewRequestIdRef.current + 1
    viewRequestIdRef.current = requestId

    setViewingConfig(config)
    setViewModalOpen(true)
    setOrderbookPreview(null)
    setViewError(null)
    setViewLoading(true)
    try {
      const book = await fetchOrderbookSnapshotByConfigId(config.id)

      // 如果在请求过程中用户已经关闭或切换了查看对象，则丢弃此次结果
      if (viewRequestIdRef.current !== requestId)
        return
      if (!book || ((!book.bids || book.bids.length === 0) && (!book.asks || book.asks.length === 0))) {
        setViewError('当前没有该交易对的订单薄数据，请确认订单薄同步任务或快照任务是否已开启')
        return
      }
      setOrderbookPreview({
        bids: book.bids,
        asks: book.asks,
        exchangeTs: book.exchangeTs,
        receivedTs: book.receivedTs,
      })
    }
    catch (error: any) {
      setViewError(error?.message ?? '获取订单薄失败，请稍后重试')
    }
    finally {
      setViewLoading(false)
    }
  }

  useEffect(() => {
    void loadConfigs()
    void loadVenues()
  }, [loadConfigs, loadVenues])

  const handleCreateConfig = async (values: CreateOrderbookPairConfigPayload) => {
    try {
      await createOrderbookConfig(values)
      message.success('配置创建成功')
      setCreateModalOpen(false)
      createForm.resetFields()
      await loadConfigs()
    }
    catch (error: any) {
      const status = error?.response?.status
      if (status === 409) {
        message.error('该交易对ID已存在，请使用其他ID')
      }
      else if (status === 400) {
        message.error('输入数据格式错误，请检查后重试')
      }
      else if (status === 403) {
        message.error('没有权限执行此操作')
      }
      else {
        message.error(error?.message ?? '创建失败，请稍后重试')
      }
    }
  }

  const openEditModal = (config: OrderbookPairConfigResponse) => {
    setEditingConfig(config)
    editForm.setFieldsValue({
      enabled: config.enabled,
      pullIntervalSeconds: config.pullIntervalSeconds ?? undefined,
      depthLevels: config.depthLevels ?? undefined,
      priority: config.priority,
      description: config.description ?? undefined,
      metadata: config.metadata ?? undefined,
    })
    setEditModalOpen(true)
  }

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields()
      if (!editingConfig)
        return
      await updateOrderbookConfig(editingConfig.id, values)
      message.success('配置已更新')
      setEditModalOpen(false)
      setEditingConfig(null)
      await loadConfigs()
    }
    catch (error: any) {
      const status = error?.response?.status
      if (status === 404) {
        message.error('配置不存在，可能已被删除')
      }
      else if (status === 400) {
        message.error('输入数据格式错误，请检查后重试')
      }
      else if (status === 403) {
        message.error('没有权限执行此操作')
      }
      else {
        message.error(error?.message ?? '更新失败，请稍后重试')
      }
    }
  }

  const handleDelete = (config: OrderbookPairConfigResponse) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除配置「${config.pairId}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteOrderbookConfig(config.id)
          message.success('删除成功')
          await loadConfigs()
        }
        catch (error: any) {
          const status = error?.response?.status
          if (status === 404) {
            message.error('配置不存在，可能已被删除')
            await loadConfigs() // Refresh list
          }
          else if (status === 409) {
            message.error('无法删除：该配置正在被活跃任务使用')
          }
          else if (status === 403) {
            message.error('没有权限执行此操作')
          }
          else {
            message.error(error?.message ?? '删除失败，请稍后重试')
          }
        }
      },
    })
  }

  return (
    <div className="page-container">
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Card
          title="订单薄数据拉取配置"
          extra={(
            <Button type="primary" onClick={() => setCreateModalOpen(true)}>
              新建配置
            </Button>
          )}
        >
          <Table<OrderbookPairConfigResponse>
            loading={loading}
            dataSource={configs}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            scroll={{ x: 1400 }}
            columns={[
              {
                title: '交易对ID',
                dataIndex: 'pairId',
                fixed: 'left',
                width: 220,
              },
              {
                title: '交易所',
                dataIndex: 'venue',
                width: 120,
              },
              {
                title: '符号',
                dataIndex: 'symbol',
                width: 120,
              },
              {
                title: '类型',
                dataIndex: 'venueType',
                width: 80,
                render: value => (
                  <Tag color={value === 'CEX' ? 'blue' : 'green'}>{value}</Tag>
                ),
              },
              {
                title: '品种',
                dataIndex: 'instrumentType',
                width: 100,
                render: value => <Tag>{value}</Tag>,
              },
              {
                title: '状态',
                dataIndex: 'enabled',
                width: 80,
                render: value => (
                  <Tag color={value ? 'success' : 'default'}>
                    {value ? '启用' : '禁用'}
                  </Tag>
                ),
              },
              {
                title: '拉取频率(秒)',
                dataIndex: 'pullIntervalSeconds',
                width: 120,
                render: value => value ?? '默认',
              },
              {
                title: '深度档位',
                dataIndex: 'depthLevels',
                width: 100,
                render: value => value ?? '默认',
              },
              {
                title: '优先级',
                dataIndex: 'priority',
                width: 80,
              },
              {
                title: '备注',
                dataIndex: 'description',
                width: 150,
                ellipsis: true,
                render: value => value || '-',
              },
              {
                title: '操作',
                fixed: 'right',
                width: 210,
                render: (_, record) => (
                  <Space>
                    <Button type="link" size="small" onClick={() => { void openViewModal(record) }}>
                      查看
                    </Button>
                    <Button type="link" size="small" onClick={() => openEditModal(record)}>
                      编辑
                    </Button>
                    <Button
                      type="link"
                      size="small"
                      danger
                      onClick={() => handleDelete(record)}
                    >
                      删除
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Space>

      {/* 创建配置 Modal */}
      <Modal
        title="新建订单薄配置"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => createForm.submit()}
        okText="创建"
        width={700}
      >
        <Form
          layout="vertical"
          form={createForm}
          onFinish={handleCreateConfig}
        >
          <Form.Item
            label="交易对ID"
            name="pairId"
            rules={[
              { required: true, message: '请输入交易对ID' },
              {
                pattern: /^[A-Z0-9]+\.[A-Z0-9_]+\.(SPOT|PERPETUAL|FUTURE)$/,
                message: '格式应为: SYMBOL.VENUE.TYPE (如: BTCUSDT.BINANCE.SPOT, ETHUSDT.UNISWAP_V3.SPOT)',
              },
            ]}
            tooltip="例如：BTCUSDT.BINANCE.SPOT 或 ETHUSDT.UNISWAP_V3.SPOT"
          >
            <Input placeholder="BTCUSDT.BINANCE.SPOT" />
          </Form.Item>
          <Form.Item
            label="交易所/DEX"
            name="venue"
            rules={[{ required: true, message: '请输入交易所标识' }]}
            tooltip="例如：BINANCE, OKX, UNISWAP_V3"
          >
            <Select
              placeholder="请选择交易所"
              loading={venueLoading}
              options={venues.map((v) => ({
                label: `${v.name ?? v.code} (${v.code})`,
                value: v.code,
                disabled: !v.enabled,
              }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            label="交易对符号"
            name="symbol"
            rules={[{ required: true, message: '请输入交易对符号' }]}
          >
            <Input placeholder="BTCUSDT" />
          </Form.Item>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              label="基础资产"
              name="baseAsset"
              rules={[{ required: true, message: '请输入基础资产' }]}
              style={{ width: 150 }}
            >
              <Input placeholder="BTC" />
            </Form.Item>
            <Form.Item
              label="计价资产"
              name="quoteAsset"
              rules={[{ required: true, message: '请输入计价资产' }]}
              style={{ width: 150 }}
            >
              <Input placeholder="USDT" />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              label="场所类型"
              name="venueType"
              rules={[{ required: true, message: '请选择场所类型' }]}
              style={{ width: 200 }}
            >
              <Select options={venueTypeOptions} placeholder="选择类型" />
            </Form.Item>
            <Form.Item
              label="品种类型"
              name="instrumentType"
              rules={[{ required: true, message: '请选择品种类型' }]}
              style={{ width: 200 }}
            >
              <Select options={instrumentTypeOptions} placeholder="选择品种" />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item label="拉取频率（秒）" name="pullIntervalSeconds" style={{ width: 150 }}>
              <InputNumber placeholder="留空使用默认" min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="深度档位" name="depthLevels" style={{ width: 150 }}>
              <InputNumber placeholder="留空使用默认" min={5} max={500} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="优先级" name="priority" initialValue={100} style={{ width: 120 }}>
              <InputNumber min={1} max={1000} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item label="是否启用" name="enabled" valuePropName="checked" initialValue>
            <Switch />
          </Form.Item>
          <Form.Item label="备注说明" name="description">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑配置 Modal */}
      <Modal
        title={editingConfig ? `编辑：${editingConfig.pairId}` : '编辑配置'}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleEditSubmit}
        okText="保存"
        width={600}
      >
        <Form layout="vertical" form={editForm}>
          <Form.Item label="拉取频率（秒）" name="pullIntervalSeconds">
            <InputNumber placeholder="留空使用默认" min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="深度档位" name="depthLevels">
            <InputNumber placeholder="留空使用默认" min={5} max={500} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="优先级" name="priority">
            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="是否启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="备注说明" name="description">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看订单薄 Modal（实时数据，如果 Redis 中存在对应订单薄快照） */}
      <Modal
        title={viewingConfig ? `订单薄预览：${viewingConfig.pairId}` : '订单薄预览'}
        open={viewModalOpen}
        onCancel={() => {
          // 标记当前查看请求已失效，避免异步结果在关闭后重新打开弹窗或覆盖状态
          viewRequestIdRef.current += 1
          setViewModalOpen(false)
          setViewingConfig(null)
          setOrderbookPreview(null)
          setViewError(null)
          setViewLoading(false)
        }}
        footer={null}
        width={900}
      >
        {viewingConfig && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small" title="基础信息">
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Space size={24}>
                  <span>交易对：{viewingConfig.baseAsset}/{viewingConfig.quoteAsset}</span>
                  <span>交易所：{viewingConfig.venue}</span>
                  <span>类型：{viewingConfig.instrumentType}</span>
                  <span>深度档位：{viewingConfig.depthLevels ?? '默认'}</span>
                </Space>
                {orderbookPreview && (
                  <Space size={24}>
                    <span>
                      交易所时间：
                      {orderbookPreview.exchangeTs
                        ? new Date(orderbookPreview.exchangeTs).toLocaleString()
                        : '未知'}
                    </span>
                    <span>
                      系统接收时间：
                      {orderbookPreview.receivedTs
                        ? new Date(orderbookPreview.receivedTs).toLocaleString()
                        : '未知'}
                    </span>
                  </Space>
                )}
              </Space>
            </Card>

            {viewLoading ? (
              <Card size="small">
                <div style={{ textAlign: 'center', padding: 24 }}>正在加载订单薄数据...</div>
              </Card>
            ) : viewError ? (
              <Card size="small">
                <div style={{ color: '#faad14' }}>{viewError}</div>
              </Card>
            ) : orderbookPreview ? (
              <Card size="small" title="订单薄（实时数据）">
                <Space size={24} style={{ width: '100%' }} align="start">
                  <div style={{ flex: 1 }}>
                    <h4 style={{ marginBottom: 8 }}>卖盘（Ask）</h4>
                    <Table
                      size="small"
                      pagination={false}
                      dataSource={(orderbookPreview.asks ?? []).map((row, index) => ({
                        key: index,
                        ...row,
                      }))}
                      columns={[
                        {
                          title: '价格',
                          dataIndex: 'price',
                          render: (v: number) => v.toFixed(4),
                        },
                        {
                          title: `数量（${viewingConfig.baseAsset}）`,
                          dataIndex: 'size',
                        },
                      ]}
                      scroll={{ y: 260 }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ marginBottom: 8 }}>买盘（Bid）</h4>
                    <Table
                      size="small"
                      pagination={false}
                      dataSource={(orderbookPreview.bids ?? []).map((row, index) => ({
                        key: index,
                        ...row,
                      }))}
                      columns={[
                        {
                          title: '价格',
                          dataIndex: 'price',
                          render: (v: number) => v.toFixed(4),
                        },
                        {
                          title: `数量（${viewingConfig.baseAsset}）`,
                          dataIndex: 'size',
                        },
                      ]}
                      scroll={{ y: 260 }}
                    />
                  </div>
                </Space>
              </Card>
            ) : (
              <Card size="small">
                <div>暂无订单薄数据</div>
              </Card>
            )}
          </Space>
        )}
      </Modal>
    </div>
  )
}

