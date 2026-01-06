'use client'

import type {
  CreateTradesPairConfigPayload,
  MarketTradeResponse,
  TradesPairConfigResponse,
  UpdateTradesPairConfigPayload,
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
import { useCallback, useEffect, useReducer } from 'react'
import {
  createTradesConfig,
  deleteTradesConfig,
  fetchTradesConfigs,
  getLatestTrades,
  updateTradesConfig,
} from '@/lib/api'
import { parseMetadataField, stringifyMetadata } from '@/lib/metadata-parser'
import { initialState, tradesConfigPageReducer } from './types'

const instrumentTypeOptions = [
  { label: '现货 (SPOT)', value: 'SPOT' },
  { label: '永续合约 (PERPETUAL)', value: 'PERPETUAL' },
  { label: '期货 (FUTURE)', value: 'FUTURE' },
]

const exchangeOptions = [
  { label: 'OKX', value: 'OKX' },
  { label: 'Binance', value: 'BINANCE' },
  { label: 'Bybit', value: 'BYBIT' },
]

export default function TradesConfigsPage() {
  const { message, modal } = App.useApp()
  const [state, dispatch] = useReducer(tradesConfigPageReducer, initialState)
  const [createForm] = Form.useForm<CreateTradesPairConfigPayload>()
  const [editForm] = Form.useForm<UpdateTradesPairConfigPayload>()

  const loadConfigs = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const data = await fetchTradesConfigs()
      dispatch({ type: 'SET_CONFIGS', payload: data })
    }
    catch (error: any) {
      message.error(error?.message ?? '获取配置失败')
    }
    finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [message])

  useEffect(() => {
    void loadConfigs()
  }, [loadConfigs])

  const handleCreateConfig = async (values: CreateTradesPairConfigPayload) => {
    try {
      // 使用工具函数解析 metadata
      const payload = { ...values }
      if (payload.metadata !== undefined) {
        try {
          payload.metadata = parseMetadataField(payload.metadata)
        } catch (error) {
          message.error(error instanceof Error ? error.message : '扩展配置格式错误')
          return
        }
      }
      
      await createTradesConfig(payload)
      message.success('配置创建成功')
      dispatch({ type: 'CLOSE_CREATE_MODAL' })
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

  const openEditModal = (config: TradesPairConfigResponse) => {
    dispatch({ type: 'OPEN_EDIT_MODAL', payload: config })
    editForm.setFieldsValue({
      enabled: config.enabled,
      priority: config.priority,
      description: config.description ?? '',
      metadata: stringifyMetadata(config.metadata, true), // 使用工具函数格式化 JSON
    })
  }

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields()
      if (!state.editingConfig)
        return
      
      const payload: any = {
        enabled: values.enabled,
        priority: values.priority,
        description: values.description || null,
      }
      
      // 使用工具函数处理 metadata
      try {
        const parsedMetadata = parseMetadataField(values.metadata)
        if (parsedMetadata === undefined) {
          payload.metadata = null // 空值转为 null
        } else {
          payload.metadata = parsedMetadata
        }
      } catch (error) {
        message.error(error instanceof Error ? error.message : '扩展配置格式错误')
        return
      }
      
      await updateTradesConfig(state.editingConfig.id, payload)
      message.success('配置已更新')
      dispatch({ type: 'CLOSE_EDIT_MODAL' })
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

  const handleViewData = async (config: TradesPairConfigResponse) => {
    dispatch({ type: 'OPEN_DATA_VIEW_MODAL', payload: config })
    
    try {
      const data = await getLatestTrades({
        exchange: config.exchange,
        instrumentType: config.instrumentType,
        symbol: config.symbol,
        limit: 50,
      })
      dispatch({ type: 'SET_TRADES_DATA', payload: data })
    }
    catch (error: any) {
      message.error(error?.message ?? '加载交易数据失败')
      dispatch({ type: 'SET_TRADES_DATA', payload: [] })
    }
    finally {
      dispatch({ type: 'SET_TRADES_LOADING', payload: false })
    }
  }

  const handleDelete = (config: TradesPairConfigResponse) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除配置「${config.pairId}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteTradesConfig(config.id)
          message.success('删除成功')
          await loadConfigs()
        }
        catch (error: any) {
          const status = error?.response?.status
          if (status === 404) {
            message.error('配置不存在，可能已被删除')
            await loadConfigs()
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
          title="交易记录订阅配置"
          extra={(
            <Button type="primary" onClick={() => dispatch({ type: 'OPEN_CREATE_MODAL' })}>
              新建配置
            </Button>
          )}
        >
          <Table<TradesPairConfigResponse>
            loading={state.loading}
            dataSource={state.configs}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            scroll={{ x: 1450 }}
            columns={[
              {
                title: '交易对ID',
                dataIndex: 'pairId',
                fixed: 'left',
                width: 220,
              },
              {
                title: '交易所',
                dataIndex: 'exchange',
                width: 100,
              },
              {
                title: '符号',
                dataIndex: 'symbol',
                width: 150,
              },
              {
                title: '品种',
                dataIndex: 'instrumentType',
                width: 120,
                render: value => <Tag>{value}</Tag>,
              },
              {
                title: '基础/计价',
                width: 120,
                render: (_, record) => `${record.baseAsset}/${record.quoteAsset}`,
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
                title: '扩展配置',
                dataIndex: 'metadata',
                width: 200,
                ellipsis: true,
                render: value => {
                  if (!value) return '-'
                  try {
                    return (
                      <code style={{ fontSize: '12px', color: '#666' }}>
                        {JSON.stringify(value)}
                      </code>
                    )
                  }
                  catch {
                    return '-'
                  }
                },
              },
              {
                title: '操作',
                fixed: 'right',
                width: 200,
                render: (_, record) => (
                  <Space>
                    <Button type="link" size="small" onClick={() => handleViewData(record)}>
                      查看数据
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
        title="新建交易记录订阅配置"
        open={state.modals.create}
        onCancel={() => dispatch({ type: 'CLOSE_CREATE_MODAL' })}
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
                pattern: /^[A-Z0-9\-]+\.[A-Z0-9_]+\.(SPOT|PERPETUAL|FUTURE)$/,
                message: '格式应为: SYMBOL.EXCHANGE.TYPE (如: BTC-USDT.OKX.SPOT)',
              },
            ]}
            tooltip="例如：BTC-USDT.OKX.SPOT 或 BTC-USDT-SWAP.OKX.PERPETUAL"
          >
            <Input placeholder="BTC-USDT.OKX.SPOT" />
          </Form.Item>
          <Form.Item
            label="交易所"
            name="exchange"
            rules={[{ required: true, message: '请选择交易所' }]}
          >
            <Select options={exchangeOptions} placeholder="选择交易所" />
          </Form.Item>
          <Form.Item
            label="交易对符号"
            name="symbol"
            rules={[{ required: true, message: '请输入交易对符号' }]}
            tooltip="与交易所实际使用的符号一致，如 BTC-USDT 或 BTC-USDT-SWAP"
          >
            <Input placeholder="BTC-USDT" />
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
              label="品种类型"
              name="instrumentType"
              rules={[{ required: true, message: '请选择品种类型' }]}
              style={{ width: 200 }}
            >
              <Select options={instrumentTypeOptions} placeholder="选择品种" />
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
          <Form.Item 
            label="扩展配置 (JSON)" 
            name="metadata" 
            tooltip="存储交易所特定参数，如 okxInstId"
            rules={[
              {
                validator: async (_, value) => {
                  if (!value) return
                  try {
                    JSON.parse(value)
                  }
                  catch {
                    throw new Error('请输入有效的 JSON 格式')
                  }
                },
              },
            ]}
          >
            <Input.TextArea 
              rows={3} 
              placeholder='示例: {"okxInstId": "BTC-USDT-SWAP"}' 
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑配置 Modal */}
      <Modal
        title={state.editingConfig ? `编辑：${state.editingConfig.pairId}` : '编辑配置'}
        open={state.modals.edit}
        onCancel={() => dispatch({ type: 'CLOSE_EDIT_MODAL' })}
        onOk={handleEditSubmit}
        okText="保存"
        width={600}
      >
        <Form layout="vertical" form={editForm}>
          <Form.Item label="优先级" name="priority">
            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="是否启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="备注说明" name="description">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
          <Form.Item 
            label="扩展配置 (JSON)" 
            name="metadata"
            rules={[
              {
                validator: async (_, value) => {
                  if (!value) return
                  try {
                    JSON.parse(value)
                  }
                  catch {
                    throw new Error('请输入有效的 JSON 格式')
                  }
                },
              },
            ]}
          >
            <Input.TextArea 
              rows={3} 
              placeholder='示例: {"okxInstId": "BTC-USDT-SWAP"}' 
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 数据查看 Modal */}
      <Modal
        title={state.viewingConfig ? `查看数据：${state.viewingConfig.pairId}` : '查看数据'}
        open={state.modals.dataView}
        onCancel={() => dispatch({ type: 'CLOSE_DATA_VIEW_MODAL' })}
        width={1000}
        footer={[
          <Button key="refresh" onClick={() => state.viewingConfig && handleViewData(state.viewingConfig)}>
            刷新
          </Button>,
          <Button key="close" onClick={() => dispatch({ type: 'CLOSE_DATA_VIEW_MODAL' })}>
            关闭
          </Button>,
        ]}
      >
        <Table<MarketTradeResponse>
          loading={state.tradesLoading}
          dataSource={state.tradesData}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
          columns={[
            {
              title: 'ID',
              dataIndex: 'tradeId',
              width: 120,
              ellipsis: true,
            },
            {
              title: '价格',
              dataIndex: 'price',
              width: 120,
              align: 'right',
              render: value => Number(value).toFixed(2),
            },
            {
              title: '数量',
              dataIndex: 'size',
              width: 120,
              align: 'right',
              render: value => Number(value).toFixed(4),
            },
            {
              title: '方向',
              dataIndex: 'side',
              width: 80,
              render: value => (
                <Tag color={value === 'buy' ? 'green' : 'red'}>
                  {value === 'buy' ? '买' : '卖'}
                </Tag>
              ),
            },
            {
              title: '时间',
              dataIndex: 'tradeTimestamp',
              width: 180,
              render: value => {
                const date = new Date(Number(value))
                return date.toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              },
            },
            {
              title: '交易所',
              dataIndex: 'exchange',
              width: 100,
            },
            {
              title: '品种',
              dataIndex: 'instrumentType',
              width: 100,
              render: value => <Tag>{value}</Tag>,
            },
          ]}
        />
        {state.tradesData.length === 0 && !state.tradesLoading && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            暂无交易数据，可能该配置尚未开始订阅或交易所暂无数据
          </div>
        )}
      </Modal>
    </div>
  )
}

