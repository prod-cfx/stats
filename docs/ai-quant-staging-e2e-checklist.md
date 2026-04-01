# AI Quant Staging E2E Checklist

## 环境
- 页面地址：`https://cfx-www-staging.devbase.cloud/zh/ai-quant`
- 量化 API：`https://cfx-quantify-staging.devbase.cloud/api/v1`
- 验收日期：
- 验收人：

## API 验收
1. 导出环境变量：
```bash
export AI_QUANT_API_BASE_URL="https://cfx-quantify-staging.devbase.cloud/api/v1"
export AI_QUANT_JWT_TOKEN="<jwt>"
export AI_QUANT_USER_ID="<optional-user-id>"
```
2. 运行脚本：
```bash
node apps/front/scripts/ai-quant-staging-e2e-check.mjs
```
3. 记录结果：
- requestId:
- capabilities status/code/stage:
- codegen-start status/code/stage:
- codegen-continue status/code/stage:

## 前端手工验收
1. 打开 AI Quant 页面并登录。
2. 新建会话并输入策略需求。
3. 确认生成策略。
4. 执行回测。
5. 发起部署。

记录项：
- 能力加载是否成功（若失败记录 code/stage/requestId）：
- 策略生成是否成功（若失败记录 code/stage/requestId）：
- 回测是否成功（若失败记录 code/stage/requestId）：
- 部署是否成功（若失败记录 code/stage/requestId）：

## 通过标准
- 不出现仅有“HTTP 502”的无语义报错。
- 任一失败都可提取 `code + stage + requestId`。
- 至少完成一次完整链路（会话 -> 生成 -> 回测 -> 部署）或给出明确失败阶段。
