// Generates prisma/schema.sqlite.prisma from the canonical Postgres schema.
// The ONLY difference is the datasource provider — the models are byte-for-byte identical
// (the schema uses no Postgres-only types/enums/arrays), so offline stays in lock-step with
// online automatically. Run before `prisma generate/db push` for an offline (SQLite) build.
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'prisma', 'schema.prisma');
const out = join(here, '..', 'prisma', 'schema.sqlite.prisma');

let schema = readFileSync(src, 'utf8');
if (!schema.includes('provider = "postgresql"')) {
  throw new Error('Expected provider = "postgresql" in schema.prisma — aborting to avoid a bad SQLite schema.');
}
schema =
  '// AUTO-GENERATED from schema.prisma by scripts/make-sqlite-schema.mjs — do not edit by hand.\n' +
  schema.replace('provider = "postgresql"', 'provider = "sqlite"');

writeFileSync(out, schema);
console.log('Wrote', out, '(SQLite variant of schema.prisma)');
