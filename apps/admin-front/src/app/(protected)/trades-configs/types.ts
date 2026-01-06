/**
 * Trades Config 页面的状态管理类型定义
 */

import type { MarketTradeResponse, TradesPairConfigResponse } from '@/lib/api'

/**
 * 页面状态
 */
export interface TradesConfigPageState {
  // 配置列表
  configs: TradesPairConfigResponse[]
  loading: boolean

  // 模态框状态
  modals: {
    create: boolean
    edit: boolean
    dataView: boolean
  }

  // 编辑和查看相关
  editingConfig: TradesPairConfigResponse | null
  viewingConfig: TradesPairConfigResponse | null

  // 交易数据
  tradesData: MarketTradeResponse[]
  tradesLoading: boolean
}

/**
 * 页面操作
 */
export type TradesConfigPageAction =
  | { type: 'SET_CONFIGS'; payload: TradesPairConfigResponse[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'OPEN_CREATE_MODAL' }
  | { type: 'CLOSE_CREATE_MODAL' }
  | { type: 'OPEN_EDIT_MODAL'; payload: TradesPairConfigResponse }
  | { type: 'CLOSE_EDIT_MODAL' }
  | { type: 'OPEN_DATA_VIEW_MODAL'; payload: TradesPairConfigResponse }
  | { type: 'CLOSE_DATA_VIEW_MODAL' }
  | { type: 'SET_TRADES_DATA'; payload: MarketTradeResponse[] }
  | { type: 'SET_TRADES_LOADING'; payload: boolean }

/**
 * 初始状态
 */
export const initialState: TradesConfigPageState = {
  configs: [],
  loading: true,
  modals: {
    create: false,
    edit: false,
    dataView: false,
  },
  editingConfig: null,
  viewingConfig: null,
  tradesData: [],
  tradesLoading: false,
}

/**
 * Reducer 函数
 */
export function tradesConfigPageReducer(
  state: TradesConfigPageState,
  action: TradesConfigPageAction
): TradesConfigPageState {
  switch (action.type) {
    case 'SET_CONFIGS':
      return { ...state, configs: action.payload }

    case 'SET_LOADING':
      return { ...state, loading: action.payload }

    case 'OPEN_CREATE_MODAL':
      return { ...state, modals: { ...state.modals, create: true } }

    case 'CLOSE_CREATE_MODAL':
      return { ...state, modals: { ...state.modals, create: false } }

    case 'OPEN_EDIT_MODAL':
      return {
        ...state,
        modals: { ...state.modals, edit: true },
        editingConfig: action.payload,
      }

    case 'CLOSE_EDIT_MODAL':
      return {
        ...state,
        modals: { ...state.modals, edit: false },
        editingConfig: null,
      }

    case 'OPEN_DATA_VIEW_MODAL':
      return {
        ...state,
        modals: { ...state.modals, dataView: true },
        viewingConfig: action.payload,
        tradesData: [], // 清空旧数据
        tradesLoading: true, // 开始加载
      }

    case 'CLOSE_DATA_VIEW_MODAL':
      return {
        ...state,
        modals: { ...state.modals, dataView: false },
        viewingConfig: null,
        tradesData: [],
      }

    case 'SET_TRADES_DATA':
      return { ...state, tradesData: action.payload }

    case 'SET_TRADES_LOADING':
      return { ...state, tradesLoading: action.payload }

    default:
      return state
  }
}
