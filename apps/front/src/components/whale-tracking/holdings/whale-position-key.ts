export interface WhalePositionKeyInput {
  address: string
  asset: string
  entryPrice: string
  liqPrice: string
  side: string
}

export const makeWhalePositionKey = ({
  address,
  asset,
  entryPrice,
  liqPrice,
  side,
}: WhalePositionKeyInput) => `${address}:${asset}:${side}:${entryPrice}:${liqPrice}`
