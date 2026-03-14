import type { SchedulerPort, ScheduledJob } from "../../application/ports/SchedulerPort";

/**
 * In-process scheduler using setTimeout. Jobs run in the same process; no persistence.
 */
export class InProcessScheduler implements SchedulerPort {
  private timeouts = new Map<string, NodeJS.Timeout>();
  private handler: ((job: ScheduledJob) => void) | null = null;

  setHandler(handler: (job: ScheduledJob) => void): void {
    this.handler = handler;
  }

  schedule(job: ScheduledJob): void {
    this.cancel(job.id);
    const delay = Math.max(0, job.runAt.getTime() - Date.now());
    const timeout = setTimeout(() => {
      this.timeouts.delete(job.id);
      this.handler?.(job);
    }, delay);
    this.timeouts.set(job.id, timeout);
  }

  cancel(jobId: string): void {
    const t = this.timeouts.get(jobId);
    if (t) {
      clearTimeout(t);
      this.timeouts.delete(jobId);
    }
  }
}
