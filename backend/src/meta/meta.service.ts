import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface MetaEvent {
  eventName: string;              // CompleteRegistration | Purchase | Lead …
  eventId: string;                // shared with the browser pixel → deduplication
  eventTime?: number;             // unix seconds
  sourceUrl?: string;
  // user matching (higher match quality = better attribution)
  phone?: string | null;
  externalId?: string | null;     // our tenant id
  fbp?: string | null;            // _fbp cookie
  fbc?: string | null;            // _fbc cookie (from fbclid)
  ip?: string | null;
  ua?: string | null;
  // value
  value?: number;
  currency?: string;
}

// Server-side Meta Conversions API. Used alongside the browser pixel (same eventId
// → Meta deduplicates), and it is the ONLY way we can report the offline/manual
// bKash purchase, because that happens outside the browser.
@Injectable()
export class MetaService {
  private readonly log = new Logger('MetaCAPI');
  private readonly pixelId = process.env.META_PIXEL_ID || '';
  private readonly token = process.env.META_CAPI_TOKEN || '';
  private readonly appUrl = process.env.PUBLIC_URL || 'https://dento.devcenter.dev';
  get enabled() { return !!(this.pixelId && this.token); }

  private sha(v?: string | null) {
    if (!v) return undefined;
    return crypto.createHash('sha256').update(v.trim().toLowerCase()).digest('hex');
  }

  // Meta wants phones in E.164 digits, no '+'. BD local 01XXXXXXXXX → 8801XXXXXXXXX
  private normPhone(p?: string | null) {
    if (!p) return undefined;
    let d = p.replace(/\D/g, '');
    if (!d) return undefined;
    if (d.startsWith('0')) d = '88' + d.slice(1);
    if (!d.startsWith('88')) d = '88' + d;
    return d;
  }

  async send(e: MetaEvent): Promise<void> {
    if (!this.enabled) return; // tracking off → no-op
    const user_data: Record<string, unknown> = {};
    const ph = this.sha(this.normPhone(e.phone));
    if (ph) user_data.ph = [ph];
    const ext = this.sha(e.externalId);
    if (ext) user_data.external_id = [ext];
    if (e.fbp) user_data.fbp = e.fbp;
    if (e.fbc) user_data.fbc = e.fbc;
    if (e.ip) user_data.client_ip_address = e.ip;
    if (e.ua) user_data.client_user_agent = e.ua;

    const payload: any = {
      data: [{
        event_name: e.eventName,
        event_time: e.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: e.eventId,
        action_source: 'website',
        event_source_url: e.sourceUrl || this.appUrl,
        user_data,
        ...(e.value !== undefined
          ? { custom_data: { value: e.value, currency: e.currency || 'BDT' } }
          : {}),
      }],
    };

    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${this.pixelId}/events?access_token=${encodeURIComponent(this.token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.text();
      if (!res.ok) this.log.warn(`${e.eventName} failed (${res.status}): ${body.slice(0, 300)}`);
      else this.log.log(`${e.eventName} sent (${e.eventId})`);
    } catch (err) {
      // Never let tracking break the app.
      this.log.warn(`${e.eventName} error: ${(err as Error).message}`);
    }
  }
}
