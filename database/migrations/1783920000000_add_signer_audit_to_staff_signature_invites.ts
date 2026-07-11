import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'staff_signature_invites'

  async up() {
    const hasIp = await this.schema.hasColumn(this.tableName, 'signer_ip')
    if (hasIp) {
      return
    }

    this.schema.alterTable(this.tableName, (table) => {
      table.string('signer_ip', 45).nullable()
      table.string('signer_user_agent', 500).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('signer_ip')
      table.dropColumn('signer_user_agent')
    })
  }
}
