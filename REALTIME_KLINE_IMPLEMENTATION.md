# 实时 K线推送功能实现文档

## 概述

实现了基于 WebSocket 的实时 K线数据推送功能，前端通过 Socket.IO 连接后端，后端连接 Binance WebSocket 获取实时数据并推送给前端客户端。

## 架构设计

```
Binance WebSocket → BinanceWsService → KlineGateway → Socket.IO → 前端 TradingView
```

## 后端实现

### 1. Binance WebSocket 连接池服务

**文件**: `apps/backend/src/modules/kline/binance-ws.service.ts`

**核心功能**:

- 管理 Binance WebSocket 连接池（`Map<SubscriptionKey, BinanceConnection>`）
- 引用计数：多客户端订阅同一 symbol+interval 只建一个 Binance 连接
- 自动重连机制（最多 5 次，延迟递增：1s, 2s, 4s, 8s, 16s）
- 连接清理：最后一个客户端取消订阅时关闭 Binance 连接

**关键方法**:

```typescript
subscribe(symbol: string, interval: string, callback: (bar: KlineBarDto) => void): void
unsubscribe(symbol: string, interval: string, callback: (bar: KlineBarDto) => void): void
```

**Binance WebSocket URL**:

```
wss://stream.binance.com:9443/ws/<symbol>@kline_<interval>
例如: wss://stream.binance.com:9443/ws/btcusdt@kline_1m
```

### 2. WebSocket Gateway

**文件**: `apps/backend/src/modules/kline/kline.gateway.ts`

**核心功能**:

- 使用 `@WebSocketGateway` 装饰器，namespace 为 `/kline`
- 监听客户端 `subscribe`/`unsubscribe` 事件
- 管理客户端订阅列表（`Map<clientId, Set<subscriptionKey>>`）
- 客户端断开时自动清理所有订阅

**事件处理**:

```typescript
@SubscribeMessage('subscribe')
handleSubscribe(client: Socket, payload: KlineSubscriptionDto)

@SubscribeMessage('unsubscribe')
handleUnsubscribe(client: Socket, payload: KlineSubscriptionDto)

@OnGatewayDisconnect()
handleDisconnect(client: Socket)
```

**推送事件**:

- `subscribed`: 订阅成功确认
- `kline`: 实时 K线数据推送
- `unsubscribed`: 取消订阅确认

### 3. DTO 定义

**文件**: `apps/backend/src/modules/kline/dto/kline-subscription.dto.ts`

```typescript
export class KlineSubscriptionDto {
  @IsString()
  symbol: string // 例如: BTCUSDT

  @IsIn(['1m', '5m', '15m', '1h', '4h', '1d'])
  interval: string
}
```

### 4. 模块注册

**文件**: `apps/backend/src/modules/kline/kline.module.ts`

```typescript
@Module({
  controllers: [KlineController],
  providers: [KlineService, KlineGateway, BinanceWsService],
  exports: [KlineService],
})
export class KlineModule {}
```

## 前端实现

### 更新 mockDatafeed.ts

**文件**: `apps/front/src/components/tradingview/mockDatafeed.ts`

**核心功能**:

- 使用 `socket.io-client` 连接后端 WebSocket
- `subscribeBars`: 创建 Socket.IO 连接，发送订阅请求，监听实时 K线数据
- `unsubscribeBars`: 发送取消订阅请求，断开连接

**WebSocket 连接配置**:

```typescript
import { getWsBaseUrl } from '@/lib/ws'

const wsBaseUrl = getWsBaseUrl()
const socket = io(`${wsBaseUrl}/kline`, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
})
```

**getWsBaseUrl() 规则**:
- 优先级：`NEXT_PUBLIC_WS_URL` → `NEXT_PUBLIC_API_SERVER_URL` → `http://localhost:3000`
- 自动移除尾部斜杠，避免 `//kline` 拼接问题

**事件监听**:

```typescript
socket.on('connect', () => { ... })
socket.on('subscribed', (data) => { ... })
socket.on('kline', (data) => { ... })
socket.on('unsubscribed', (data) => { ... })
socket.on('connect_error', (error) => { ... })
socket.on('disconnect', (reason) => { ... })
```

## 数据流

### 订阅流程

