/* eslint-disable perfectionist/sort-imports -- NestJS 装饰器 + 类型导入组合下自动排序容易与 DI 约定冲突，按语义分组维护可读性更好 */

// DTO 必须使用值导入以保留运行时类型元数据，供 ValidationPipe 和 Swagger 使用
import { LoginRequestDto } from './dto/requests/login.request.dto'
import { PasswordResetRequestDto } from './dto/requests/password-reset.request.dto'
import { RegisterRequestDto } from './dto/requests/register.request.dto'
import { ResendVerificationRequestDto } from './dto/requests/resend-verification.request.dto'
import { BindEmailRequestDto } from './dto/requests/bind-email.request.dto'
import { CreateTelegramDesktopIntentRequestDto } from './dto/requests/create-telegram-desktop-intent.request.dto'
import { BindTelegramRequestDto } from './dto/requests/bind-telegram.request.dto'
import { SendVerificationCodeRequestDto } from './dto/requests/send-verification-code.request.dto'
import { SendEmailLoginCodeRequestDto } from './dto/requests/send-email-login-code.request.dto'
import { TelegramBotWebhookRequestDto } from './dto/requests/telegram-bot-webhook.request.dto'
import { TelegramDesktopExchangeRequestDto } from './dto/requests/telegram-desktop-exchange.request.dto'
import { TelegramExchangeRequestDto } from './dto/requests/telegram-exchange.request.dto'
import { VerifyEmailRequestDto } from './dto/requests/verify-email.request.dto'
import { VerifyEmailLoginCodeRequestDto } from './dto/requests/verify-email-login-code.request.dto'
import { VerifyPasswordResetRequestDto } from './dto/requests/verify-password-reset.request.dto'
import { AuthResponseDto } from './dto/responses/auth.response.dto'
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
// NestJS DI 需要运行时引用 UserAuthService，用于生成设计时类型元数据
// eslint-disable-next-line ts/consistent-type-imports
import { UserAuthService } from './services/user-auth.service'
import { BaseResponseDto } from '@/common/dto/base.dto'
import { buildBaseResponseSchema } from '@/common/swagger/base-response-schema.helper'
import { CurrentUser } from './decorators/current-user.decorator'
import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBody, ApiExtraModels, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

@ApiTags('auth')
@Controller('auth')
@ApiExtraModels(BaseResponseDto, AuthResponseDto)
export class AuthController {
  constructor(private readonly userAuthService: UserAuthService) {}

