/**
 * Port for scheduling deferred work (reminders, overdue nudges, digests).
 * Implementations can be in-process (setInterval/cron) or external (queue).
 */
export interface ScheduledJob {
  id: string;
  runAt: Date;
  type: string;
  payload: unknown;
}

export interface SchedulerPort {
  schedule(job: ScheduledJob): void;
  cancel(jobId: string): void;
}
