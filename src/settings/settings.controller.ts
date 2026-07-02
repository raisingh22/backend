import { Controller, Get, Patch, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings(@Request() req: any) {
    const workspaceId = req.user.workspaceId;
    return this.settingsService.getWorkspaceSettings(workspaceId);
  }

  @Get('tax')
  async getTaxSettings(@Request() req: any) {
    const workspaceId = req.user.workspaceId;
    return this.settingsService.getTaxSettings(workspaceId);
  }

  @Patch()
  @Roles('OWNER', 'MANAGER')
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
  @Roles('OWNER')
  async createBranch(@Request() req: any, @Body() body: { name: string; address: string; phone?: string; businessHours?: string }) {
    const workspaceId = req.user.workspaceId;
    return this.settingsService.createBranch(workspaceId, body);
  }

  @Delete('branches/:id')
  @Roles('OWNER')
  async deleteBranch(@Request() req: any, @Param('id') branchId: string) {
    const workspaceId = req.user.workspaceId;
    return this.settingsService.deleteBranch(workspaceId, branchId);
  }
}
