import { Controller, Post, Body, Get, Delete, UseGuards, Req, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyMobileDto } from './dto/verify-mobile.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: any) {
    const clientInfo = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
    return this.authService.register(dto, clientInfo);
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const clientInfo = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
    return this.authService.login(dto, clientInfo);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(@CurrentUser() user: any) {
    return this.authService.logoutAll(user.id);
  }

  @Post('verify-mobile')
  async verifyMobile(@Body() dto: VerifyMobileDto) {
    return this.authService.verifyMobile(dto);
  }

  @Post('send-verification-sms')
  @UseGuards(JwtAuthGuard)
  async sendVerificationSms(@CurrentUser() user: any) {
    await this.authService.sendVerificationCode(user.id, user.mobileNumber);
    return { message: 'Verification OTP sent successfully' };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async getSessions(@CurrentUser() user: any) {
    return this.authService.getSessions(user.id);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  async revokeSession(@CurrentUser() user: any, @Param('id') sessionId: string) {
    return this.authService.revokeSession(user.id, sessionId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: any) {
    return user;
  }
}
