import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [AuthModule, WorkspaceModule, PrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
