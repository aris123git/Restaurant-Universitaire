import type { PaymentProvider, PaymentRequest, PaymentResult } from "./PaymentProvider.js";

export class MoovMoneyProvider implements PaymentProvider {
  readonly name = "moov_money";
  readonly implemented = false;

  async initiate(_request: PaymentRequest): Promise<PaymentResult> {
    throw new Error(
      "Moov Money n'est pas intégré. Les spécifications officielles n'ont pas encore été fournies.",
    );
  }
}
