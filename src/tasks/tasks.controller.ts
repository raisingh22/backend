import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(user.workspaceId, {
      ...dto,
      userId: user.id,
    });
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: ListTasksDto) {
    return this.tasksService.findAll(user.workspaceId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tasksService.findOne(id, user.workspaceId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, user.workspaceId, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tasksService.softDelete(id, user.workspaceId);
  }

  // ─── Soft Delete & Restore ─────────────────────────────────────────────────

  @Post(':id/restore')
  restore(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tasksService.restore(id, user.workspaceId);
  }

  @Delete(':id/hard-delete')
  hardDelete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tasksService.hardDelete(id, user.workspaceId);
  }

  // ─── Bulk Operations ───────────────────────────────────────────────────────

  @Post('bulk/soft-delete')
  bulkSoftDelete(@CurrentUser() user: any, @Body() body: { ids: string[] }) {
    return this.tasksService.bulkSoftDelete(user.workspaceId, body.ids);
  }

  @Post('bulk/restore')
  bulkRestore(@CurrentUser() user: any, @Body() body: { ids: string[] }) {
    return this.tasksService.bulkRestore(user.workspaceId, body.ids);
  }

  @Post('bulk/hard-delete')
  bulkHardDelete(@CurrentUser() user: any, @Body() body: { ids: string[] }) {
    return this.tasksService.bulkHardDelete(user.workspaceId, body.ids);
  }
}
