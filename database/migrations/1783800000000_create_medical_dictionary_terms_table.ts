import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'medical_dictionary_terms'

  async up() {
    const exists = await this.schema.hasTable(this.tableName)
    if (exists) {
      return
    }

    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('domain', 40).notNullable()
      table.string('code', 120).nullable()
      table.string('label', 500).notNullable()
      table.text('synonyms').nullable()
      table.text('definition').nullable()
      table.string('hierarchy_path', 1000).nullable()
      table.string('source', 40).notNullable().defaultTo('manual')
      table.string('source_id', 120).nullable()
      table.string('hia_code', 80).nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.integer('updated_by').unsigned().nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['domain', 'is_active'])
      table.index(['source', 'source_id'])
      table.index('label')
      table.index('code')
      table.unique(['domain', 'source', 'source_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
