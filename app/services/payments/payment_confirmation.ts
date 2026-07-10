/**
 * Normalised, provider-agnostic view of an inbound payment webhook after it has
 * been verified. The controller uses this to mark the matching invoice paid.
 */
export default class PaymentConfirmation {
  constructor(
    public readonly invoiceId: number,
    public readonly amount: number,
    public readonly providerReference: string,
    public readonly successful: boolean
  ) {}
}
