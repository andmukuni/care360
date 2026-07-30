import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Prescriptions commonly use half-tablets (e.g. item_per_dose = 2.5).
 * Integer columns rejected those values and blocked pharmacy queueing.
 */
export default class extends BaseSchema {
  protected tableName = 'pharmacy_prescription_items'

  async up() {
    await this.db.rawQuery(`
      ALTER TABLE pharmacy_prescription_items
        ALTER COLUMN item_per_dose TYPE numeric(12,2)
          USING item_per_dose::numeric(12,2),
        ALTER COLUMN quantity_prescribed TYPE numeric(14,2)
          USING quantity_prescribed::numeric(14,2)
    `)
  }

  async down() {
    await this.db.rawQuery(`
      ALTER TABLE pharmacy_prescription_items
        ALTER COLUMN item_per_dose TYPE integer
          USING ROUND(item_per_dose)::integer,
        ALTER COLUMN quantity_prescribed TYPE bigint
          USING ROUND(quantity_prescribed)::bigint
    `)
  }
}
