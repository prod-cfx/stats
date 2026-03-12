# 甯傚満鏁版嵁 SSE 鍔熻兘鎬荤粨

## 宸插畬鎴愯兘鍔?

- 浣跨敤 `EventEmitter2` 骞挎挱瀹炴椂琛屾儏浜嬩欢
- 鍦?`MarketDataController` 鏆撮湶 `GET /market/stream/ticker`
- 琛屾儏鍏ュ簱涓?SSE 鎺ㄩ€佽В鑰?
- 淇濈暀涓哄唴閮ㄦ湇鍔℃秷璐硅璁＄殑鏍囧噯 SSE 鎺ュ彛

## 鏁版嵁娴?

```text
Binance WebSocket
  -> MarketDataIngestionService
  -> MarketDataStreamService
  -> EventEmitter2
  -> MarketDataController
  -> Internal SSE consumer
```

## 楠岃瘉鏂瑰紡

```bash
dx db generate
dx start backend --dev
curl -N http://localhost:3000/api/v1/market/stream/ticker
```

## 鍚庣画鍙€変紭鍖?

- 鎸変氦鏄撳杩囨护
- 鎺ㄩ€侀檺娴?
- 蹇冭烦鏈哄埗
- 澶氬疄渚嬪箍鎾?
