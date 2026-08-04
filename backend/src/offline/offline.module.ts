import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Logger, Module,
  OnModuleInit, Post,
} from '@nestjs/common';
import { networkInterfaces, hostname, platform, arch, cpus, totalmem } from 'os';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { IsString, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { runInTenant } from '../tenant/tenant-context';
import { DEFAULT_PROCEDURES } from '../auth/default-procedures';
import { PAID_PLAN } from '../subscription/plans';
import { IS_OFFLINE } from '../config/mode';
import { dataPaths } from '../data';
import { Public } from '../auth/public.decorator';
import { NoSubscription } from '../subscription/no-subscription.decorator';

// Where the offline app phones home for license activation, and the pinned public key it
// verifies the signed activation token with (so a forged token can't unlock the app offline).
const LICENSE_SERVER = process.env.LICENSE_SERVER || 'https://dento.devcenter.dev/api';
const LICENSE_PUBKEY =
  '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAX8Rc6GwMkP3uux4FpNVcVq9U9wX3Y2RrsQ9cNpWuqbY=\n-----END PUBLIC KEY-----\n';

const licenseFile = () => join(dataPaths().dataDir, 'license.json');

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

@Controller('offline')
class OfflineController {
  constructor(private license: OfflineLicenseService) {}

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
}

@Module({ providers: [OfflineBootstrapService, OfflineLicenseService], controllers: [OfflineController] })
export class OfflineModule {}
