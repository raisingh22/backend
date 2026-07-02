import { Injectable, ConflictException, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyMobileDto } from './dto/verify-mobile.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

interface ClientInfo {
  userAgent?: string;
  ipAddress?: string;
  deviceName?: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async register(dto: RegisterDto, clientInfo?: ClientInfo) {
    const { mobileNumber, email, password, fullName, workspaceName } = dto;

    const existingUser = await this.prisma.user.findUnique({
      where: { mobileNumber },
    });

    if (existingUser) {
      throw new ConflictException('Mobile number already registered');
    }

    if (email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existingEmail) {
        throw new ConflictException('Email already registered');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const workspace = await this.prisma.workspace.create({
      data: {
        name: workspaceName,
        users: {
          create: {
            fullName,
            mobileNumber,
            email: email || null,
            password: hashedPassword,
            isMobileVerified: false,
          },
        },
      },
      include: {
        users: true,
      },
    });

    const user = workspace.users[0];
    const { password: _, ...userWithoutPassword } = user;
    const { users: __, ...workspaceWithoutUsers } = workspace;

    // Create session & generate tokens
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: '',
        userAgent: clientInfo?.userAgent,
        ipAddress: clientInfo?.ipAddress,
        deviceName: clientInfo?.deviceName || this.extractDeviceName(clientInfo?.userAgent),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    const refreshToken = jwt.sign(
      { userId: user.id, workspaceId: workspace.id, sessionId: session.id },
      process.env.JWT_SECRET || 'super-secret-key-change-in-production',
      { expiresIn: '7d' }
    );

    await this.prisma.session.update({
      where: { id: session.id },
      data: { tokenHash: this.hashToken(refreshToken) },
    });

    const token = jwt.sign(
      { userId: user.id, workspaceId: workspace.id },
      process.env.JWT_SECRET || 'super-secret-key-change-in-production',
      { expiresIn: '15m' } // Short-lived access token
    );

    // Generate & send verification code via SMS
    await this.sendVerificationCode(user.id, mobileNumber);

    return {
      user: userWithoutPassword,
      workspace: workspaceWithoutUsers,
      token,
      refreshToken,
    };
  }

  async login(dto: LoginDto, clientInfo?: ClientInfo) {
    const { mobileNumber, password } = dto;

    const user = await this.prisma.user.findUnique({
      where: { mobileNumber },
      include: { workspace: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid mobile number or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid mobile number or password');
    }

    const { password: _, ...userWithoutPassword } = user;

    // Create session & generate tokens
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: '',
        userAgent: clientInfo?.userAgent,
        ipAddress: clientInfo?.ipAddress,
        deviceName: clientInfo?.deviceName || this.extractDeviceName(clientInfo?.userAgent),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    const refreshToken = jwt.sign(
      { userId: user.id, workspaceId: user.workspaceId, sessionId: session.id },
      process.env.JWT_SECRET || 'super-secret-key-change-in-production',
      { expiresIn: '7d' }
    );

    await this.prisma.session.update({
      where: { id: session.id },
      data: { tokenHash: this.hashToken(refreshToken) },
    });

    const token = jwt.sign(
      { userId: user.id, workspaceId: user.workspaceId },
      process.env.JWT_SECRET || 'super-secret-key-change-in-production',
      { expiresIn: '15m' }
    );

    return {
      user: userWithoutPassword,
      token,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    let payload: any;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_SECRET || 'super-secret-key-change-in-production');
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!payload.sessionId) {
      throw new UnauthorizedException('Invalid refresh token structure');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (!session || new Date() > session.expiresAt) {
      throw new UnauthorizedException('Session expired or not found');
    }

    const expectedHash = this.hashToken(refreshToken);
    if (session.tokenHash !== expectedHash) {
      // Security measure: potential token reuse/theft detection
      // Revoke all sessions for this user to be safe
      await this.prisma.session.deleteMany({
        where: { userId: session.userId },
      });
      throw new UnauthorizedException('Token reuse detected. All sessions revoked.');
    }

    // Rotate token
    const newRefreshToken = jwt.sign(
      { userId: session.userId, workspaceId: session.user.workspaceId, sessionId: session.id },
      process.env.JWT_SECRET || 'super-secret-key-change-in-production',
      { expiresIn: '7d' }
    );

    const newAccessToken = jwt.sign(
      { userId: session.userId, workspaceId: session.user.workspaceId },
      process.env.JWT_SECRET || 'super-secret-key-change-in-production',
      { expiresIn: '15m' }
    );

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        tokenHash: this.hashToken(newRefreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      token: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    let payload: any;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_SECRET || 'super-secret-key-change-in-production');
    } catch (err) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.sessionId) {
      await this.prisma.session.delete({
        where: { id: payload.sessionId },
      }).catch(() => {
        // ignore delete failures if already deleted
      });
    }
  }

  async logoutAll(userId: string) {
    await this.prisma.session.deleteMany({
      where: { userId },
    });
    return { message: 'Logged out from all devices successfully' };
  }

  async sendVerificationCode(userId: string, mobileNumber: string) {
    // Revoke previous verification codes
    await this.prisma.verificationCode.deleteMany({
      where: { userId },
    });

    const code = this.generateVerificationCode();
    await this.prisma.verificationCode.create({
      data: {
        userId,
        code,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Simulate sending SMS
    console.log(`[SMS OTP Simulator] Sending verification code ${code} to ${mobileNumber}`);
  }

  async verifyMobile(dto: VerifyMobileDto) {
    const { mobileNumber, code } = dto;

    const user = await this.prisma.user.findUnique({
      where: { mobileNumber },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const verificationRecord = await this.prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        code,
      },
    });

    if (!verificationRecord || new Date() > verificationRecord.expiresAt) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { isMobileVerified: true },
    });

    await this.prisma.verificationCode.delete({
      where: { id: verificationRecord.id },
    });

    return { message: 'Mobile number verified successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { mobileNumber: dto.mobileNumber },
    });

    if (!user) {
      // Return same response to prevent enumeration
      return { message: 'If the mobile number exists, an OTP reset code has been sent' };
    }

    // Revoke old reset codes
    await this.prisma.passwordResetCode.deleteMany({
      where: { userId: user.id },
    });

    const code = this.generateVerificationCode();
    await this.prisma.passwordResetCode.create({
      data: {
        userId: user.id,
        code,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Simulate sending SMS
    console.log(`[SMS OTP Simulator] Sending password reset code ${code} to ${dto.mobileNumber}`);
    return { message: 'If the mobile number exists, an OTP reset code has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { mobileNumber, code, newPassword } = dto;

    const user = await this.prisma.user.findUnique({
      where: { mobileNumber },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const resetRecord = await this.prisma.passwordResetCode.findFirst({
      where: {
        userId: user.id,
        code,
      },
    });

    if (!resetRecord || new Date() > resetRecord.expiresAt) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Clean up reset code
    await this.prisma.passwordResetCode.delete({
      where: { id: resetRecord.id },
    });

    // Revoke all active sessions upon password reset (Logout from All Devices)
    await this.prisma.session.deleteMany({
      where: { userId: user.id },
    });

    return { message: 'Password reset successfully' };
  }

  async getSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.session.delete({
      where: { id: sessionId },
    });

    return { message: 'Session revoked successfully' };
  }

  private extractDeviceName(userAgent?: string): string {
    if (!userAgent) return 'Unknown Device';
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('iPad')) return 'iPad';
    if (userAgent.includes('Android')) return 'Android Device';
    if (userAgent.includes('Macintosh')) return 'Mac';
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Linux')) return 'Linux PC';
    return 'Web Browser / App';
  }
}
