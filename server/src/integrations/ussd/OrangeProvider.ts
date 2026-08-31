import type { UssdInbound, UssdOutbound, UssdProvider } from "./UssdProvider.js";

/**
 * Orange USSD — NON IMPLÉMENTÉ.
 * Aucune API, URL, payload ou authentification n'est inventée ici.
 */
export class OrangeUssdProvider implements UssdProvider {
  readonly name = "orange";
  readonly implemented = false;

  parseInbound(_payload: unknown): UssdInbound {
    throw new Error(
      "Orange USSD n'est pas intégré. Les spécifications officielles n'ont pas encore été fournies (numéro, API, auth, formats, callbacks, sessions, environnements).",
    );
  }

  formatOutbound(_response: UssdOutbound): unknown {
    throw new Error(
      "Orange USSD n'est pas intégré. Les spécifications officielles n'ont pas encore été fournies.",
    );
  }
}
