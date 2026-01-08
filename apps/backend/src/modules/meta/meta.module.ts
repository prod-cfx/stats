import { Module } from '@nestjs/common'

/**
 * MetaModule
 *
 * 说明：
 * - 当前仅作为占位模块使用，用于满足 AppModule 中的依赖装配
 * - 后续如果需要暴露系统元信息（版本号、构建信息、特性开关等），可以在此模块下新增 controller/service
 */
@Module({})
export class MetaModule {}

