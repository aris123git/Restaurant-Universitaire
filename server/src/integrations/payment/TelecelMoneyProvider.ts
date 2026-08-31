import type { PaymentProvider, PaymentRequest, PaymentResult } from "./PaymentProvider.js";

export class TelecelMoneyProvider implements PaymentProvider {
  readonly name = "telecel_money";
  readonly implemented = false;

  async initiate(_request: PaymentRequest): Promise<PaymentResult> {
    throw new Error(
      "Telecel Money n'est pas intégré. Les spécifications officielles n'ont pas encore été fournies.",
    );
  }
}