  @Get('telegram/login-config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取 Telegram 登录配置' })
  async getTelegramLoginConfig(): Promise<{ botName: string | null }> {
    return this.userAuthService.getTelegramLoginConfig()
  }

  @Post('telegram/desktop/intent')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '创建 Telegram 桌面端登录意图' })
  @ApiBody({ type: CreateTelegramDesktopIntentRequestDto })
  async createTelegramDesktopIntent(
    @Body() dto: CreateTelegramDesktopIntentRequestDto,
  ): Promise<{
      intentId: string
      deepLink: string
      webLink: string
      callbackUrl: string
      expiresInSeconds: number
    }> {
    return this.userAuthService.createTelegramDesktopIntent(dto)
  }

  @Get('telegram/desktop/intent/:intentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '查询 Telegram 桌面端登录意图状态' })
  async getTelegramDesktopIntentStatus(@Param('intentId') intentId: string): Promise<{
    status: 'pending' | 'confirmed' | 'expired'
  }> {
    return this.userAuthService.getTelegramDesktopIntentStatus(intentId)
  }

  @Post('telegram/desktop/exchange')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '消费 Telegram 桌面端登录意图并登录' })
  @ApiBody({ type: TelegramDesktopExchangeRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Telegram 桌面登录成功',
    schema: buildBaseResponseSchema(AuthResponseDto),
  })
  async telegramDesktopExchange(@Body() dto: TelegramDesktopExchangeRequestDto): Promise<AuthResponseDto> {
    return this.userAuthService.telegramDesktopExchange(dto)
  }

  @Post('bind/telegram/desktop')
  @UseGuards(JwtAuthGuard, AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '消费 Telegram 桌面端登录意图并绑定 Telegram' })
  @ApiBody({ type: TelegramDesktopExchangeRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Telegram 绑定成功',
    schema: buildBaseResponseSchema(AuthResponseDto),
  })
  async bindTelegramByDesktopIntent(
    @CurrentUser('id') userId: string,
    @Body() dto: TelegramDesktopExchangeRequestDto,
  ): Promise<AuthResponseDto> {
    return this.userAuthService.bindTelegramByDesktopIntent(userId, dto)
  }

  @Post('telegram/bot/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Telegram Bot Webhook 回调' })
  @ApiBody({ type: TelegramBotWebhookRequestDto })
  async handleTelegramBotWebhook(
    @Body() dto: TelegramBotWebhookRequestDto,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ): Promise<{ ok: true }> {
    await this.userAuthService.handleTelegramBotWebhook(dto, secretToken)
    return { ok: true }
  }

  @Post('send-verification-code')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '发送验证码（注册/密码重置）' })
  @ApiBody({ type: SendVerificationCodeRequestDto })
  async sendVerificationCode(@Body() dto: SendVerificationCodeRequestDto): Promise<void> {
    await this.userAuthService.sendVerificationCode(dto)
  }

  @Post('email/send-code')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '发送邮箱登录验证码' })
  @ApiBody({ type: SendEmailLoginCodeRequestDto })
  async sendEmailLoginCode(@Body() dto: SendEmailLoginCodeRequestDto): Promise<void> {
    await this.userAuthService.sendEmailLoginCode(dto)
  }

  @Post('email/verify-code')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '验证邮箱登录验证码（自动注册或登录）' })
  @ApiBody({ type: VerifyEmailLoginCodeRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '邮箱验证码登录成功',
    schema: buildBaseResponseSchema(AuthResponseDto),
  })
  async verifyEmailLoginCode(@Body() dto: VerifyEmailLoginCodeRequestDto): Promise<AuthResponseDto> {
    return this.userAuthService.verifyEmailLoginCode(dto)
  }

  @Post('telegram/exchange')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Telegram 登录换取会话' })
  @ApiBody({ type: TelegramExchangeRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Telegram 登录成功',
    schema: buildBaseResponseSchema(AuthResponseDto),
  })
  async telegramExchange(@Body() dto: TelegramExchangeRequestDto): Promise<AuthResponseDto> {
    return this.userAuthService.telegramExchange(dto)
  }

  @Post('register')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '用户注册' })
  @ApiBody({ type: RegisterRequestDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '用户注册成功',
    schema: buildBaseResponseSchema(AuthResponseDto),
  })
  async register(@Body() dto: RegisterRequestDto): Promise<AuthResponseDto> {
    return this.userAuthService.register(dto)
  }

  @Post('login')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiBody({ type: LoginRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '用户登录成功',
    schema: buildBaseResponseSchema(AuthResponseDto),
  })
  async login(@Body() dto: LoginRequestDto): Promise<AuthResponseDto> {
    return this.userAuthService.login(dto)
  }

  @Post('password-reset')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '申请重置密码' })
  @ApiBody({ type: PasswordResetRequestDto })
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto): Promise<void> {
    await this.userAuthService.requestPasswordReset(dto)
  }

  @Post('password-reset/verify')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '验证重置密码验证码并更新密码' })
  @ApiBody({ type: VerifyPasswordResetRequestDto })
  async verifyPasswordReset(@Body() dto: VerifyPasswordResetRequestDto): Promise<void> {
    await this.userAuthService.verifyPasswordReset(dto)
  }

  @Post('verify-email')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '验证邮箱验证码' })
  @ApiBody({ type: VerifyEmailRequestDto })
  async verifyEmail(@Body() dto: VerifyEmailRequestDto): Promise<void> {
    await this.userAuthService.verifyEmail(dto)
  }

  @Post('resend-verification')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重新发送邮箱验证码' })
  @ApiBody({ type: ResendVerificationRequestDto })
  async resendVerification(@Body() dto: ResendVerificationRequestDto): Promise<void> {
    await this.userAuthService.resendVerification(dto)
  }

  @Post('bind/email')
  @UseGuards(JwtAuthGuard, AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '绑定邮箱登录方式' })
  @ApiBody({ type: BindEmailRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '邮箱绑定成功',
    schema: buildBaseResponseSchema(AuthResponseDto),
  })
  async bindEmail(
    @CurrentUser('id') userId: string,
    @Body() dto: BindEmailRequestDto,
  ): Promise<AuthResponseDto> {
    return this.userAuthService.bindEmail(userId, dto)
  }

  @Post('bind/telegram')
  @UseGuards(JwtAuthGuard, AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '绑定 Telegram 登录方式' })
  @ApiBody({ type: BindTelegramRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Telegram 绑定成功',
    schema: buildBaseResponseSchema(AuthResponseDto),
  })
  async bindTelegram(
    @CurrentUser('id') userId: string,
    @Body() dto: BindTelegramRequestDto,
  ): Promise<AuthResponseDto> {
    return this.userAuthService.bindTelegram(userId, dto)
  }
}
