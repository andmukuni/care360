import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'rate_card_services'

  async up() {
    const exists = await this.schema.hasTable(this.tableName)
    if (exists) {
      return
    }

    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('code', 80).notNullable().unique()
      table.string('name').notNullable()
      table.string('category', 50).notNullable().defaultTo('hospital')
      table.string('activity_type', 50).notNullable()
      table.string('activity_key').nullable()
      table.integer('lab_test_catalog_id').unsigned().nullable().references('id').inTable('lab_test_catalog').onDelete('SET NULL')
      table.integer('medication_id').unsigned().nullable().references('id').inTable('medications').onDelete('SET NULL')
      table.decimal('price', 10, 2).notNullable().defaultTo(0)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['activity_type', 'activity_key'])
      table.index('is_active')
      table.index('lab_test_catalog_id')
      table.index('medication_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
