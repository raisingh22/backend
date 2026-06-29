import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: pg.Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const pool = new pg.Pool({
      connectionString,
      ssl: PrismaService.resolveSsl(connectionString),
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  private static resolveSsl(connectionString?: string) {
    if (!connectionString) {
      return undefined;
    }

    const url = new URL(connectionString);
    const sslMode = url.searchParams.get('sslmode');
    const dbSsl = process.env.DB_SSL?.toLowerCase();
    const isPrivateHost = !url.hostname.includes('.') || url.hostname.endsWith('.internal');

    if (dbSsl === 'true' || sslMode === 'require') {
      return { rejectUnauthorized: false };
    }

    if (dbSsl === 'false' || isPrivateHost) {
      return undefined;
    }

    return undefined;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
