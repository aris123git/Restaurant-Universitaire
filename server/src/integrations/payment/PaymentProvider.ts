/**
 * Abstraction paiement.
 * Ne pas inventer les APIs Orange Money / Moov / Telecel.
 * Une réservation n'est confirmée qu'après confirmation du paiement.
 */

export type PaymentRequest = {
  reservationId: number;
  amount: number;
  phone: string;
  reference: string;
};

export type PaymentResult = {
  provider: string;
  transactionId: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";
  simulated: boolean;
};

export interface PaymentProvider {
  readonly name: string;
  readonly implemented: boolean;
  initiate(request: PaymentRequest): Promise<PaymentResult>;
}
