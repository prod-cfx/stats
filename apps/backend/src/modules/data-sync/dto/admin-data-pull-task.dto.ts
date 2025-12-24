import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Matches, MaxLength, Min } from 'class-validator'

export class AdminDataPullTaskListQueryDto {
  @ApiPropertyOptional({ description: '页码，从 1 开始', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ description: '每页数量', example: 20 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  limit?: number

  @ApiPropertyOptional({ description: '按任务 key 模糊搜索' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  key?: string

  @ApiPropertyOptional({ description: '按任务名称模糊搜索' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}

export class CreateAdminDataPullTaskDto {
  @ApiProperty({
    description: '任务唯一标识，应与具体 Job 的 key 保持一致',
    example: 'example.kline_1m',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[\w.:-]+$/, {
    message: 'key 仅允许字母、数字、点、下划线、冒号和短横线',
  })
  key!: string

  @ApiProperty({
    description: '任务名称（描述用途）',
    example: '示例 K 线 1m 拉取',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @ApiPropertyOptional({
    description: '数据来源标识（例如 binance、newsapi 等）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string

  @ApiPropertyOptional({
    description: '任务类型标识（例如 kline_1m、news_latest 等）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string

  @ApiPropertyOptional({
    description: 'Cron 表达式（可选），当前主要使用 intervalSeconds 调度',
    example: '*/5 * * * *',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cron?: string

  @ApiPropertyOptional({
    description: '最小执行间隔（秒），用于防止任务过于频繁执行',
    example: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  intervalSeconds?: number

  @ApiPropertyOptional({
    description: '是否启用任务',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @ApiPropertyOptional({
    description: '初始游标（例如起始时间戳、自增 ID 等）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string
}

export class UpdateAdminDataPullTaskDto {
  @ApiPropertyOptional({
    description: '任务名称（描述用途）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @ApiPropertyOptional({
    description: '数据来源标识',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string | null

  @ApiPropertyOptional({
    description: '任务类型标识',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string | null

  @ApiPropertyOptional({
    description: 'Cron 表达式',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cron?: string | null

  @ApiPropertyOptional({
    description: '最小执行间隔（秒）',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  intervalSeconds?: number | null

  @ApiPropertyOptional({
    description: '是否启用任务',
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @ApiPropertyOptional({
    description: '当前游标（强制重置时使用）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string | null
}

export class AdminDataPullTaskResponseDto {
  @ApiProperty()
  id!: number

  @ApiProperty()
  key!: string

  @ApiProperty()
  name!: string

  @ApiPropertyOptional()
  source?: string | null

  @ApiPropertyOptional()
  type?: string | null

  @ApiPropertyOptional()
  cron?: string | null

  @ApiPropertyOptional()
  intervalSeconds?: number | null

  @ApiProperty()
  enabled!: boolean

  @ApiPropertyOptional()
  cursor?: string | null

  @ApiPropertyOptional()
  lastStatus?: string | null

  @ApiPropertyOptional()
  lastRunAt?: Date | null

  @ApiPropertyOptional()
  lastSuccessAt?: Date | null

  @ApiPropertyOptional()
  lastError?: string | null

  @ApiProperty()
  createdAt!: Date

  @ApiProperty()
  updatedAt!: Date
}


