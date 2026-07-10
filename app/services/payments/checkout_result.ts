/**
 * Normalised result of starting an online checkout. The portal redirects the
 * patient to {@link redirectUrl}; the gateway later calls our webhook quoting
 * {@link reference} so we can reconcile the payment back to its invoice.
 */
export default class CheckoutResult {
  constructor(
    public readonly redirectUrl: string,
    public readonly reference: string
  ) {}
}
