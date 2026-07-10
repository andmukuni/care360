import { DateTime } from 'luxon'
import { column, beforeFind, beforeFetch } from '@adonisjs/lucid/orm'
import type { NormalizeConstructor } from '@adonisjs/core/types/helpers'
import type { BaseModel } from '@adonisjs/lucid/orm'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

/**
 * SoftDeletes mixin: adds a `deletedAt` column, scopes queries to exclude
 * trashed rows by default, and provides `softDelete`/`restore` helpers.
 * Mirrors Laravel's SoftDeletes trait (used by the Encounter model).
 */
export function SoftDeletes<Model extends NormalizeConstructor<typeof BaseModel>>(superclass: Model) {
  class SoftDeleteModel extends superclass {
    @column.dateTime({ columnName: 'deleted_at' })
    declare deletedAt: DateTime | null

    get trashed(): boolean {
      return this.deletedAt !== null
    }

    @beforeFind()
    @beforeFetch()
    static ignoreDeleted(query: ModelQueryBuilderContract<any>) {
      if (!(query as any).__withTrashed) {
        query.whereNull('deleted_at')
      }
    }

    async softDelete() {
      this.deletedAt = DateTime.now()
      await this.save()
    }

    async restore() {
      this.deletedAt = null
      await this.save()
    }
  }

  return SoftDeleteModel
}
