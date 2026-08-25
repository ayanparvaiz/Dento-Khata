import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Logger, Module,
  OnModuleInit, Post,
} from '@nestjs/common';
import { networkInterfaces, hostname, platform, arch, cpus, totalmem } from 'os';
import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { IsString, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { runInTenant } from '../tenant/tenant-context';
import { DEFAULT_PROCEDURES } from '../auth/default-procedures';
import { seedDrugs } from '../data/drug-catalog';
import { PAID_PLAN } from '../subscription/plans';
import { IS_OFFLINE } from '../config/mode';
import { dataPaths } from '../data';
import { Public } from '../auth/public.decorator';
import { NoSubscription } from '../subscription/no-subscription.decorator';
import { BackupModule, BackupService } from '../backup/backup.module';
import { RestoreService } from '../backup/restore.service';

// Where the offline app phones home for license activation, and the pinned public key it
// verifies the signed activation token with (so a forged token can't unlock the app offline).
const LICENSE_SERVER = process.env.LICENSE_SERVER || 'https://dento.devcenter.dev/api';
const LICENSE_PUBKEY =
  '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAX8Rc6GwMkP3uux4FpNVcVq9U9wX3Y2RrsQ9cNpWuqbY=\n-----END PUBLIC KEY-----\n';

const licenseFile = () => join(dataPaths().dataDir, 'license.json');
function readLicense(): any | null {
  try { return existsSync(licenseFile()) ? JSON.parse(readFileSync(licenseFile(), 'utf8')) : null; } catch { return null; }
}

// Stable-per-PC fingerprint so one key binds to one machine.
function machineId(): string {
  const parts = [hostname(), platform(), arch(), cpus()[0]?.model || '', String(totalmem())];
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const i of nets[name] || []) {
      if (!i.internal && i.mac && i.mac !== '00:00:00:00:00:00') { parts.push(i.mac); break; }
    }
  }
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

function verifyToken(token: string): any | null {
  try {
    const [pl, sg] = token.split('.');
    const payload = Buffer.from(pl, 'base64url');
    const ok = crypto.verify(null, payload, crypto.createPublicKey(LICENSE_PUBKEY), Buffer.from(sg, 'base64url'));
    return ok ? JSON.parse(payload.toString()) : null;
  } catch { return null; }
}

class ActivateOfflineDto { @IsString() key: string; }
class CompleteDto { @IsString() @MinLength(6) password: string; }

// OFFLINE clinic setup + LAN info. The .exe has no public signup: the single clinic is
// created once, on first run, after the license key is activated and the doctor sets a password.
@Injectable()
export class OfflineBootstrapService implements OnModuleInit {
  private readonly log = new Logger('OfflineBootstrap');
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    if (!IS_OFFLINE) return;
    // Seed the global drug catalog into the local SQLite DB so prescriptions have the full
    // medicine list (online seeds this at deploy; offline must do it itself). Idempotent.
    try {
      const n = await seedDrugs(this.prisma, { skipIfAny: true });
      this.log.log(`Drug catalog ready (${n} drugs).`);
    } catch (e) {
      this.log.error(`Drug seed failed: ${(e as Error).message}`);
    }
    // Dev shortcut only: create a clinic without a license (never in a real .exe build).
    if (process.env.OFFLINE_SKIP_LICENSE === '1') {
      const existing = await this.prisma.tenant.findFirst();
      if (existing) return;
      await this.createClinic({
        clinicName: process.env.OFFLINE_CLINIC_NAME || 'আমার ডেন্টাল চেম্বার',
        ownerName: process.env.OFFLINE_OWNER_NAME || 'ডাক্তার',
        phone: (process.env.OFFLINE_OWNER_PHONE || '01700000000').trim(),
        password: process.env.OFFLINE_OWNER_PASSWORD || 'admin1234',
      });
      this.log.log('Offline dev clinic created (OFFLINE_SKIP_LICENSE).');
    }
    // Otherwise wait for license activation → clinic is created via /offline/license/complete.
  }

  async createClinic(o: { clinicName: string; ownerName: string; phone: string; password: string }) {
    const tenant = await this.prisma.tenant.create({
      data: { slug: 'clinic', name: o.clinicName, ownerName: o.ownerName, phone: o.phone },
    });
    await runInTenant(tenant.id, async () => {
      await this.prisma.user.create({
        data: { phone: o.phone, username: o.ownerName, passwordHash: await bcrypt.hash(o.password, 10), fullName: o.ownerName, role: 'OWNER', isActive: true },
      });
      await this.prisma.subscription.create({ data: { plan: PAID_PLAN, status: 'ACTIVE', amount: 0, currentPeriodEnd: null } });
      await this.prisma.clinicSettings.create({ data: { name: o.clinicName, phone: o.phone } });
      await this.prisma.procedure.createMany({ data: DEFAULT_PROCEDURES });
    });
    this.log.log(`Offline clinic created: "${o.clinicName}" — owner login ${o.phone}`);
    return tenant;
  }
}

