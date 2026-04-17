import type { StrategyLogicGraph } from './logic-graph-model'
import type { DisplayBlock, DisplayLogicGraph } from './display-logic-graph'
import { DisplayLogicGraphPreview } from './DisplayLogicGraphPreview'

interface LogicGraphPreviewProps {
  graph: StrategyLogicGraph
  onConfirm: () => void
  onRevise: () => void
  confirmDisabled?: boolean
}

function formatLegacyConditionText(subject: string, operator: string, value: string) {
  const parts = [subject, operator]
  if (value && value !== 'true') parts.push(value)
  return parts.join(' ')
}

function buildDisplayGraph(graph: StrategyLogicGraph): DisplayLogicGraph {
  const conditions = graph.trigger.length > 0
    ? graph.trigger.map((trigger, index) => ({
        kind: 'condition' as const,
        id: trigger.id,
        text: `${index > 0 && trigger.join ? `${trigger.join} ` : ''}${formatLegacyConditionText(trigger.subject, trigger.operator, trigger.value)}`,
      }))
    : [{
        kind: 'condition' as const,
        id: 'condition-fallback',
        text: '条件待补充',
      }]

  const actions = graph.actions.map(action => ({
    kind: 'action' as const,
    id: action.id,
    text: `${action.action} ${action.amount} 的 ${action.target}`,
  }))

  const executeItems = [
    {
      key: 'exchange',
      value: graph.meta.exchange.toUpperCase(),
      text: `交易所: ${graph.meta.exchange.toUpperCase()}`,
      id: 'execute-exchange',
      kind: 'execute',
    },
    {
      key: 'symbol',
      value: graph.meta.symbol,
      text: `标的: ${graph.meta.symbol}`,
      id: 'execute-symbol',
      kind: 'execute',
    },
    {
      key: 'timeframe',
      value: graph.meta.timeframe,
      text: `周期: ${graph.meta.timeframe}`,
      id: 'execute-timeframe',
      kind: 'execute',
    },
    ...(graph.meta.executionTags?.map((tag, index) => ({
      key: 'executionTag',
      value: tag,
      text: `标签: ${tag}`,
      id: `execute-tag-${index}`,
      kind: 'execute',
    })) ?? []),
    ...graph.risk.map((item, index) => ({
      key: 'risk',
      value: item,
      text: `风险: ${item}`,
      id: `execute-risk-${index}`,
      kind: 'execute',
    })),
  ]

  const blocks: DisplayBlock[] = [
    {
      type: 'IF',
      items: [
        ...conditions,
        ...actions,
      ],
    },
    {
      type: 'EXECUTE',
      items: executeItems,
    },
  ]

  return { blocks }
}

export function LogicGraphPreview({
  graph,
  onConfirm,
  onRevise,
  confirmDisabled = false,
}: LogicGraphPreviewProps) {
  return (
    <DisplayLogicGraphPreview
      graph={buildDisplayGraph(graph)}
      onConfirm={onConfirm}
      onRevise={onRevise}
      confirmDisabled={confirmDisabled}
      confirmed={graph.status === 'confirmed'}
    />
  )
}
