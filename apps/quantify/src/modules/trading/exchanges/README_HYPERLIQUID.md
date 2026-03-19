# Hyperliquid 交易所适配器

## 概述

该适配器基于 `@nktkas/hyperliquid` SDK，实现 Hyperliquid 永续合约交易能力，并接入统一交易接口。

## 当前特性

- 支持永续合约
- 支持限价单与市价单模拟实现
- 支持订单查询与取消
- 支持持仓、余额、行情查询
- 使用 Agent 私钥签名
- 支持测试网与主网切换

## 约束

- 仅支持 `marketType: 'perp'`
- 创建账户时会校验凭据有效性
- 市价单通过 IOC 限价单方式模拟实现

## 配置说明

- `mainWalletAddress`：主钱包地址
- `agentPrivateKey`：Agent 私钥
- `isTestnet`：是否连接测试网

## 调试建议

- 先验证 Agent 是否已被主钱包授权
- 再检查网络选择是否正确
- 若订单异常，优先查看交易所返回的错误消息与映射结果
