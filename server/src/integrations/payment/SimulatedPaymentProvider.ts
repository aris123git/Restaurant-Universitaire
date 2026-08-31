import { generateTransactionId } from "../../lib/codes.js";
import type { PaymentProvider, PaymentRequest, PaymentResult } from "./PaymentProvider.js";

/** Mode TEST clairement identifié. Aucun argent réel n'est débité. */
export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = "simulated";
  readonly implemented = true;

  async initiate(request: PaymentRequest): Promise<PaymentResult> {
    return {
      provider: this.name,
      transactionId: generateTransactionId("SIM"),
      status: "PENDING",
      simulated: true,
    };
  }
}
