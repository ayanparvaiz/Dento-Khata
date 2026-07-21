import { Injectable, Logger } from '@nestjs/common';

// Sends operator alerts to a Telegram chat (new signups, payment submissions).
// Configured via env: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID. No-ops if unset, and
// never throws into the request path — a failed notification must not break signup.
@Injectable()
export class TelegramService {
  private readonly log = new Logger('Telegram');
  private readonly token = process.env.TELEGRAM_BOT_TOKEN || '';
  private readonly chatId = process.env.TELEGRAM_CHAT_ID || '';

  get enabled() {
    return !!(this.token && this.chatId);
  }

  // HTML-escape user-supplied values before putting them in an HTML-parse-mode message.
  private esc(v?: string | null): string {
    if (!v) return '—';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async send(html: string): Promise<void> {
    if (!this.enabled) return;
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: html,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
      if (!res.ok) this.log.warn(`sendMessage ${res.status}: ${await res.text()}`);
    } catch (e) {
      this.log.warn(`send failed: ${(e as Error).message}`);
    }
  }

  // 🆕 New clinic signed up — full details of what they entered.
  async notifySignup(d: { clinicName?: string | null; ownerName?: string | null; phone?: string | null; email?: string | null; ip?: string | null }) {
    const lines = [
      '🆕 <b>New Signup</b>',
      '',
      `🏥 <b>Clinic:</b> ${this.esc(d.clinicName)}`,
      `👤 <b>Owner:</b> ${this.esc(d.ownerName)}`,
      `📞 <b>Phone:</b> ${this.esc(d.phone)}`,
      `✉️ <b>Email:</b> ${this.esc(d.email)}`,
      `🌐 <b>IP:</b> ${this.esc(d.ip)}`,
    ];
    await this.send(lines.join('\n'));
  }

  // 💳 A clinic submitted a bKash TrxID — needs manual verification.
  async notifyPayment(d: { clinicName?: string | null; ownerName?: string | null; phone?: string | null; trxId?: string | null; senderMsisdn?: string | null; amount?: number | null }) {
    const lines = [
      '🔴 <b>PAYMENT VERIFICATION NEEDED</b>',
      '',
      `🏥 <b>Clinic:</b> ${this.esc(d.clinicName)}`,
      `👤 <b>Name:</b> ${this.esc(d.ownerName)}`,
      `📞 <b>Phone:</b> ${this.esc(d.phone)}`,
      `🧾 <b>TrxID:</b> <code>${this.esc(d.trxId)}</code>`,
      `📲 <b>bKash number:</b> ${this.esc(d.senderMsisdn)}`,
      d.amount ? `💰 <b>Amount:</b> ৳${d.amount}` : '',
      '',
      '➡️ Verify in the super-admin console.',
    ].filter(Boolean);
    await this.send(lines.join('\n'));
  }
}
