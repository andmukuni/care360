import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    const hasColumn = await this.schema.hasColumn(this.tableName, 'signature_path')
    if (hasColumn) {
      return
    }

    this.schema.alterTable(this.tableName, (table) => {
      table.string('signature_path', 255).nullable()
    })
  }

  async down() {
    const hasColumn = await this.schema.hasColumn(this.tableName, 'signature_path')
    if (!hasColumn) {
      return
    }

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('signature_path')
    })
  }
}
