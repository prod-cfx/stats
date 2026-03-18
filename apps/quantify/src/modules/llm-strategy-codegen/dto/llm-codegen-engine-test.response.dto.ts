import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class LlmCodegenEngineTestResponseDto {
  @ApiProperty({ description: 'LLM 提供商编码' })
  providerCode!: string

  @ApiProperty({ description: '使用的模型名' })
  model!: string

  @ApiProperty({ description: '本次引擎生成的脚本' })
  scriptCode!: string

  @ApiProperty({ description: '静态检查是否通过' })
  staticPassed!: boolean

  @ApiProperty({ description: '运行时执行是否通过' })
  runtimePassed!: boolean

  @ApiProperty({ description: '输出结构检查是否通过' })
  outputPassed!: boolean

  @ApiPropertyOptional({ description: '失败原因（若有）' })
  rejectReason?: string
}

