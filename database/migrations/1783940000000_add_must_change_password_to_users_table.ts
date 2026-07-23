import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    const hasColumn = await this.schema.hasColumn(this.tableName, 'must_change_password')
    if (hasColumn) {
      return
    }

    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('must_change_password').notNullable().defaultTo(false)
    })
  }

  async down() {
    const hasColumn = await this.schema.hasColumn(this.tableName, 'must_change_password')
    if (!hasColumn) {
      return
    }

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('must_change_password')
    })
  }
}
