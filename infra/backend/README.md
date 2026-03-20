## infra/backend

用于存放「后端服务（apps/backend）」在各环境中的部署与运行配置，而不是业务代码本身。

可以在此目录维护：

- 容器编排文件（如 Kubernetes manifests / ECS task 定义 / docker-compose 等）。
- 与数据库、日志、监控系统的连接配置示例。
- 不同环境（dev / staging / prod）的部署说明。

示例结构（仅作为约定）：

```text
infra/
  backend/
    README.md             # 当前文件：说明职责与使用方式
    k8s-deployment.yaml   # 可选：后端服务部署清单
    k8s-service.yaml      # 可选：后端服务暴露方式
```

约定：

- 本目录只描述「apps/backend 如何在目标环境中运行」，不包含 TS 业务代码。
- Serverless 网关如何将请求转发到后端，由 `infra/gateway` 中的配置描述。


