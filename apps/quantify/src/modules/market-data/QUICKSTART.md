# 甯傚満鏁版嵁 SSE 蹇€熷紑濮?

## 1. 鍚姩鏈嶅姟

鎵€鏈夊懡浠ら兘浠庝粨搴撴牴鐩綍鎵ц锛?

```bash
dx db generate
dx start backend --dev
```

## 2. 寤虹珛 SSE 杩炴帴

浣跨敤浠绘剰鏀寔 SSE 鐨勫唴閮ㄥ鎴风杩炴帴锛?

```bash
curl -N http://localhost:3000/api/v1/market/stream/ticker
```

濡傛灉鏈嶅姟宸插紑濮嬫帴鏀惰鎯呮暟鎹紝浣犱細鎸佺画鐪嬪埌绫讳技锛?

```text
data: {"symbol":"BTCUSDT","lastPrice":"60020.11",...}
```

## 3. 璋冪敤鏂规帴鍏ュ缓璁?

- 鍐呴儴妯″潡鍙洿鎺ヤ娇鐢ㄦ爣鍑?SSE 瀹㈡埛绔簱娑堣垂璇ョ鐐?
- 璋冪敤鏂硅嚜琛岃礋璐ｉ噸杩炪€佽妭娴佸拰涓嬫父鍒嗗彂
- 褰撳墠鏈嶅姟涓嶅啀鎻愪緵娴忚鍣ㄥ墠绔笓鐢ㄧ殑鎺ュ叆璇存槑鎴?CORS 閰嶇疆
