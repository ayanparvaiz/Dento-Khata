import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ErrorLogFilter } from './error-log.filter';

// Registers the global exception filter that records server errors + failed logins.
// Purely additive — it delegates to the default handler so responses are unchanged.
@Module({
  providers: [{ provide: APP_FILTER, useClass: ErrorLogFilter }],
})
export class ErrorLogModule {}
