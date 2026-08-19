export type MarketSession = 'pre_open' | 'regular' | 'post_close' | 'closed';

export interface SessionWindow {
  preOpenStartMinutes: number;
  regularStartMinutes: number;
  regularEndMinutes: number;
  postCloseEndMinutes: number;
}

export interface SessionResult {
  session: MarketSession;
  marketOpen: boolean;
  message: string;
}

const MINUTES_PER_DAY = 24 * 60;

function minuteOfDay(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function weekday(date: Date, timeZone: string): number {
  const value = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value);
}

export function evaluateMarketSession(
  now: Date,
  timeZone = 'Asia/Kolkata',
  window: SessionWindow = {
    preOpenStartMinutes: 9 * 60,
    regularStartMinutes: 9 * 60 + 15,
    regularEndMinutes: 15 * 60 + 30,
    postCloseEndMinutes: 16 * 60,
  },
): SessionResult {
  const day = weekday(now, timeZone);
  if (day === 0 || day === 6) return { session: 'closed', marketOpen: false, message: 'Indian equity markets are closed on weekends.' };

  const minute = minuteOfDay(now, timeZone);
  if (minute >= window.preOpenStartMinutes && minute < window.regularStartMinutes) {
    return { session: 'pre_open', marketOpen: false, message: 'Pre-open session: regular equity trading is not yet open.' };
  }
  if (minute >= window.regularStartMinutes && minute < window.regularEndMinutes) {
    return { session: 'regular', marketOpen: true, message: 'Regular equity trading session.' };
  }
  if (minute >= window.regularEndMinutes && minute < window.postCloseEndMinutes) {
    return { session: 'post_close', marketOpen: false, message: 'Post-close session: regular equity trading is closed.' };
  }
  return { session: 'closed', marketOpen: false, message: 'Regular equity trading is closed.' };
}

export function validateOrderForSession(orderType: string, session: MarketSession): string[] {
  if (session === 'regular') return [];
  if (orderType === 'market') return ['Market orders are permitted only during the regular equity trading session.'];
  if (session === 'pre_open') return ['This order type is not enabled for the pre-open session.'];
  return ['Order submission is blocked outside the regular equity trading session until a broker-specific session policy is configured.'];
}

export const TRADING_MINUTES_PER_DAY = MINUTES_PER_DAY;
