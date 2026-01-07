import { Module } from '@nestjs/common'

// 占位 Meta 模块：
// - 目前仅作为 AppModule 的占位依赖，避免在生成 OpenAPI/构建时因缺少模块文件导致报错
// - 后续如果需要在此聚合元数据相关 Controller/Service，可在该模块中逐步扩展
@Module({})
export class MetaModule {}

