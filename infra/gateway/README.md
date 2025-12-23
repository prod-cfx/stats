## infra/gateway

用于存放「Serverless 网关 / API Gateway / Edge Functions」相关的基础设施配置，而不是业务代码。

推荐在此目录中维护：

- 网关入口域名、路径路由配置（例如：`/api/v1/**` → 后端服务地址）。
- 鉴权、限流、WAF 等与入口层相关的策略。
- 如果有 Cloudflare Workers / Lambda / Edge Functions 代码，可以：
  - 将代码放在 `apps/gateway`（作为一个独立应用），
  - 或在本目录下建立简单的 `src/` 并在这里记录部署方式。

示例结构（仅作为约定）：

```text
infra/
  gateway/
    README.md          # 当前文件：说明职责与使用方式
    api-gateway.yaml   # 可选：API Gateway / 其它 provider 的配置
```

约定：

- 业务逻辑统一在 `apps/backend` 中实现，网关层仅负责入口、安全与路由。
- 网关的实际部署流程可以通过 CI/CD 流水线调用本目录中的配置文件完成。


