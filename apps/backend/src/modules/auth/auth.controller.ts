/* eslint-disable perfectionist/sort-imports -- NestJS 装饰器 + 类型导入组合下自动排序容易与 DI 约定冲突，按语义分组维护可读性更好 */

// DTO 必须使用值导入以保留运行时类型元数据，供 ValidationPipe 和 Swagger 使用
import { LoginRequestDto } from './dto/requests/login.request.dto'
import { PasswordResetRequestDto } from './dto/requests/password-reset.request.dto'
import { RegisterRequestDto } from './dto/requests/register.request.dto'
import { ResendVerificationRequestDto } from './dto/requests/resend-verification.request.dto'
import { SendVerificationCodeRequestDto } from './dto/requests/send-verification-code.request.dto'
import { VerifyEmailRequestDto } from './dto/requests/verify-email.request.dto'
import { VerifyPasswordResetRequestDto } from './dto/requests/verify-password-reset.request.dto'
import { AuthResponseDto } from './dto/responses/auth.response.dto'
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard'
// NestJS DI 需要运行时引用 UserAuthService，用于生成设计时类型元数据
// eslint-disable-next-line ts/consistent-type-imports
import { UserAuthService } from './services/user-auth.service'
import { BaseResponseDto } from '@/common/dto/base.dto'
import { buildBaseResponseSchema } from '@/common/swagger/base-response-schema.helper'
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { ApiBody, ApiExtraModels, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

@ApiTags('auth')
@Controller('auth')
@ApiExtraModels(BaseResponseDto, AuthResponseDto)
export class AuthController {
  constructor(private readonly userAuthService: UserAuthService) {}

  @Post('send-verification-code')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '发送验证码（注册/密码重置）' })
  @ApiBody({ type: SendVerificationCodeRequestDto })
  async sendVerificationCode(@Body() dto: SendVerificationCodeRequestDto): Promise<void> {
    await this.userAuthService.sendVerificationCode(dto)
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
}
