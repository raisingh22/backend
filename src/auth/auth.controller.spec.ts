import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
    verifyMobile: jest.fn(),
    sendVerificationCode: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    getSessions: jest.fn(),
    revokeSession: jest.fn(),
  };

  const mockPrismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  const mockReq = {
    headers: { 'user-agent': 'TestAgent' },
    ip: '127.0.0.1',
  } as unknown as Request;

  describe('register', () => {
    it('should call authService.register', async () => {
      const registerDto = {
        fullName: 'John',
        mobileNumber: '+919876543210',
        email: 'john@example.com',
        password: 'Password123!',
        workspaceName: 'Work',
      };
      await controller.register(registerDto, mockReq);
      expect(service.register).toHaveBeenCalledWith(registerDto, {
        userAgent: 'TestAgent',
        ipAddress: '127.0.0.1',
      });
    });
  });

  describe('login', () => {
    it('should call authService.login', async () => {
      const loginDto = {
        mobileNumber: '+919876543210',
        password: 'Password123!',
      };
      await controller.login(loginDto, mockReq);
      expect(service.login).toHaveBeenCalledWith(loginDto, {
        userAgent: 'TestAgent',
        ipAddress: '127.0.0.1',
      });
    });
  });

  describe('refresh', () => {
    it('should call authService.refresh', async () => {
      const refreshDto = { refreshToken: 'ref-token' };
      await controller.refresh(refreshDto);
      expect(service.refresh).toHaveBeenCalledWith('ref-token');
    });
  });

  describe('logout', () => {
    it('should call authService.logout', async () => {
      const refreshDto = { refreshToken: 'ref-token' };
      const res = await controller.logout(refreshDto);
      expect(service.logout).toHaveBeenCalledWith('ref-token');
      expect(res.message).toBe('Logged out successfully');
    });
  });

  describe('logout-all', () => {
    it('should call authService.logoutAll', async () => {
      const user = { id: 'user-id' };
      await controller.logoutAll(user);
      expect(service.logoutAll).toHaveBeenCalledWith('user-id');
    });
  });

  describe('verifyMobile', () => {
    it('should call authService.verifyMobile', async () => {
      const dto = { mobileNumber: '+919876543210', code: '123456' };
      await controller.verifyMobile(dto);
      expect(service.verifyMobile).toHaveBeenCalledWith(dto);
    });
  });

  describe('sendVerificationSms', () => {
    it('should call authService.sendVerificationCode', async () => {
      const user = { id: 'user-id', mobileNumber: '+919876543210' };
      await controller.sendVerificationSms(user);
      expect(service.sendVerificationCode).toHaveBeenCalledWith(
        'user-id',
        '+919876543210',
      );
    });
  });

  describe('forgotPassword', () => {
    it('should call authService.forgotPassword', async () => {
      const dto = { mobileNumber: '+919876543210' };
      await controller.forgotPassword(dto);
      expect(service.forgotPassword).toHaveBeenCalledWith(dto);
    });
  });

  describe('resetPassword', () => {
    it('should call authService.resetPassword', async () => {
      const dto = {
        mobileNumber: '+919876543210',
        code: '654321',
        newPassword: 'NewPassword123!',
      };
      await controller.resetPassword(dto);
      expect(service.resetPassword).toHaveBeenCalledWith(dto);
    });
  });

  describe('sessions', () => {
    it('should call authService.getSessions', async () => {
      const user = { id: 'user-id' };
      await controller.getSessions(user);
      expect(service.getSessions).toHaveBeenCalledWith('user-id');
    });

    it('should call authService.revokeSession', async () => {
      const user = { id: 'user-id' };
      await controller.revokeSession(user, 'session-id');
      expect(service.revokeSession).toHaveBeenCalledWith(
        'user-id',
        'session-id',
      );
    });
  });
});
