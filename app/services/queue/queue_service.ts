import logger from '@adonisjs/core/services/logger'

/**
 * Minimal DB-backed queue abstraction.
 *
 * Phase 7 ships an INLINE executor: dispatching a job runs its `handle()`
 * immediately (awaited). This mirrors Laravel's `dispatchSync()` and is safe on
 * shared hosting where no worker/Supervisor is available.
 *
 * A real driver (e.g. @rlanz/bull-queue, or a poller over the existing `jobs`
 * table) is a follow-up: implement `enqueue()` to persist to `jobs` and have a
 * worker resolve + run the job. The `Job` contract and `JobDispatcher`
 * interface below are the seam for that swap — callers won't change.
 */
export interface Job {
  /** Optional queue name (Laravel `onQueue`). Informational for the inline driver. */
  readonly queue?: string
  /** Execute the job's work. */
  handle(): Promise<void> | void
}

export interface JobDispatcher {
  /** Queue a job for (eventual) background execution. Inline driver runs it now. */
  dispatch(job: Job): Promise<void>
  /** Run a job synchronously, in-process. */
  dispatchSync(job: Job): Promise<void>
}

/**
 * Inline dispatcher: runs jobs in-process. Errors are logged and re-thrown so
 * the caller (and, later, a real worker's retry logic) can react.
 */
class InlineJobDispatcher implements JobDispatcher {
  async dispatch(job: Job): Promise<void> {
    // TODO(queue-driver): persist to the `jobs` table and let a worker run this
    // instead of executing inline. See file header for the migration path.
    await this.run(job)
  }

  async dispatchSync(job: Job): Promise<void> {
    await this.run(job)
  }

  private async run(job: Job): Promise<void> {
    try {
      await job.handle()
    } catch (error) {
      logger.error({ err: error, queue: job.queue ?? 'default' }, 'Inline job execution failed')
      throw error
    }
  }
}

/** Canonical dispatcher instance used across the app. */
export const queue: JobDispatcher = new InlineJobDispatcher()
