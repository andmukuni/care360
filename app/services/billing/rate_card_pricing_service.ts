import RateCardService from '#models/rate_card_service'
import WellnessFundSettings from '#support/wellness_fund_settings'

export default class RateCardPricingService {
  private consultationCache: Map<string, number> | null = null
  private labTestByCatalogId: Map<number, number> | null = null
  private labTestByName: Map<string, number> | null = null
  private medicationById: Map<number, number> | null = null
  private medicationByName: Map<string, number> | null = null
  private treatmentRoomFeeCache: number | null = null

  async consultationFee(visitType: string | null): Promise<number> {
    if (!visitType || visitType.trim() === '') {
      return WellnessFundSettings.defaultConsultationFee()
    }

    await this.ensureConsultationCache()
    const key = visitType.trim().toLowerCase()
    const price = this.consultationCache!.get(key)

    if (price !== undefined) {
      return price
    }

    return WellnessFundSettings.defaultConsultationFee()
  }

  async labTestFee(testName: string, catalogId?: number | null): Promise<number> {
    await this.ensureLabTestCache()

    if (catalogId) {
      const byId = this.labTestByCatalogId!.get(catalogId)
      if (byId !== undefined) {
        return byId
      }
    }

    const byName = this.labTestByName!.get(testName.trim().toLowerCase())
    if (byName !== undefined) {
      return byName
    }

    return WellnessFundSettings.defaultLabTestFee()
  }

  async medicationFee(drugName: string, medicationId?: number | null): Promise<number> {
    await this.ensureMedicationCache()

    if (medicationId) {
      const byId = this.medicationById!.get(medicationId)
      if (byId !== undefined) {
        return byId
      }
    }

    const byName = this.medicationByName!.get(drugName.trim().toLowerCase())
    if (byName !== undefined) {
      return byName
    }

    return WellnessFundSettings.defaultPharmacyItemFee()
  }

  async treatmentRoomFee(): Promise<number> {
    if (this.treatmentRoomFeeCache !== null) {
      return this.treatmentRoomFeeCache
    }

    const row = await RateCardService.query()
      .where('activityType', 'treatment_room')
      .where('isActive', true)
      .orderBy('id', 'asc')
      .first()

    this.treatmentRoomFeeCache = row ? Number(row.price) : await WellnessFundSettings.defaultTreatmentRoomFee()

    return this.treatmentRoomFeeCache
  }

  clearCache(): void {
    this.consultationCache = null
    this.labTestByCatalogId = null
    this.labTestByName = null
    this.medicationById = null
    this.medicationByName = null
    this.treatmentRoomFeeCache = null
  }

  private async ensureConsultationCache(): Promise<void> {
    if (this.consultationCache) {
      return
    }

    const rows = await RateCardService.query()
      .where('activityType', 'consultation')
      .where('isActive', true)

    this.consultationCache = new Map()
    for (const row of rows) {
      if (row.activityKey) {
        this.consultationCache.set(row.activityKey.trim().toLowerCase(), Number(row.price))
      }
    }
  }

  private async ensureLabTestCache(): Promise<void> {
    if (this.labTestByCatalogId && this.labTestByName) {
      return
    }

    const rows = await RateCardService.query()
      .where('activityType', 'lab_test')
      .where('isActive', true)

    this.labTestByCatalogId = new Map()
    this.labTestByName = new Map()

    for (const row of rows) {
      const price = Number(row.price)
      if (row.labTestCatalogId) {
        this.labTestByCatalogId.set(row.labTestCatalogId, price)
      }
      if (row.activityKey) {
        this.labTestByName.set(row.activityKey.trim().toLowerCase(), price)
      }
    }
  }

  private async ensureMedicationCache(): Promise<void> {
    if (this.medicationById && this.medicationByName) {
      return
    }

    const rows = await RateCardService.query()
      .where('activityType', 'medication')
      .where('isActive', true)

    this.medicationById = new Map()
    this.medicationByName = new Map()

    for (const row of rows) {
      const price = Number(row.price)
      if (row.medicationId) {
        this.medicationById.set(row.medicationId, price)
      }
      if (row.activityKey) {
        this.medicationByName.set(row.activityKey.trim().toLowerCase(), price)
      }
    }
  }
}