@Injectable()
export class OfflineLicenseService {
  private readonly log = new Logger('OfflineLicense');
  constructor(private bootstrap: OfflineBootstrapService, private prisma: PrismaService) {}

  private readLocal(): any | null {
    try { return existsSync(licenseFile()) ? JSON.parse(readFileSync(licenseFile(), 'utf8')) : null; } catch { return null; }
  }

  // Is the app set up? (a clinic exists). Also reports the pending license identity, if any.
  async status() {
    const tenant = await this.prisma.tenant.findFirst();
    const lic = this.readLocal();
    return { activated: !!tenant, hasLicense: !!lic, clinic: lic ? { clinicName: lic.clinicName, drName: lic.drName, phone: lic.phone } : null };
  }

  // Enter a key → activate against the cloud license server, verify the signed token,
  // store it locally. Does NOT create the clinic yet (doctor sets a password next).
  async activate(key: string) {
    if ((await this.prisma.tenant.findFirst())) throw new ForbiddenException({ code: 'ALREADY_SETUP', message: 'এই কম্পিউটার আগেই সেটআপ করা হয়েছে।' });
    const mid = machineId();
    let res: Response;
    try {
      res = await fetch(`${LICENSE_SERVER}/license/activate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim().toUpperCase(), machineId: mid }),
      });
    } catch {
      throw new BadRequestException({ code: 'NO_INTERNET', message: 'ইন্টারনেট সংযোগ নেই। প্রথমবার চালু করতে একবার ইন্টারনেট লাগবে।' });
    }
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new BadRequestException({ code: body.code || 'ACTIVATION_FAILED', message: body.message || 'কী যাচাই করা যায়নি।' });

    const payload = verifyToken(body.token);
    if (!payload || payload.machineId !== mid || payload.key !== key.trim().toUpperCase())
      throw new BadRequestException({ code: 'BAD_TOKEN', message: 'লাইসেন্স যাচাই ব্যর্থ। সাপোর্টে যোগাযোগ করুন।' });

    writeFileSync(licenseFile(), JSON.stringify({
      key: payload.key, machineId: mid, token: body.token,
      clinicName: payload.clinicName, drName: payload.drName, phone: payload.phone, backupUntil: payload.backupUntil,
    }), { mode: 0o600 });
    this.log.log(`License activated: ${payload.key} for "${payload.clinicName}"`);
    return { clinicName: payload.clinicName, drName: payload.drName, phone: payload.phone };
  }

  // Doctor sets a password → create the clinic + owner. Frontend then logs in normally.
  async complete(password: string) {
    const lic = this.readLocal();
    if (!lic) throw new BadRequestException({ code: 'NOT_ACTIVATED', message: 'আগে লাইসেন্স কী দিন।' });
    if ((await this.prisma.tenant.findFirst())) throw new ForbiddenException({ code: 'ALREADY_SETUP', message: 'এই কম্পিউটার আগেই সেটআপ করা হয়েছে।' });
    await this.bootstrap.createClinic({ clinicName: lic.clinicName, ownerName: lic.drName, phone: lic.phone, password });
    return { ok: true, phone: lic.phone };
  }
}

// Paid cloud-backup add-on (offline side). Proxies to the online store using the stored
// license key + machine id, and reuses the local JSON export + duplicate-proof restore.
@Injectable()
export class OfflineCloudBackupService {
  constructor(private backup: BackupService, private restore: RestoreService) {}

  private lic() {
    const l = readLicense();
    if (!l) throw new BadRequestException({ code: 'NOT_ACTIVATED', message: 'লাইসেন্স নেই।' });
    return l;
  }
  private async cloud(path: string, extra: any = {}) {
    const l = this.lic();
    const res = await fetch(`${LICENSE_SERVER}/cloud-backup/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: l.key, machineId: l.machineId, ...extra }),
    }).catch(() => { throw new BadRequestException({ code: 'NO_INTERNET', message: 'ইন্টারনেট সংযোগ নেই।' }); });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new BadRequestException({ code: data.code || 'CLOUD_ERR', message: data.message || 'ক্লাউড ব্যাকআপ ব্যর্থ।' });
    return data;
  }

  // Entitlement + list in one call (list requires an active plan on the server).
  async status() {
    const l = readLicense();
    if (!l) return { entitled: false, hasLicense: false, backups: [] };
    try {
      const res = await fetch(`${LICENSE_SERVER}/cloud-backup/list`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: l.key, machineId: l.machineId }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (res.ok) return { entitled: true, hasLicense: true, backups: data.backups || [] };
      return { entitled: false, hasLicense: true, reason: data.code || 'NO_PLAN', backups: [] };
    } catch { return { entitled: false, hasLicense: true, reason: 'NO_INTERNET', backups: [] }; }
  }

  async upload() {
    const data = await this.backup.exportTenantData(); // tenant-scoped (admin JWT context)
    return this.cloud('upload', { data });
  }

  async restoreFromCloud(id: string) {
    const { data } = await this.cloud('download', { id });
    return this.restore.restore(data); // duplicate-proof
  }
}

