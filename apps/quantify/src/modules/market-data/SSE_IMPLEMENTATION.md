# 甯傚満鏁版嵁 SSE 瀹炵幇鏂囨。

## 姒傝堪

鏈疄鐜颁负鍐呴儴娑堣垂鑰呮彁渚涘熀浜?Server-Sent Events (SSE) 鐨勫疄鏃?ticker 鎺ㄩ€佽兘鍔涖€?

## 鏋舵瀯

```text
Binance WebSocket
  -> MarketDataIngestionService
  -> MarketDataStreamService
  -> EventEmitter2
  -> MarketDataController (SSE)
  -> Internal SSE consumer
```

## 鍏抽敭鐐?

- `MarketDataIngestionService` 鎺ユ敹骞朵繚瀛樿鎯?
- `MarketDataStreamService` 璐熻矗骞挎挱浜嬩欢
- `MarketDataController` 灏嗗唴閮ㄤ簨浠惰浆鎹㈡垚绋冲畾鐨?SSE 鏁版嵁鏍煎紡
- 鎺ュ彛瀹氫綅涓哄彲淇＄幆澧冨唴閮ㄤ娇鐢紝涓嶅啀渚濊禆娴忚鍣ㄥ墠绔涔?

## 娴嬭瘯

```bash
curl -N http://localhost:3000/api/v1/market/stream/ticker
```

## 鎵╁睍鏂瑰悜

- 鎸変氦鏄撳璁㈤槄
- 蹇冭烦涓庢柇绾挎仮澶?
- 涓嬫父闄愭祦
- 澶氬疄渚嬪箍鎾?
