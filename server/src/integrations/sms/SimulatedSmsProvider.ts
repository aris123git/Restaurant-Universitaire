import { getDb } from "../../db/client.js";
import { logger } from "../../lib/logger.js";
import type { SmsMessage, SmsProvider, SmsResult } from "./SmsProvider.js";

/** Mode simulation : le SMS est journalisé et visible dans l'admin. */
export class SimulatedSmsProvider implements SmsProvider {
  readonly name = "simulated";
  readonly implemented = true;

  async send(message: SmsMessage): Promise<SmsResult> {
    getDb()
      .prepare(
        `INSERT INTO sms_logs (phone, message, provider, status, reservation_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(message.phone, message.body, this.name, "SIMULATED", message.reservationId ?? null);
    logger.info("sms.simulated", { phone: message.phone, reservationId: message.reservationId });
    return { provider: this.name, status: "SIMULATED", simulated: true };
  }
}
