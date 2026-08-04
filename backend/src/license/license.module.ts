import {
  Body, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, OnModuleInit,
  Param, Post, UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import * as crypto from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { dataPaths } from '../data';
import { Public } from '../auth/public.decorator';
import { NoSubscription } from '../subscription/no-subscription.decorator';
import { SuperAdminGuard } from '../superadmin/superadmin.guard';

class CreateLicenseDto {
  @IsString() @MinLength(2) clinicName: string;
  @IsString() @MinLength(2) drName: string;
  @IsString() @MinLength(6) phone: string;
  @IsOptional() backupMonths?: number; // grant the online-backup add-on for N months
  @IsOptional() @IsString() notes?: string;
}
class ActivateDto {
  @IsString() key: string;
  @IsString() machineId: string;
}

// Human-friendly key: DENTO-XXXX-XXXX-XXXX (no ambiguous chars).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genKey(): string {
  const grp = () => Array.from(crypto.randomBytes(4)).map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `DENTO-${grp()}-${grp()}-${grp()}`;
}

@Injectable()
export class LicenseService implements OnModuleInit {
  private privateKey!: crypto.KeyObject;
  private publicKeyPem = '';
  constructor(private prisma: PrismaService) {}

  // Ed25519 keypair — persisted once in DATA_DIR. The private key signs activation tokens;
  // the offline app embeds/pins the public key to verify them (can't be forged offline).
  onModuleInit() {
    const dir = dataPaths().dataDir || join(process.cwd(), 'data');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const file = join(dir, 'license-keys.json');
    if (existsSync(file)) {
      const { privateKey, publicKey } = JSON.parse(readFileSync(file, 'utf8'));
      this.privateKey = crypto.createPrivateKey(privateKey);
      this.publicKeyPem = publicKey;
    } else {
      const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519', {
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });
      writeFileSync(file, JSON.stringify({ privateKey, publicKey }), { mode: 0o600 });
      this.privateKey = crypto.createPrivateKey(privateKey);
      this.publicKeyPem = publicKey;
    }
  }

  get publicKey() { return this.publicKeyPem; }

  private sign(payload: object): string {
    const json = Buffer.from(JSON.stringify(payload));
    const sig = crypto.sign(null, json, this.privateKey);
    return `${json.toString('base64url')}.${sig.toString('base64url')}`;
  }

  // ---- super-admin: sell/manage keys ----
  async create(dto: CreateLicenseDto) {
    let key = genKey();
    // extremely unlikely, but guarantee uniqueness
    while (await this.prisma.license.findUnique({ where: { key } })) key = genKey();
    const backupUntil = dto.backupMonths
      ? new Date(Date.now() + dto.backupMonths * 30 * 86_400_000)
      : null;
    return this.prisma.license.create({
      data: { key, clinicName: dto.clinicName, drName: dto.drName, phone: dto.phone, backupUntil, notes: dto.notes },
    });
  }

  list() {
    return this.prisma.license.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async revoke(id: string) {
    return this.prisma.license.update({ where: { id }, data: { status: 'REVOKED' } });
  }

  // ---- offline app: activate + verify ----
  async activate(dto: ActivateDto) {
    const lic = await this.prisma.license.findUnique({ where: { key: dto.key.trim().toUpperCase() } });
    if (!lic) throw new NotFoundException({ code: 'LICENSE_NOT_FOUND', message: 'কী পাওয়া যায়নি। সঠিকভাবে লিখুন বা সাপোর্টে যোগাযোগ করুন।' });
    if (lic.status === 'REVOKED') throw new ForbiddenException({ code: 'LICENSE_REVOKED', message: 'এই কী বাতিল করা হয়েছে। সাপোর্টে যোগাযোগ করুন।' });
    if (lic.status === 'ACTIVE' && lic.machineId && lic.machineId !== dto.machineId)
      throw new ForbiddenException({ code: 'LICENSE_OTHER_MACHINE', message: 'এই কী অন্য কম্পিউটারে ব্যবহৃত হচ্ছে। নতুন কম্পিউটারে চালাতে সাপোর্টে যোগাযোগ করুন।' });

    const activated = lic.status === 'UNUSED'
      ? await this.prisma.license.update({ where: { id: lic.id }, data: { status: 'ACTIVE', machineId: dto.machineId, activatedAt: new Date() } })
      : lic;

    const token = this.sign({
      key: activated.key, machineId: dto.machineId, clinicName: activated.clinicName,
      drName: activated.drName, phone: activated.phone,
      backupUntil: activated.backupUntil ? activated.backupUntil.toISOString() : null,
      iat: Date.now(),
    });
    return {
      clinicName: activated.clinicName, drName: activated.drName, phone: activated.phone,
      backupUntil: activated.backupUntil, token, publicKey: this.publicKeyPem,
    };
  }

  async verify(dto: ActivateDto) {
    const lic = await this.prisma.license.findUnique({ where: { key: dto.key.trim().toUpperCase() } });
    if (!lic) return { valid: false, reason: 'not_found' };
    if (lic.status === 'REVOKED') return { valid: false, reason: 'revoked' };
    if (lic.machineId && lic.machineId !== dto.machineId) return { valid: false, reason: 'other_machine' };
    return {
      valid: true, status: lic.status, clinicName: lic.clinicName, drName: lic.drName, phone: lic.phone,
      backupUntil: lic.backupUntil, hasBackup: !!(lic.backupUntil && lic.backupUntil.getTime() > Date.now()),
    };
  }
}

@Controller('license')
class LicenseController {
  constructor(private svc: LicenseService) {}

  // Public key so the offline app can verify signed activation tokens.
  @Public() @NoSubscription()
  @Get('pubkey')
  pubkey() { return { publicKey: this.svc.publicKey }; }

  // Offline app → activate a key (binds it to this machine on first use).
  @Public() @NoSubscription()
  @Post('activate')
  activate(@Body() dto: ActivateDto) { return this.svc.activate(dto); }

  @Public() @NoSubscription()
  @Post('verify')
  verify(@Body() dto: ActivateDto) { return this.svc.verify(dto); }

  // ---- super-admin console: create/list/revoke keys ----
  @Public() @UseGuards(SuperAdminGuard)
  @Post('admin/create')
  create(@Body() dto: CreateLicenseDto) { return this.svc.create(dto); }

  @Public() @UseGuards(SuperAdminGuard)
  @Get('admin/list')
  adminList() { return this.svc.list(); }

  @Public() @UseGuards(SuperAdminGuard)
  @Post('admin/:id/revoke')
  revoke(@Param('id') id: string) { return this.svc.revoke(id); }
}

@Module({ providers: [LicenseService], controllers: [LicenseController], exports: [LicenseService] })
export class LicenseModule {}