class RestoreIdDto { @IsString() id: string; }
class OpenExternalDto { @IsString() url: string; }

// The desktop app is a single webview with no tabs and no back button, so a normal
// target="_blank" link replaces the app itself and strands the doctor. The frontend sends
// those links here instead and we hand them to the machine's default browser.
function openInDefaultBrowser(rawUrl: string) {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new BadRequestException('Invalid URL'); }
  // Only ever hand the OS a web address — never a file:// path or a custom scheme.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new BadRequestException('Only http/https links');

  // No shell anywhere: the URL is passed as a single argument, so nothing in it can be
  // interpreted as a command. windowsHide keeps the console-less app console-less.
  const [cmd, args] =
    process.platform === 'win32' ? ['explorer.exe', [url.href]]
      : process.platform === 'darwin' ? ['open', [url.href]]
        : ['xdg-open', [url.href]];
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', (e) => Logger.warn(`could not open ${url.href}: ${e.message}`, 'OpenExternal'));
  child.unref(); // explorer.exe exits non-zero by design — never wait on it
  return { opened: url.href };
}

@Controller('offline')
class OfflineController {
  constructor(private license: OfflineLicenseService, private cloudBackup: OfflineCloudBackupService) {}

  @Get('lan')
  lan() {
    const port = Number(process.env.PORT) || 3000;
    const addrs: string[] = [];
    const ifaces = networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const net of ifaces[name] || []) {
        if (net.family === 'IPv4' && !net.internal) addrs.push(net.address);
      }
    }
    addrs.sort((a, b) => (a.startsWith('192.168.') ? -1 : b.startsWith('192.168.') ? 1 : 0));
    return { enabled: IS_OFFLINE, port, addresses: addrs, urls: addrs.map((a) => `http://${a}:${port}`) };
  }

  @Public() @NoSubscription()
  @Get('license/status')
  status() { return this.license.status(); }

  @Public() @NoSubscription()
  @Post('license/activate')
  activate(@Body() dto: ActivateOfflineDto) {
    if (!IS_OFFLINE) throw new ForbiddenException('offline only');
    return this.license.activate(dto.key);
  }

  @Public() @NoSubscription()
  @Post('license/complete')
  complete(@Body() dto: CompleteDto) {
    if (!IS_OFFLINE) throw new ForbiddenException('offline only');
    return this.license.complete(dto.password);
  }

  // Cloud backup (paid add-on). Authenticated — export/restore run in the admin's tenant context.
  @Get('cloud-backup/status')
  cbStatus() { if (!IS_OFFLINE) throw new ForbiddenException('offline only'); return this.cloudBackup.status(); }

  @Post('cloud-backup/upload')
  cbUpload() { if (!IS_OFFLINE) throw new ForbiddenException('offline only'); return this.cloudBackup.upload(); }

  @Post('cloud-backup/restore')
  cbRestore(@Body() dto: RestoreIdDto) { if (!IS_OFFLINE) throw new ForbiddenException('offline only'); return this.cloudBackup.restoreFromCloud(dto.id); }

  // Open a link in the PC's default browser. Public + NoSubscription because the licence
  // screen shows the support WhatsApp link before anyone can log in.
  @Public() @NoSubscription()
  @Post('open-external')
  openExternal(@Body() dto: OpenExternalDto) {
    if (!IS_OFFLINE) throw new ForbiddenException('offline only');
    return openInDefaultBrowser(dto.url);
  }
}

@Module({
  imports: [BackupModule],
  providers: [OfflineBootstrapService, OfflineLicenseService, OfflineCloudBackupService],
  controllers: [OfflineController],
})
export class OfflineModule {}
