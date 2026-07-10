import MembershipPlan from '#models/membership_plan'
import Patient from '#models/patient'
import WellnessFundAccount from '#models/wellness_fund_account'
import WellnessFundService, { type EnrollOptions } from '#services/membership/wellness_fund_service'
import { num } from '#support/money_helpers'

/**
 * @deprecated Use WellnessFundService. Thin alias for legacy imports.
 */
export default class SubscriptionService extends WellnessFundService {
  async subscribe(
    patient: Patient,
    plan: MembershipPlan,
    _cycle: string,
    opts: EnrollOptions = {}
  ): Promise<WellnessFundAccount> {
    return this.enroll(patient, plan, num(plan.minimumDeposit), opts)
  }
}
