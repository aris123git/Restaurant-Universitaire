/**
 * Abstraction USSD.
 *
 * Ne pas inventer les contrats Orange. OrangeProvider reste un stub
 * jusqu'à réception des spécifications officielles :
 * numéro/code USSD, URL/API, authentification, formats requête/réponse,
 * callbacks, sessions, environnements test et production.
 */

export type UssdInbound = {
  sessionId: string;
  phone: string;
  text: string;
};

export type UssdOutbound = {
  message: string;
  continueSession: boolean;
};

export interface UssdProvider {
  readonly name: string;
  readonly implemented: boolean;
  /**
   * Adaptateur d'entrée opérateur → moteur interne.
   * Les providers non implémentés doivent échouer clairement.
   */
  parseInbound(payload: unknown): UssdInbound;
  formatOutbound(response: UssdOutbound): unknown;
}
