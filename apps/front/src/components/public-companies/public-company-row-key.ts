export interface PublicCompanyRowKeyInput {
  asset: string
  exchange: string
  ticker: string
}

export const makePublicCompanyRowKey = ({ asset, exchange, ticker }: PublicCompanyRowKeyInput) =>
  `${ticker}:${exchange}:${asset}`
