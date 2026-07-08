import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface Job {
  type: string;
  payload: any;
  createdAt: Date;
  retries: number;
}

export type JobHandler = (job: Job) => Promise<void>;

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private readonly queue: Job[] = [];
  private processing = false;
  private destroyed = false;

  /** Register a handler for a specific job type */
  register(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
    this.logger.log(`Registered handler for job type: "${type}"`);
  }

  /** Enqueue a job for async processing. Returns immediately. */
  enqueue(type: string, payload: any): void {
    const job: Job = { type, payload, createdAt: new Date(), retries: 0 };
    this.queue.push(job);
    // Kick off processing without blocking the caller
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.processing || this.destroyed) return;
    this.processing = true;

    while (this.queue.length > 0 && !this.destroyed) {
      const job = this.queue.shift()!;
      const handler = this.handlers.get(job.type);

      if (!handler) {
        this.logger.warn(`No handler registered for job type: "${job.type}"`);
        continue;
      }

      try {
        await handler(job);
        this.logger.debug(`✅ Job "${job.type}" completed`);
      } catch (err) {
        job.retries++;
        if (job.retries < 3) {
          this.logger.warn(
            `⚠️  Job "${job.type}" failed (attempt ${job.retries}/3). Re-queuing...`,
          );
          this.queue.push(job);
        } else {
          this.logger.error(
            `❌ Job "${job.type}" failed after 3 retries. Dropping. Error: ${(err as Error).message}`,
          );
        }
      }
    }

    this.processing = false;
  }

  onModuleDestroy() {
    this.destroyed = true;
    this.logger.log('QueueService shutting down — no new jobs will be accepted');
  }
}
