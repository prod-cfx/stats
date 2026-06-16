export interface CompletedTradeKeyInput {
  asset: string
  exitPrice: string
  fee: string
  fillId: string
  fillTime: number
  side: string
  size: string
}

export interface CompletedTradeFillIdInput {
  hash: string
  tid: number
  time: number
}

export const makeCompletedTradeFillId = ({ tid }: CompletedTradeFillIdInput) => String(tid)

export const makeCompletedTradeKey = ({
  asset,
  exitPrice,
  fee,
  fillId,
  fillTime,
  side,
  size,
}: CompletedTradeKeyInput) => `${fillId}:${fillTime}:${asset}:${side}:${size}:${exitPrice}:${fee}`
