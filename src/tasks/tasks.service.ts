import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseCrudService, CrudConfig } from '../common/crud/base-crud.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ListTasksDto } from './dto/list-tasks.dto';

@Injectable()
export class TasksService extends BaseCrudService {
  protected readonly config: CrudConfig = {
    model: 'task',
    searchFields: ['title', 'description'],
    defaultSortBy: 'createdAt',
    defaultInclude: {
      user: { select: { id: true, fullName: true, email: true } },
    },
  };

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async create(workspaceId: string, data: { userId: string } & CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        status: data.status || 'TODO',
        userId: data.userId,
        workspaceId,
      },
      include: this.config.defaultInclude,
    });
  }

  async findAll(workspaceId: string, query?: ListTasksDto) {
    const additionalWhere: Record<string, any> = {};
    if (query?.status) {
      additionalWhere.status = query.status;
    }
    return super.findAll(workspaceId, query ?? {}, additionalWhere);
  }

  async update(id: string, workspaceId: string, dto: UpdateTaskDto) {
    await this.findOne(id, workspaceId);
    return this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
      },
      include: this.config.defaultInclude,
    });
  }

  /** Legacy alias — now performs soft delete */
  async remove(id: string, workspaceId: string) {
    return this.softDelete(id, workspaceId);
  }
}
