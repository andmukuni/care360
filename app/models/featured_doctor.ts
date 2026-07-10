import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class FeaturedDoctor extends BaseModel {
  static table = 'featured_doctors'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare specialty: string

  @column()
  declare bio: string | null

  @column()
  declare rating: number

  @column()
  declare patientsCount: number | null

  @column()
  declare yearsExperience: number | null

  @column()
  declare reviewCount: number | null

  @column()
  declare sessionFee: number | null

  @column()
  declare photoUrl: string | null

  @column()
  declare photoPath: string | null

  @column()
  declare sortOrder: number

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

}
