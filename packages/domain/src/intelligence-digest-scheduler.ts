export type DigestCadence = 'daily' | 'weekly';

export interface DigestSchedule {
  cadence: DigestCadence;
  hour: number;
  minute: number;
  timezone: string;
}

export interface DigestScheduleDecision {
  shouldSend: boolean;
  reason: string;
}

export function shouldSendIntelligenceDigest(input: {
  schedule: DigestSchedule;
  now: { dayOfWeek: number; hour: number; minute: number };
  lastSentAt?: string;
}): DigestScheduleDecision {
  const { schedule, now } = input;
  if (!Number.isInteger(schedule.hour) || schedule.hour < 0 || schedule.hour > 23 ||
      !Number.isInteger(schedule.minute) || schedule.minute < 0 || schedule.minute > 59) {
    throw new Error('Invalid digest schedule time');
  }
  if (schedule.cadence === 'weekly' && now.dayOfWeek !== 1) {
    return { shouldSend: false, reason: 'Weekly digest is scheduled for Monday.' };
  }
  if (now.hour !== schedule.hour || now.minute !== schedule.minute) {
    return { shouldSend: false, reason: 'Scheduled digest time has not been reached.' };
  }
  if (input.lastSentAt) {
    const last = new Date(input.lastSentAt);
    if (!Number.isNaN(last.getTime()) &&
        last.getUTCFullYear() === new Date().getUTCFullYear() &&
        last.getUTCMonth() === new Date().getUTCMonth() &&
        last.getUTCDate() === new Date().getUTCDate()) {
      return { shouldSend: false, reason: 'Digest already sent today.' };
    }
  }
  return { shouldSend: true, reason: 'Digest schedule is due.' };
}
