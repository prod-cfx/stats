export const maGoldenCase = {
  message: 'OKX 现货 BTCUSDT 15m；入场：15m 收盘确认当价格突破 MA50 时买入；出场：15m 收盘确认当价格跌破 MA10 时卖出；风控：亏损 5% 止损，盈利 10% 止盈；仓位：单笔 10%。',
  expectedDigestPattern: /^sha256:/,
}

export const bollingerGoldenCase = {
  message: 'OKX 合约 BTCUSDT 15m；K线收盘后确认突破布林带(30,2.5)上轨时做空；价格回到布林带中轨(MA30)时平空；单笔 10%。',
  expectedDigestPattern: /^sha256:/,
}
