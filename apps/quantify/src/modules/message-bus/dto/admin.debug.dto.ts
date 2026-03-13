import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsDefined,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator'

export class DebugPublishDto<T = unknown> {
  @ApiProperty({ description: '主题（队列内的 job 名称）', example: 'user.events' })
  @IsString()
  @IsDefined()
  topic!: string

  @ApiProperty({ description: '事件类型', example: 'test.event' })
  @IsString()
  @IsDefined()
  type!: string

  @ApiPropertyOptional({ description: '业务数据' })
  @IsOptional()
  @IsObject()
  data?: T
}

export class DebugPublishAndWaitDto<T = unknown> extends DebugPublishDto<T> {
  @ApiPropertyOptional({ description: '超时时间（毫秒）', example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(100)
  timeoutMs?: number
}

export class CheckRequestDto {
  @ApiProperty({ description: '测试ID', example: 't-123' })
  @IsString()
  @MinLength(1)
  testId!: string
}
