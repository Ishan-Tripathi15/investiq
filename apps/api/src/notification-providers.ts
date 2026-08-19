import { createHash } from 'node:crypto';
import type { NotificationChannel, NotificationDevice } from './notification-delivery.repository';

export interface DeliveryRequest {
  channel: NotificationChannel;
  title: string;
  message: string;
  email?: string;
  phone?: string;
  devices?: NotificationDevice[];
  data?: Record<string, string>;
}

export interface DeliveryResult {
  channel: NotificationChannel;
  provider: string;
  status: 'sent' | 'failed' | 'unavailable';
  destinationHash?: string;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

function hashDestination(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<Response> {
  return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

async function sendExpoPush(request: DeliveryRequest): Promise<DeliveryResult> {
  const devices = (request.devices ?? []).filter((device) => device.provider === 'expo');
  if (!devices.length) return { channel: 'push', provider: 'expo', status: 'unavailable', errorCode: 'NO_EXPO_DEVICE', errorMessage: 'No registered Expo push device is available.' };
  const response = await postJson('https://exp.host/--/api/v2/push/send', {}, devices.map((device) => ({
    to: device.pushToken,
    title: request.title,
    body: request.message,
    data: request.data ?? {},
    priority: 'high',
  })));
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { channel: 'push', provider: 'expo', status: 'failed', errorCode: `HTTP_${response.status}`, errorMessage: 'Expo Push Service rejected the notification.' };
  const tickets = Array.isArray(payload?.data) ? payload.data : [];
  const error = tickets.find((ticket: any) => ticket?.status === 'error');
  if (error) return { channel: 'push', provider: 'expo', status: 'failed', errorCode: String(error.details?.error ?? 'EXPO_PUSH_ERROR'), errorMessage: String(error.message ?? 'Expo Push Service reported a delivery error.') };
  const ticketId = tickets.find((ticket: any) => typeof ticket?.id === 'string')?.id;
  return { channel: 'push', provider: 'expo', status: 'sent', providerMessageId: ticketId };
}

async function sendResendEmail(request: DeliveryRequest): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_EMAIL_FROM;
  if (!apiKey || !from || !request.email) return { channel: 'email', provider: 'resend', status: 'unavailable', destinationHash: request.email ? hashDestination(request.email) : undefined, errorCode: 'EMAIL_NOT_CONFIGURED', errorMessage: 'Resend API credentials, sender, or recipient are not configured.' };
  const response = await postJson('https://api.resend.com/emails', { authorization: `Bearer ${apiKey}` }, {
    from,
    to: [request.email],
    subject: `[InvestIQ Security] ${request.title}`,
    text: request.message,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { channel: 'email', provider: 'resend', status: 'failed', destinationHash: hashDestination(request.email), errorCode: `HTTP_${response.status}`, errorMessage: String(payload?.message ?? 'Email provider rejected the message.') };
  return { channel: 'email', provider: 'resend', status: 'sent', destinationHash: hashDestination(request.email), providerMessageId: typeof payload?.id === 'string' ? payload.id : undefined };
}

async function sendTwilioSms(request: DeliveryRequest): Promise<DeliveryResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !from || !request.phone) return { channel: 'sms', provider: 'twilio', status: 'unavailable', destinationHash: request.phone ? hashDestination(request.phone) : undefined, errorCode: 'SMS_NOT_CONFIGURED', errorMessage: 'Twilio credentials, sender, or recipient are not configured.' };
  const params = new URLSearchParams({ To: request.phone, From: from, Body: `${request.title}: ${request.message}` });
  const basic = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, { method: 'POST', headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' }, body: params.toString() });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { channel: 'sms', provider: 'twilio', status: 'failed', destinationHash: hashDestination(request.phone), errorCode: String(payload?.code ?? `HTTP_${response.status}`), errorMessage: String(payload?.message ?? 'SMS provider rejected the message.') };
  return { channel: 'sms', provider: 'twilio', status: 'sent', destinationHash: hashDestination(request.phone), providerMessageId: typeof payload?.sid === 'string' ? payload.sid : undefined };
}

export async function deliverSecurityNotification(request: DeliveryRequest): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];
  if (request.devices !== undefined) results.push(await sendExpoPush(request));
  if (request.email !== undefined) results.push(await sendResendEmail(request));
  if (request.phone !== undefined) results.push(await sendTwilioSms(request));
  return results;
}
