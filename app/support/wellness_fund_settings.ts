import SystemSetting from '#models/system_setting'

/**
 * Wellness Fund policy settings (Settings → Wellness Fund).
 *
 * NOTE: unlike the Laravel original these accessors are async because Lucid DB
 * reads are async. Callers must `await` them.
 */
export default class WellnessFundSettings {
  static async get(key: string, fallback: string | null = null): Promise<string | null> {
    const row = await SystemSetting.query().where('group', 'wellness_fund').where('key', key).first()
    const saved = row?.value ?? null

    return saved !== null && saved !== '' ? saved : fallback
  }

  static async refundAdminFeePercent(): Promise<number> {
    return Number((await this.get('refund_admin_fee_percent', '30')) ?? 30)
  }

  static async minMonthsBeforeRefund(): Promise<number> {
    return Number.parseInt(String((await this.get('min_months_before_refund', '3')) ?? 3), 10)
  }

  static async creditPeriodDays(): Promise<number> {
    return Number.parseInt(String((await this.get('credit_period_days', '30')) ?? 30), 10)
  }

  static async lateInterestPercentMonthly(): Promise<number> {
    return Number((await this.get('late_interest_percent_monthly', '1.5')) ?? 1.5)
  }

  static async suspendDiscountOnOutstanding(): Promise<boolean> {
    return (await this.get('suspend_discount_on_outstanding', 'yes')) === 'yes'
  }

  static async excludePharmacy(): Promise<boolean> {
    return (await this.get('exclude_pharmacy', 'yes')) === 'yes'
  }

  static async excludeOutsourced(): Promise<boolean> {
    return (await this.get('exclude_outsourced', 'yes')) === 'yes'
  }

  /** @returns list of excluded service codes */
  static async excludedServiceCodes(): Promise<string[]> {
    const raw = String((await this.get('excluded_service_codes', '')) ?? '')

    return raw
      .split(/\r\n|\r|\n|,/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  }

  static async corporateSignupEnabled(): Promise<boolean> {
    return (await this.get('corporate_signup_enabled', 'yes')) === 'yes'
  }

  static async corporateSignupUrl(): Promise<string> {
    return String((await this.get('corporate_signup_url', '/wellness-fund/corporate')) ?? '')
  }

  static async fundName(): Promise<string> {
    return String((await this.get('fund_name', 'IHZ Wellness Fund')) ?? 'IHZ Wellness Fund')
  }

  static async defaultConsultationFee(): Promise<number> {
    return Number((await this.get('default_consultation_fee', '150')) ?? 150)
  }

  static async defaultLabTestFee(): Promise<number> {
    return Number((await this.get('default_lab_test_fee', '120')) ?? 120)
  }

  static async defaultPharmacyItemFee(): Promise<number> {
    return Number((await this.get('default_pharmacy_item_fee', '35')) ?? 35)
  }

  static async defaultTreatmentRoomFee(): Promise<number> {
    return Number((await this.get('default_treatment_room_fee', '100')) ?? 100)
  }

  /**
   * @returns corporate partnership option groups
   */
  static async corporatePartnershipOptions(): Promise<
    Array<{ key: string; label: string; tiers: Array<{ threshold: string; discount: string }> }>
  > {
    return [
      {
        key: 'advance_deposit',
        label: 'Option A — Advance Deposit',
        tiers: [
          {
            threshold: String((await this.get('corp_a_threshold_1', '500000')) ?? '500000'),
            discount: String((await this.get('corp_a_discount_1', '8')) ?? '8'),
          },
          {
            threshold: String((await this.get('corp_a_threshold_2', '1000000')) ?? '1000000'),
            discount: String((await this.get('corp_a_discount_2', '10')) ?? '10'),
          },
        ],
      },
      {
        key: 'hybrid',
        label: 'Option B — Hybrid Model',
        tiers: [{ threshold: 'Custom', discount: String((await this.get('corp_c_discount', '11')) ?? '11') }],
      },
    ]
  }

  /** @returns list of corporate benefits */
  static corporateBenefits(): string[] {
    return [
      'Dedicated account management',
      'Priority access — specialist appointments within one business day',
      'On-site services — annual basic health screenings (tier/spend dependent)',
      'Administrative ease — simplified billing, monthly utilization reports, 30-day credit period',
    ]
  }

  /** @returns list of corporate terms */
  static async corporateTerms(): Promise<string[]> {
    return [
      'Formal agreement required to activate partnership',
      'Discounts only when account has no outstanding bills',
      'Late payments: ' + (await this.lateInterestPercentMonthly()) + '% monthly interest',
      'Data protection per Zambian laws',
    ]
  }
}
