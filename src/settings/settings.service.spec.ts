import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    workspaceSettings: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTaxSettings', () => {
    const workspaceId = 'test-workspace-id';
    const mockSettings = {
      id: 'settings-id',
      taxRate: 18.0,
      taxIdNumber: 'GST-12345',
      workspaceId,
      workspace: { id: workspaceId, name: 'Test Workspace' },
    };

    it('should return existing tax settings', async () => {
      mockPrismaService.workspaceSettings.findUnique.mockResolvedValue(
        mockSettings,
      );

      const result = await service.getTaxSettings(workspaceId);

      expect(result).toEqual(mockSettings);
      expect(
        mockPrismaService.workspaceSettings.findUnique,
      ).toHaveBeenCalledWith({
        where: { workspaceId },
        include: { workspace: true },
      });
    });

    it('should create and return tax settings if they do not exist', async () => {
      mockPrismaService.workspaceSettings.findUnique.mockResolvedValue(null);
      mockPrismaService.workspaceSettings.create.mockResolvedValue(
        mockSettings,
      );

      const result = await service.getTaxSettings(workspaceId);

      expect(result).toEqual(mockSettings);
      expect(
        mockPrismaService.workspaceSettings.findUnique,
      ).toHaveBeenCalledWith({
        where: { workspaceId },
        include: { workspace: true },
      });
      expect(mockPrismaService.workspaceSettings.create).toHaveBeenCalledWith({
        data: { workspaceId },
        include: { workspace: true },
      });
    });
  });
});
