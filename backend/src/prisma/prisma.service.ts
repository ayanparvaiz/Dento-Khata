import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();

    // SQLite tuning for a multi-client LAN setup:
    // WAL = concurrent reads while writing + safe online backup (copy the .db file).
    // PRAGMAs can return a result row, so use $queryRawUnsafe (executeRaw rejects results in SQLite).
    await this.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
    await this.$queryRawUnsafe('PRAGMA foreign_keys=ON;');
    await this.$queryRawUnsafe('PRAGMA busy_timeout=5000;');
  }
}
