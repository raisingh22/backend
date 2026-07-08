import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    workspace: {
      create: jest.fn(),
    },
    session: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    verificationCode: {
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
    },
    passwordResetCode: {
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a user, create a workspace and session, and return tokens', async () => {
      const registerDto = {
        fullName: 'John Doe',
        mobileNumber: '+919876543210',
        email: 'john@example.com',
        password: 'Password123!',
        workspaceName: 'John Workspace',
      };

      const mockWorkspace = {
        id: 'workspace-id',
        name: registerDto.workspaceName,
        users: [
          {
            id: 'user-id',
            fullName: registerDto.fullName,
            mobileNumber: registerDto.mobileNumber,
            email: registerDto.email,
            password: 'hashed-password',
            workspaceId: 'workspace-id',
            role: 'STAFF',
            isMobileVerified: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const mockSession = {
        id: 'session-id',
        userId: 'user-id',
        tokenHash: '',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.workspace.create.mockResolvedValue(mockWorkspace);
      mockPrismaService.session.create.mockResolvedValue(mockSession);
      mockPrismaService.session.update.mockResolvedValue(mockSession);
      mockPrismaService.verificationCode.deleteMany.mockResolvedValue({
        count: 0,
      });
      mockPrismaService.verificationCode.create.mockResolvedValue({
        id: 'code-id',
      });

      const result = await service.register(registerDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { mobileNumber: registerDto.mobileNumber },
      });
      expect(prisma.workspace.create).toHaveBeenCalled();
      expect(prisma.session.create).toHaveBeenCalled();
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.mobileNumber).toBe(registerDto.mobileNumber);
    });

    it('should throw ConflictException if mobile number is already registered', async () => {
      const registerDto = {
        fullName: 'John Doe',
        mobileNumber: '+919876543210',
        password: 'Password123!',
        workspaceName: 'John Workspace',
      };

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing-id',
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('should login user and generate tokens/session', async () => {
      const loginDto = {
        mobileNumber: '+919876543210',
        password: 'Password123!',
      };

      const hashedPassword = await bcrypt.hash(loginDto.password, 10);
      const mockUser = {
        id: 'user-id',
        mobileNumber: loginDto.mobileNumber,
        email: 'john@example.com',
        password: hashedPassword,
        workspaceId: 'workspace-id',
        workspace: { id: 'workspace-id', name: 'My Workspace' },
      };

      const mockSession = {
        id: 'session-id',
        userId: 'user-id',
        tokenHash: '',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.session.create.mockResolvedValue(mockSession);
      mockPrismaService.session.update.mockResolvedValue(mockSession);

      const result = await service.login(loginDto);

      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.mobileNumber).toBe(loginDto.mobileNumber);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const loginDto = {
        mobileNumber: '+919876543210',
        password: 'wrongpassword',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    it('should rotate access and refresh tokens', async () => {
      const oldRefreshToken = jwt.sign(
        {
          userId: 'user-id',
          workspaceId: 'workspace-id',
          sessionId: 'session-id',
        },
        process.env.JWT_SECRET || 'super-secret-key-change-in-production',
        { expiresIn: '7d' },
      );

      const crypto = require('crypto');
      const oldHash = crypto
        .createHash('sha256')
        .update(oldRefreshToken)
        .digest('hex');

      const mockSession = {
        id: 'session-id',
        userId: 'user-id',
        tokenHash: oldHash,
        expiresAt: new Date(Date.now() + 100000),
        user: { workspaceId: 'workspace-id' },
      };

      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.session.update.mockResolvedValue(mockSession);

      const result = await service.refresh(oldRefreshToken);

      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(prisma.session.update).toHaveBeenCalled();
    });
  });

  describe('mobile verification', () => {
    it('should verify mobile number and mark user isMobileVerified as true', async () => {
      const verifyMobileDto = {
        mobileNumber: '+919876543210',
        code: '123456',
      };

      const mockUser = {
        id: 'user-id',
        mobileNumber: '+919876543210',
      };

      const mockVerificationRecord = {
        id: 'ver-id',
        userId: 'user-id',
        code: '123456',
        expiresAt: new Date(Date.now() + 100000),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.verificationCode.findFirst.mockResolvedValue(
        mockVerificationRecord,
      );
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        isMobileVerified: true,
      });
      mockPrismaService.verificationCode.delete.mockResolvedValue({
        id: 'ver-id',
      });

      const result = await service.verifyMobile(verifyMobileDto);

      expect(result.message).toBe('Mobile number verified successfully');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: { isMobileVerified: true },
      });
    });

    it('should throw BadRequestException if code is invalid or expired', async () => {
      const verifyMobileDto = {
        mobileNumber: '+919876543210',
        code: '123456',
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-id' });
      mockPrismaService.verificationCode.findFirst.mockResolvedValue(null);

      await expect(service.verifyMobile(verifyMobileDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('forgot and reset password', () => {
    it('should generate reset code and log message', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        mobileNumber: '+919876543210',
      });
      mockPrismaService.passwordResetCode.deleteMany.mockResolvedValue({
        count: 0,
      });
      mockPrismaService.passwordResetCode.create.mockResolvedValue({
        id: 'reset-id',
      });

      const result = await service.forgotPassword({
        mobileNumber: '+919876543210',
      });
      expect(result.message).toContain('sent');
    });

    it('should reset password, delete code, and revoke all sessions', async () => {
      const resetPasswordDto = {
        mobileNumber: '+919876543210',
        code: '654321',
        newPassword: 'NewPassword123!',
      };

      const mockResetRecord = {
        id: 'reset-id',
        userId: 'user-id',
        code: '654321',
        expiresAt: new Date(Date.now() + 100000),
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-id' });
      mockPrismaService.passwordResetCode.findFirst.mockResolvedValue(
        mockResetRecord,
      );
      mockPrismaService.user.update.mockResolvedValue({ id: 'user-id' });
      mockPrismaService.passwordResetCode.delete.mockResolvedValue({
        id: 'reset-id',
      });
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.resetPassword(resetPasswordDto);

      expect(result.message).toBe('Password reset successfully');
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
    });
  });

  describe('logoutAll', () => {
    it('should revoke all active sessions for the user', async () => {
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 3 });
      const result = await service.logoutAll('user-id');
      expect(result.message).toContain('Logged out from all devices');
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
    });
  });
});
