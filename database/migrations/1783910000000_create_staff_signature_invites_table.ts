import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'staff_signature_invites'

  async up() {
    const exists = await this.schema.hasTable(this.tableName)
    if (exists) {
      return
    }

    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('token', 64).notNullable().unique()
      table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('expires_at').notNullable()
      table.timestamp('completed_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['user_id', 'completed_at'])
      table.index('expires_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
