import paymentsConfig from '#config/payments'
import type PaymentGateway from '#services/payments/payment_gateway'
import SandboxGateway from '#services/payments/sandbox_gateway'

/**
 * Resolves the configured online payment gateway. Add live providers in
 * {@link driver} as their own PaymentGateway implementations.
 */
export default class PaymentGatewayManager {
  /** Resolve a gateway by name, or the configured default when null. */
  gateway(name: string | null = null): PaymentGateway {
    return this.driver(name || paymentsConfig.gateway || 'sandbox')
  }

  driver(name: string): PaymentGateway {
    switch (name) {
      case 'sandbox':
        return new SandboxGateway()
      // case 'stripe': return new StripeGateway()
      // case 'flutterwave': return new FlutterwaveGateway()
      default:
        throw new Error(
          `Unsupported payment gateway [${name}]. Implement it in PaymentGatewayManager.driver().`
        )
    }
  }
}
