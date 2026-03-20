# Hyperliquid 交易所适配器

## 概述

该适配器基于 `@nktkas/hyperliquid` SDK，实现 Hyperliquid 现货与永续合约交易能力，并接入统一交易接口。

## 当前特性

- 支持现货与永续合约
- 支持限价单与市价单模拟实现
- 支持订单查询与取消
- 支持持仓、余额、行情查询
- 使用 Agent 私钥签名
- 支持测试网与主网切换

## 约束

- 支持 `marketType: 'spot' | 'perp'`
- 创建账户时会校验凭据有效性
- 市价单通过 IOC 限价单方式模拟实现

市场语义约定：

- `spot` 使用 `BASE/QUOTE`，如 `BTC/USDC`
- `perp` 使用 `BASE/QUOTE:PERP`，如 `BTC/USDC:PERP`
- `spot` 余额来自 `spotClearinghouseState`
- `perp` 余额来自 `clearinghouseState`
- `spot` 不返回持仓，`fetchPositions()` 固定为空数组

## 配置说明

- `mainWalletAddress`：主钱包地址
- `agentPrivateKey`：Agent 私钥
- `isTestnet`：是否连接测试网

主账户交易约定：

- 使用主账户地址作为账户归属与查询地址
- 使用 API/Agent 私钥做签名
- 不传 `defaultVaultAddress`

只有代表子账户或 vault 交易时，才应显式传入对应的 vault/subaccount 地址。

## 调试建议

- 先验证 Agent 是否已被主钱包授权
- 再检查网络选择是否正确
- spot/perp 映射异常时，优先核对 symbol 形状是否符合上述约定
- 若订单异常，优先查看交易所返回的错误消息与映射结果
