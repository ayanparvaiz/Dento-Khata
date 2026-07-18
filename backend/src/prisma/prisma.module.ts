import { Global, Module } from '@nestjs/common';
import { PrismaService, PRISMA_FACTORY } from './prisma.service';

@Global()
@Module({
  providers: [PRISMA_FACTORY],
  exports: [PrismaService],
})
export class PrismaModule {}