```
1. 前端调用 subscribeBars()
   ↓
2. 创建 Socket.IO 连接到后端 /kline namespace
   ↓
3. 发送 'subscribe' 事件 { symbol: 'BTCUSDT', interval: '1m' }
   ↓
4. 后端 KlineGateway 接收订阅请求
   ↓
5. 后端调用 BinanceWsService.subscribe()
   ↓
6. BinanceWsService 检查连接池：
   - 如果已存在连接：引用计数 +1
   - 如果不存在：创建新的 Binance WebSocket 连接
   ↓
7. 后端发送 'subscribed' 确认事件
   ↓
8. Binance 推送 K线数据到后端
   ↓
9. 后端转换数据格式并推送 'kline' 事件到前端
   ↓
10. 前端接收数据，调用 onRealtimeCallback() 更新图表
```

### 取消订阅流程

```
1. 前端调用 unsubscribeBars()
   ↓
2. 发送 'unsubscribe' 事件 { symbol: 'BTCUSDT', interval: '1m' }
   ↓
3. 后端 KlineGateway 接收取消订阅请求
   ↓
4. 后端调用 BinanceWsService.unsubscribe()
   ↓
5. BinanceWsService 引用计数 -1
   ↓
6. 如果引用计数 = 0：关闭 Binance WebSocket 连接
   ↓
7. 后端发送 'unsubscribed' 确认事件
   ↓
8. 前端断开 Socket.IO 连接
```

## 关键特性

### 1. 连接池复用

多个客户端订阅同一交易对时，后端只维护一个 Binance 连接：

```typescript
// 客户端 A 订阅 BTCUSDT:1m → 创建 Binance 连接，引用计数 = 1
// 客户端 B 订阅 BTCUSDT:1m → 复用连接，引用计数 = 2
// 客户端 A 取消订阅 → 引用计数 = 1，保持连接
// 客户端 B 取消订阅 → 引用计数 = 0，关闭连接
```

### 2. 自动重连

Binance WebSocket 断开时自动重连：

```typescript
private reconnect(subscriptionKey: string, connection: BinanceConnection) {
  if (connection.reconnectAttempts >= this.maxReconnectAttempts) {
    this.logger.error(`Max reconnect attempts reached for ${subscriptionKey}`)
    return
  }

  const delay = Math.min(1000 * Math.pow(2, connection.reconnectAttempts), 30000)
  connection.reconnectAttempts++

  setTimeout(() => {
    this.createConnection(subscriptionKey, connection.callbacks)
  }, delay)
}
```

### 3. 资源清理

客户端断开时自动清理所有订阅：

```typescript
@OnGatewayDisconnect()
handleDisconnect(client: Socket) {
  const clientId = client.id
  const subscriptions = this.clientSubscriptions.get(clientId)

  if (subscriptions) {
    subscriptions.forEach((subscriptionKey) => {
      const [symbol, interval] = subscriptionKey.split(':')
      this.binanceWsService.unsubscribe(symbol, interval, ...)
    })
    this.clientSubscriptions.delete(clientId)
  }
}
```

### 4. 实时推送

K线数据实时推送给订阅的客户端：

```typescript
// Binance 数据格式
{
  "e": "kline",
  "k": {
    "t": 1672515780000,  // 开始时间
    "o": "42500.50",     // 开盘价
    "c": "42650.75",     // 收盘价
    "h": "42800.00",     // 最高价
    "l": "42300.00",     // 最低价
    "v": "1000",         // 成交量
    "x": false           // 是否完成
  }
}

// 转换为 TradingView 格式
{
  time: 1672515780000,
  open: 42500.50,
  close: 42650.75,
  high: 42800.00,
  low: 42300.00,
  volume: 1000
}
```

## 环境配置

### 后端

无需额外配置，WebSocket Gateway 自动监听在后端服务端口（默认 3000）。

### 前端

在 `.env.development.local` 或 `.env.production.local` 中配置：

```bash
# WebSocket 服务地址
NEXT_PUBLIC_WS_URL=http://localhost:3000

# 生产环境
NEXT_PUBLIC_WS_URL=https://api.yourdomain.com
```

## 测试步骤

### 1. 启动服务

```bash
# 启动后端
dx start backend --dev

# 启动前端
dx start front --dev
```

### 2. 打开浏览器

访问 TradingView 图表页面（例如：`http://localhost:3001/trading`）

### 3. 观察日志

