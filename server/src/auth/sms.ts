import type { Env } from '@/http';

/**
 * Sending the one-time code.
 *
 * India needs the sender and the exact message registered with the telecom operators (DLT) before an SMS can go
 * out, so until that registration is through the code is written to the Worker's log and (locally) handed back in
 * the response, exactly as the app's demo mode does today. Switching to real SMS is `SMS_PROVIDER=msg91` plus the
 * MSG91 secrets — no code change.
 */

export type SmsResult = { sent: boolean; provider: string };

export async function sendOtpSms(env: Env, mobile: string, code: string): Promise<SmsResult> {
  const provider = (env.SMS_PROVIDER ?? 'log').toLowerCase();
  if (provider === 'msg91') return sendWithMsg91(env, mobile, code);
  // 'log': no SMS leaves the building.
  console.log(`[otp] ${mobile} -> ${code}`);
  return { sent: false, provider: 'log' };
}

async function sendWithMsg91(env: Env, mobile: string, code: string): Promise<SmsResult> {
  const authKey = env.MSG91_AUTH_KEY;
  const templateId = env.MSG91_TEMPLATE_ID;
  if (!authKey || !templateId) {
    console.error('[otp] MSG91 is selected but MSG91_AUTH_KEY / MSG91_TEMPLATE_ID are not set');
    return { sent: false, provider: 'msg91' };
  }
  const response = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authkey: authKey },
    body: JSON.stringify({
      template_id: templateId,
      mobile: `91${mobile}`,
      otp: code,
      // The template's own variable name for the code, as registered on DLT.
      otp_length: code.length,
      realTimeResponse: 1,
    }),
  });
  if (!response.ok) {
    console.error('[otp] msg91 refused', response.status, await response.text().catch(() => ''));
    return { sent: false, provider: 'msg91' };
  }
  return { sent: true, provider: 'msg91' };
}
