import { randomUUID } from 'node:crypto'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Notification from '#models/notification'

export interface CreateNotificationInput {
  notifiableId: number
  notifiableType?: string
  type: string
  data: Record<string, unknown>
  client?: TransactionClientContract
}

/**
 * Minimal database-notification helper.
 *
 * Inserts rows into the `notifications` table, matching Laravel's morphed
 * database notification schema: id (uuid), type (notification class), notifiable
 * (morph) columns, data (json), read_at, timestamps. This stands in for a fuller
 * NotificationService until one is built in a later phase.
 */
export class NotificationService {
  static readonly DEFAULT_NOTIFIABLE_TYPE = 'App\\Models\\User'

  /** Create a single database notification row. */
  async create(input: CreateNotificationInput): Promise<Notification> {
    return Notification.create(
      {
        id: randomUUID(),
        type: input.type,
        notifiableType: input.notifiableType ?? NotificationService.DEFAULT_NOTIFIABLE_TYPE,
        notifiableId: input.notifiableId,
        data: JSON.stringify(input.data),
        readAt: null,
      },
      { client: input.client }
    )
  }

  /** Create the same notification for many recipients. */
  async createMany(
    notifiableIds: number[],
    type: string,
    data: Record<string, unknown>,
    options: { notifiableType?: string; client?: TransactionClientContract } = {}
  ): Promise<void> {
    for (const notifiableId of notifiableIds) {
      await this.create({
        notifiableId,
        notifiableType: options.notifiableType,
        type,
        data,
        client: options.client,
      })
    }
  }
}
