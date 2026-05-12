import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateExternalSignalWebhookSubscriptionDto {
  @ApiPropertyOptional({ example: 'tradingview' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string

  @ApiProperty({ example: 'BTC_PERP_LONG_01' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(160)
  signalId!: string

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}

export class ExternalSignalWebhookSubscriptionResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  userId!: string

  @ApiProperty()
  strategyInstanceId!: string

  @ApiPropertyOptional({ nullable: true })
  provider?: string | null

  @ApiProperty()
  signalId!: string

  @ApiProperty()
  secretVersion!: number

  @ApiProperty()
  status!: string

  @ApiPropertyOptional({ nullable: true })
  lastAcceptedAt?: string | null

  @ApiPropertyOptional({ nullable: true })
  rotatedAt?: string | null

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  metadata?: Record<string, unknown> | null

  @ApiProperty()
  webhookUrl!: string

  @ApiProperty()
  createdAt!: string

  @ApiProperty()
  updatedAt!: string
}

export class ExternalSignalWebhookSubscriptionSecretResponseDto extends ExternalSignalWebhookSubscriptionResponseDto {
  @ApiProperty({
    description: 'Plaintext signing secret. Returned only immediately after create or rotate.',
  })
  secret!: string
}

export class ExternalSignalWebhookAcceptedResponseDto {
  @ApiProperty({ example: true })
  accepted!: boolean

  @ApiProperty()
  eventId!: string
}
