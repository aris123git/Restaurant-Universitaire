import { useState } from "react";
import { api } from "../../lib/api";

type Outcome = {
  ok: boolean;
  reason: string;
  reservation?: {
    code: string;
    phone: string;
    service: string;
    dishName: string;
    quantity: number;
    status: string;
  };
};

const MESSAGES: Record<string, string> = {
  VALID: "Réservation valide",
  NOT_FOUND: "Code introuvable",
  CODE_PHONE_MISMATCH: "Code et numéro ne correspondent pas",
  WRONG_RESTAURANT: "Ce code n’appartient pas à ce restaurant",
  ALREADY_USED: "Code déjà utilisé",
  EXPIRED: "Code expiré",
  NOT_PAID: "Paiement non confirmé",
  CANCELLED: "Réservation annulée",
};

export function RuVerify() {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      setResult(
        await api<Outcome>("/api/ru/verify", {
          method: "POST",
          body: JSON.stringify({ code, phone }),
        }),
      );
    } catch (err) {
      setResult({ ok: false, reason: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setBusy(false);
    }
  }

  async function issue() {
    setBusy(true);
    try {
      setResult(
        await api<Outcome>("/api/ru/tokens", {
          method: "POST",
          body: JSON.stringify({ code, phone }),
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  const valid = result?.ok && result.reservation && result.reservation.status !== "SERVED";
  const served = result?.ok && result.reservation?.status === "SERVED";

  return (
    <div className="mx-auto max-w-2xl">
      <section className="rounded-3xl bg-white p-8 shadow-tablet">
        <h2 className="font-display text-3xl">Vérifier un code</h2>
        <p className="mt-2 text-moss">
          Saisissez le code SMS <strong>suivi du numéro</strong> de l’étudiant. Remettez ensuite les jetons
          physiques déjà sur place.
        </p>
        <form onSubmit={lookup} className="mt-6 grid gap-3">
          <label className="text-sm font-semibold">Code de réservation</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="RU-XXXXXX"
            className="w-full rounded-2xl border border-sand bg-paper px-4 py-4 text-center font-display text-3xl tracking-[0.35em]"
            autoFocus
          />
          <label className="text-sm font-semibold">Numéro de téléphone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="70 00 00 01"
            inputMode="tel"
            className="w-full rounded-2xl border border-sand bg-paper px-4 py-4 text-center font-display text-3xl tracking-[0.2em]"
          />
          <button disabled={busy} className="rounded-2xl bg-forest px-8 py-4 text-xl font-semibold text-paper">
            Valider
          </button>
        </form>
      </section>

      {result && (
        <section
          className={`mt-6 rounded-3xl p-8 text-center shadow-tablet ${
            result.ok ? "bg-ok text-paper" : "bg-brick text-paper"
          }`}
        >
          <p className="text-sm uppercase tracking-[0.25em]">{result.ok ? "Validé" : "Refusé"}</p>
          <h3 className="mt-2 font-display text-4xl">{MESSAGES[result.reason] ?? result.reason}</h3>
          {result.reservation && (
            <div className="mt-6 space-y-1 text-xl">
              <p>Étudiant : {result.reservation.phone}</p>
              <p>Service : {result.reservation.service}</p>
              <p>Plat : {result.reservation.dishName}</p>
              <p className="font-display text-5xl">
                {result.reservation.quantity} plat{result.reservation.quantity > 1 ? "s" : ""}
              </p>
            </div>
          )}
          {valid && (
            <button
              onClick={() => void issue()}
              disabled={busy}
              className="mt-8 w-full rounded-2xl bg-paper py-5 text-2xl font-semibold text-ink"
            >
              Remettre {result.reservation?.quantity} jeton{(result.reservation?.quantity ?? 0) > 1 ? "s" : ""}
            </button>
          )}
          {served && (
            <p className="mt-6 rounded-2xl bg-paper/15 py-4 text-xl">Jetons remis · réservation servie</p>
          )}
        </section>
      )}
    </div>
  );
}
