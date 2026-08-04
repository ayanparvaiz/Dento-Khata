import { Body, Controller, ForbiddenException, Get, Injectable, Module, OnModuleInit, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Cron } from '@nestjs/schedule';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { dataPaths } from '../data';
import { Public } from '../auth/public.decorator';
import { NoSubscription } from '../subscription/no-subscription.decorator';
import { PaidOnly } from '../subscription/paid-only.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { SuperAdminGuard } from '../superadmin/superadmin.guard';
import { RestoreService } from './restore.service';
import { IS_OFFLINE } from '../config/mode';

const execFileAsync = promisify(execFile);
const KEEP = 30; // keep last 30 daily dumps

// Whole-database backups via pg_dump (custom format, restorable with pg_restore).
// NOTE: the shared Postgres DB holds ALL tenants — these dumps are PLATFORM-level and
// are therefore restricted to the super-admin, never a clinic owner.
@Injectable()
export class BackupService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    if (IS_OFFLINE) return; // pg_dump is Postgres-only; offline uses local + cloud JSON backups
    try { await this.backupNow(); } catch (e) { console.warn('startup backup failed', e); }
  }

  // Per-tenant data export: EVERYTHING belonging to the calling clinic (auto-scoped by
  // the tenant context), as one JSON object the owner can download and keep. This is the
  // clinic-facing backup — NOT the platform pg_dump (which spans all tenants).
  async exportTenantData() {
    const p = this.prisma;
    const [
      patients, medicalHistory, appointments, toothRecords, perioRecords, procedures,
      treatmentPlans, treatmentRecords, treatmentItems, clinicalNotes, prescriptions,
      prescriptionItems, invoices, invoiceItems, payments, files, settings,
    ] = await Promise.all([
      p.patient.findMany(), p.medicalHistory.findMany(), p.appointment.findMany(),
      p.toothRecord.findMany(), p.perioRecord.findMany(), p.procedure.findMany(),
      p.treatmentPlan.findMany(), p.treatmentRecord.findMany(), p.treatmentItem.findMany(),
      p.clinicalNote.findMany(), p.prescription.findMany(), p.prescriptionItem.findMany(),
      p.invoice.findMany(), p.invoiceItem.findMany(), p.payment.findMany(),
      p.patientFile.findMany(), p.clinicSettings.findMany(),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      version: 1,
      clinic: settings[0]?.name || null,
      counts: { patients: patients.length, appointments: appointments.length, treatmentRecords: treatmentRecords.length, prescriptions: prescriptions.length, invoices: invoices.length, payments: payments.length },
      data: {
        patients, medicalHistory, appointments, toothRecords, perioRecords, procedures,
        treatmentPlans, treatmentRecords, treatmentItems, clinicalNotes, prescriptions,
        prescriptionItems, invoices, invoiceItems, payments, files, settings,
      },
    };
  }

  @Cron('0 3 * * *') // daily at 03:00
  async periodic() {
    if (IS_OFFLINE) return; // Postgres-only platform dump
    try { await this.backupNow(); } catch (e) { console.warn('scheduled backup failed', e); }
  }

  async backupNow() {
    const url = process.env.DATABASE_URL;
    if (!url || !url.startsWith('postgres')) throw new Error('DATABASE_URL is not Postgres');
    const { backupDir } = dataPaths();
    if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const target = join(backupDir, `dental-${date}.dump`);
    if (existsSync(target)) unlinkSync(target); // overwrite same-day
    // pg_dump rejects libpq-only query params (e.g. ?schema=public) → strip the query string.
    const dumpUrl = url.split('?')[0];
    await execFileAsync('pg_dump', ['-Fc', '--no-owner', '--no-privileges', '-f', target, dumpUrl]);
    this.prune(backupDir);
    return { file: target, date };
  }

  private prune(backupDir: string) {
    const files = readdirSync(backupDir)
      .filter((f) => f.endsWith('.dump'))
      .map((f) => ({ f, t: statSync(join(backupDir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    files.slice(KEEP).forEach((x) => { try { unlinkSync(join(backupDir, x.f)); } catch { /* ignore */ } });
  }

  list() {
    const { backupDir } = dataPaths();
    if (!existsSync(backupDir)) return { dir: backupDir, backups: [] };
    const backups = readdirSync(backupDir)
      .filter((f) => f.endsWith('.dump'))
      .map((f) => {
        const st = statSync(join(backupDir, f));
        return { name: f, sizeKB: Math.round(st.size / 1024), modified: st.mtime };
      })
      .sort((a, b) => +new Date(b.modified) - +new Date(a.modified));
    return { dir: backupDir, backups };
  }
}

@Controller('backup')
class BackupController {
  constructor(private svc: BackupService, private restoreSvc: RestoreService) {}

  // --- Platform (super-admin) — full multi-tenant pg_dump ---
  @Public() @UseGuards(SuperAdminGuard)
  @Get('list')
  list() {
    return this.svc.list();
  }

  @Public() @UseGuards(SuperAdminGuard)
  @Post('now')
  now() {
    return this.svc.backupNow();
  }

  // --- Clinic-facing — the owner/admin downloads THEIR OWN data as JSON ---
  @PaidOnly() // backup/export is a Pro feature
  @NoSubscription()
  @Get('export')
  async export(@CurrentUser() user: AuthUser, @Res() res: Response) {
    if (user.role !== 'OWNER' && user.role !== 'ADMIN')
      throw new ForbiddenException('শুধু ক্লিনিকের মালিক/অ্যাডমিন ব্যাকআপ ডাউনলোড করতে পারবেন');
    const payload = await this.svc.exportTenantData();
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dentokhata-backup-${date}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  }

  // Restore a previously-downloaded JSON backup INTO this clinic. Duplicate-proof:
  // records already present (by id) are skipped; clashing patient codes / invoice numbers
  // are renumbered; procedures are merged by code. See RestoreService.
  @PaidOnly()
  @NoSubscription()
  @Post('import')
  async import(@CurrentUser() user: AuthUser, @Body() payload: any) {
    if (user.role !== 'OWNER' && user.role !== 'ADMIN')
      throw new ForbiddenException('শুধু ক্লিনিকের মালিক/অ্যাডমিন ব্যাকআপ রিস্টোর করতে পারবেন');
    return this.restoreSvc.restore(payload);
  }
}

@Module({ providers: [BackupService, RestoreService], controllers: [BackupController], exports: [BackupService, RestoreService] })
export class BackupModule {}
