import type { BarSeriesOption, LineSeriesOption, PieSeriesOption } from 'echarts/charts'
import type {
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  MarkLineComponentOption,
  TooltipComponentOption,
} from 'echarts/components'
import type { ComposeOption } from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components'
import {
  connect,
  disconnect,
  dispose,
  graphic,
  getInstanceByDom,
  init,
  use as registerEChartsModules,
} from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

registerEChartsModules([
  BarChart,
  LineChart,
  PieChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
])

export const echarts = {
  connect,
  disconnect,
  dispose,
  graphic,
  getInstanceByDom,
  init,
}

export type AppEChartsOption = ComposeOption<
  | BarSeriesOption
  | DataZoomComponentOption
  | GridComponentOption
  | LegendComponentOption
  | LineSeriesOption
  | MarkLineComponentOption
  | PieSeriesOption
  | TooltipComponentOption
>
