export type SmsMessage = {
  phone: string;
  body: string;
  reservationId?: number;
};

export type SmsResult = {
  provider: string;
  status: "SENT" | "FAILED" | "SIMULATED";
  simulated: boolean;
};

export interface SmsProvider {
  readonly name: string;
  readonly implemented: boolean;
  send(message: SmsMessage): Promise<SmsResult>;
}
