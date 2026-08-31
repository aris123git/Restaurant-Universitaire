import type { PaymentProvider, PaymentRequest, PaymentResult } from "./PaymentProvider.js";

export class OrangeMoneyProvider implements PaymentProvider {
  readonly name = "orange_money";
  readonly implemented = false;

  async initiate(_request: PaymentRequest): Promise<PaymentResult> {
    throw new Error(
      "Orange Money n'est pas intégré. Les spécifications officielles n'ont pas encore été fournies.",
    );
  }
}
