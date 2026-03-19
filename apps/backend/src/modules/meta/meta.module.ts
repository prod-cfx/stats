import { Module } from '@nestjs/common'

// 占位 Meta 模块：
// - 目前仅作为 AppModule 的占位依赖，避免在生成 OpenAPI/构建时因缺少模块文件导致报错
// - 后续如果需要在此聚合元数据相关 Controller/Service，可在该模块中逐步扩展
/**
 * MetaModule
 *
 * 说明：
 * - 当前仅作为占位模块使用，用于满足 AppModule 中的依赖装配
 * - 后续如果需要暴露系统元信息（版本号、构建信息、特性开关等），可以在此模块下新增 controller/service
 */
@Module({})
export class MetaModule {}