**浏览器控制台**:

```
[subscribeBars] uid-123 { symbolInfo: {...}, resolution: '15' }
[subscribeBars] Socket.IO connected, subscribing to BTCUSDT:15m
[subscribeBars] Subscribed: { symbol: 'BTCUSDT', interval: '15m', subscriptionKey: 'BTCUSDT:15m' }
[subscribeBars] New bar: { time: 1706054400000, open: 42500, ... }
[subscribeBars] Updated bar: { time: 1706054400000, close: 42650, ... }
```

**后端日志**:

```
[KlineGateway] Client connected: socket-id-123
[KlineGateway] Subscribe request: { symbol: 'BTCUSDT', interval: '15m' }
[BinanceWsService] Creating new connection for BTCUSDT:15m
[BinanceWsService] WebSocket connected: wss://stream.binance.com:9443/ws/btcusdt@kline_15m
[BinanceWsService] Received kline data for BTCUSDT:15m
[KlineGateway] Broadcasting kline data to 1 clients
```

### 4. 验证实时更新

观察图表上的最新 K线是否实时更新（价格变化、成交量变化）。

## 故障排查

### 问题 1: 前端无法连接 WebSocket

**症状**: 浏览器控制台显示 `Socket.IO connection error`

**解决方案**:

1. 检查后端是否正常运行
2. 检查 `NEXT_PUBLIC_WS_URL` 环境变量是否正确
3. 检查防火墙/CORS 配置

### 问题 2: 后端无法连接 Binance

**症状**: 后端日志显示 `WebSocket connection failed`

**解决方案**:

1. 检查网络连接
2. 检查 Binance WebSocket 服务是否可用
3. 检查防火墙是否阻止出站连接

### 问题 3: 数据不更新

**症状**: 图表显示但不更新

**解决方案**:

1. 检查浏览器控制台是否有 `[subscribeBars] Updated bar` 日志
2. 检查后端是否正常接收 Binance 数据
3. 检查前端 `onRealtimeCallback` 是否被正确调用

## 性能优化

### 1. 连接池管理

- 使用 Map 存储连接，O(1) 查找
- 引用计数避免重复连接
- 自动清理空闲连接

### 2. 数据推送优化

- 只推送变化的数据（检查 OHLCV 是否有更新）
- 使用 Socket.IO 的 room 功能，精准推送给订阅的客户端
- 避免全局广播

### 3. 内存管理

- 客户端断开时自动清理订阅
- 连接池自动清理无引用的连接
- 使用 WeakMap 存储临时数据

## 安全考虑

### 1. CORS 配置

生产环境需要配置 CORS 白名单：

```typescript
@WebSocketGateway({
  namespace: '/kline',
  cors: {
    origin: ['https://yourdomain.com'],
    credentials: true,
  },
})
```

### 2. 速率限制

考虑添加订阅速率限制，防止滥用：

```typescript
// 每个客户端最多订阅 10 个交易对
if (subscriptions.size >= 10) {
  throw new WsException('Maximum subscriptions reached')
}
```

### 3. 认证

如果需要认证，可以在连接时验证 token：

```typescript
@OnGatewayConnection()
handleConnection(client: Socket) {
  const token = client.handshake.auth.token
  if (!this.validateToken(token)) {
    client.disconnect()
  }
}
```

## 未来优化方向

1. **多交易所支持**: 支持 OKX、Bybit 等其他交易所
2. **数据聚合**: 聚合多个交易所的数据
3. **历史数据回放**: 支持历史 K线数据回放
4. **压缩传输**: 使用 gzip 压缩 WebSocket 数据
5. **集群支持**: 使用 Redis Adapter 支持多实例部署

## 依赖版本

```json
{
  "backend": {
    "@nestjs/websockets": "^11.1.5",
    "@nestjs/platform-socket.io": "^11.1.5",
    "socket.io": "^4.8.3"
  },
  "frontend": {
    "socket.io-client": "^4.8.3"
  }
}
```

## 总结

实时 K线推送功能已完整实现，具备以下特点：

✅ 真正的实时更新（毫秒级延迟）
✅ 连接池复用，节省资源
✅ 自动重连，提高可靠性
✅ 资源自动清理，防止内存泄漏
✅ 完善的日志，便于调试
✅ 生产级别的错误处理

功能已经可以投入使用！
