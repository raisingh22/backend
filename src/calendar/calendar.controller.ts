import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CalendarService } from './calendar.service';

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  getEvents(
    @CurrentUser() user: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.calendarService.getEvents(user.workspaceId, startDate, endDate);
  }

  @Get('summary')
  getSummary(@CurrentUser() user: any, @Query('date') date: string) {
    return this.calendarService.getSummary(user.workspaceId, date);
  }

  @Get('users')
  getWorkspaceUsers(@CurrentUser() user: any) {
    return this.calendarService.getWorkspaceUsers(user.workspaceId);
  }

  // Reminders
  @Post('reminders')
  createReminder(
    @CurrentUser() user: any,
    @Body('title') title: string,
    @Body('notes') notes: string | null,
    @Body('date') date: string,
    @Body('time') time: string | null,
  ) {
    return this.calendarService.createReminder(
      user.workspaceId,
      title,
      notes,
      date,
      time,
    );
  }

  @Get('reminders')
  getReminders(@CurrentUser() user: any) {
    return this.calendarService.getReminders(user.workspaceId);
  }

  @Delete('reminders/:id')
  deleteReminder(@CurrentUser() user: any, @Param('id') id: string) {
    return this.calendarService.deleteReminder(id, user.workspaceId);
  }

  // Staff Schedule
  @Post('staff-schedule')
  createStaffSchedule(
    @CurrentUser() user: any,
    @Body('userId') userId: string,
    @Body('date') date: string,
    @Body('type') type: string,
    @Body('notes') notes: string | null,
  ) {
    return this.calendarService.createStaffSchedule(
      user.workspaceId,
      userId,
      date,
      type,
      notes,
    );
  }

  @Get('staff-schedule')
  getStaffSchedules(@CurrentUser() user: any) {
    return this.calendarService.getStaffSchedules(user.workspaceId);
  }

  @Delete('staff-schedule/:id')
  deleteStaffSchedule(@CurrentUser() user: any, @Param('id') id: string) {
    return this.calendarService.deleteStaffSchedule(id, user.workspaceId);
  }
}
