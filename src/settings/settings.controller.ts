import { Controller, Get, Patch, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings(@Request() req: any) {
    const workspaceId = req.user.workspaceId;
    return this.settingsService.getWorkspaceSettings(workspaceId);
  }

  @Patch()
  async updateSettings(@Request() req: any, @Body() body: any) {
    const workspaceId = req.user.workspaceId;
    return this.settingsService.updateWorkspaceSettings(workspaceId, body);
  }

  @Get('branches')
  async getBranches(@Request() req: any) {
    const workspaceId = req.user.workspaceId;
    return this.settingsService.getBranches(workspaceId);
  }

  @Post('branches')
  async createBranch(@Request() req: any, @Body() body: { name: string; address: string; phone?: string; businessHours?: string }) {
    const workspaceId = req.user.workspaceId;
    return this.settingsService.createBranch(workspaceId, body);
  }

  @Delete('branches/:id')
  async deleteBranch(@Request() req: any, @Param('id') branchId: string) {
    const workspaceId = req.user.workspaceId;
    return this.settingsService.deleteBranch(workspaceId, branchId);
  }
}
