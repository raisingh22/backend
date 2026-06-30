import { Test, TestingModule } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SettingsController', () => {
  let controller: SettingsController;
  let service: SettingsService;

  const mockSettingsService = {
    getWorkspaceSettings: jest.fn(),
    getTaxSettings: jest.fn(),
    updateWorkspaceSettings: jest.fn(),
    getBranches: jest.fn(),
    createBranch: jest.fn(),
    deleteBranch: jest.fn(),
  };

  const mockPrismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
    service = module.get<SettingsService>(SettingsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTaxSettings', () => {
    it('should return tax settings for the user workspace', async () => {
      const mockTaxSettings = { id: '1', taxRate: 18, taxIdNumber: 'GST123', workspaceId: 'w1' };
      mockSettingsService.getTaxSettings.mockResolvedValue(mockTaxSettings);

      const req = { user: { workspaceId: 'w1' } };
      const result = await controller.getTaxSettings(req);

      expect(result).toEqual(mockTaxSettings);
      expect(service.getTaxSettings).toHaveBeenCalledWith('w1');
    });
  });
});
