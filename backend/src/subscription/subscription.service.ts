import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitPaymentDto } from './dto';
import { planByKey, DEFAULT_PLAN } from './plans';
import { MetaService } from '../meta/meta.service';
import { TelegramService } from '../telegram/telegram.service';

export interface AccessState {
  active: boolean;
  status: string; // PENDING | ACTIVE | PAST_DUE | SUSPENDED | NONE
  currentPeriodEnd: Date | null;
  daysLeft: number | null; // days until expiry (incl. grace consumed → negative once past)
  amount: number;
  bkashNumber: string;
  whatsapp: string;
}

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService, private meta: MetaService, private telegram: TelegramService) {}

  private graceDays() {
    return Number(process.env.SUBSCRIPTION_GRACE_DAYS) || 3;
  }
  private price() {
    return Number(process.env.SUBSCRIPTION_PRICE) || DEFAULT_PLAN.price;
  }
  private bkashNumber() {
    return process.env.BKASH_RECEIVE_NUMBER || '01XXXXXXXXX';
  }
  private whatsapp() {
    return process.env.SUPPORT_WHATSAPP || '';
  }

  // Live access decision for a subscription row (null = no subscription).
  computeAccess(sub: { status: string; currentPeriodEnd: Date | null; amount: number } | null): AccessState {
    const base = { amount: sub?.amount ?? this.price(), bkashNumber: this.bkashNumber(), whatsapp: this.whatsapp() };
    if (!sub) return { active: false, status: 'NONE', currentPeriodEnd: null, daysLeft: null, ...base };

    if (sub.status === 'SUSPENDED')
      return { active: false, status: 'SUSPENDED', currentPeriodEnd: sub.currentPeriodEnd, daysLeft: null, ...base };

    if (!sub.currentPeriodEnd)
      return { active: false, status: sub.status || 'PENDING', currentPeriodEnd: null, daysLeft: null, ...base };

    const now = Date.now();
    const end = sub.currentPeriodEnd.getTime();
    const graceMs = this.graceDays() * 86_400_000;
    const active = now <= end + graceMs;
    const daysLeft = Math.ceil((end - now) / 86_400_000);
    const status = active ? (now <= end ? 'ACTIVE' : 'PAST_DUE') : 'PAST_DUE';
    return { active, status, currentPeriodEnd: sub.currentPeriodEnd, daysLeft, ...base };
  }

  // The current tenant's subscription (scoped by the request context).
  // Also the moment we can detect the (offline/manual bKash) purchase: the first time
  // an activated clinic loads the app we fire Meta Purchase — once — server-side,
  // replaying the fbp/fbc captured at signup so Meta attributes it to the ad click.
  async myStatus(): Promise<AccessState & { pendingPayment: boolean; trackPurchase?: boolean; purchaseEventId?: string; purchaseValue?: number }> {
    const sub = await this.prisma.subscription.findFirst();
    const state = this.computeAccess(sub);
    let pendingPayment = false;
    if (sub) {
      const p = await this.prisma.subscriptionPayment.findFirst({ where: { status: 'SUBMITTED' } });
      pendingPayment = !!p;
    }

    let trackPurchase = false;
    let purchaseEventId: string | undefined;
    let purchaseValue: number | undefined;

    if (sub && state.active && !sub.purchaseTrackedAt) {
      // value = what they actually paid (latest verified payment), else the plan price
      const paid = await this.prisma.subscriptionPayment.findFirst({
        where: { status: 'VERIFIED', amount: { gt: 0 } }, orderBy: { verifiedAt: 'desc' },
      });
      purchaseValue = paid?.amount ?? sub.amount;
      purchaseEventId = `purchase-${sub.tenantId}-${crypto.randomBytes(6).toString('hex')}`;
      // mark first so a double request can't double-fire
      await this.prisma.subscription.update({ where: { id: sub.id }, data: { purchaseTrackedAt: new Date() } });
      trackPurchase = true;

      const tenant = await this.prisma.tenant.findUnique({ where: { id: sub.tenantId } });
      void this.meta.send({
        eventName: 'Purchase', eventId: purchaseEventId,
        phone: tenant?.phone, externalId: sub.tenantId,
        fbp: tenant?.fbp, fbc: tenant?.fbc, ip: tenant?.signupIp, ua: tenant?.signupUa,
        value: purchaseValue, currency: 'BDT',
      });
    }

    return { ...state, pendingPayment, trackPurchase, purchaseEventId, purchaseValue };
  }

  // Tenant submits a manual bKash transaction for the admin to verify.
  async submitPayment(dto: SubmitPaymentDto) {
    const sub = await this.prisma.subscription.findFirst();
    if (!sub) throw new NotFoundException('No subscription found for this clinic');

    const dup = await this.prisma.subscriptionPayment.findFirst({ where: { trxId: dto.trxId } });
    if (dup) throw new BadRequestException('That transaction id was already submitted');

    // The clinic picked a package on the paywall — its price + duration are authoritative.
    const plan = planByKey(dto.plan);

    await this.prisma.subscriptionPayment.create({
      data: {
        subscriptionId: sub.id,
        amount: plan.price,
        method: 'BKASH',
        trxId: dto.trxId,
        senderMsisdn: dto.senderMsisdn,
        note: dto.note,
        status: 'SUBMITTED',
        periodDays: plan.days,
      },
    });

    // Alert the operator (Telegram) that a payment needs verification.
    const tenant = await this.prisma.tenant.findUnique({ where: { id: sub.tenantId } });
    void this.telegram.notifyPayment({
      clinicName: tenant?.name, ownerName: tenant?.ownerName, phone: tenant?.phone,
      trxId: dto.trxId, senderMsisdn: dto.senderMsisdn, amount: plan.price, planLabel: plan.label,
    });

    return { submitted: true };
  }
}
