import { useState } from "react";
import { api } from "../lib/api";

type UssdReply = {
  sessionId: string;
  message: string;
  continueSession: boolean;
  step: string;
  notice: string;
};

export function UssdSimulatorPage({ embedded = false }: { embedded?: boolean }) {
  const [phone, setPhone] = useState("+22670000001");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [screen, setScreen] = useState("Composez *XXX# pour démarrer.\n(Mode TEST — pas d’opérateur réel)");
  const [input, setInput] = useState("");
  const [ended, setEnded] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send(text: string, reset = false) {
    setBusy(true);
    try {
      const data = await api<UssdReply>("/api/ussd/simulate", {
        method: "POST",
        body: JSON.stringify({ phone, text, sessionId: reset ? undefined : sessionId }),
      });
      setSessionId(data.sessionId);
      setScreen(data.message);
      setEnded(!data.continueSession);
      setInput("");
    } catch (err) {
      setScreen(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={embedded ? "" : "mx-auto min-h-screen max-w-3xl px-6 py-10"}>
      {!embedded && (
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-moss">Simulateur étudiant</p>
          <h1 className="font-display text-4xl">USSD (TEST)</h1>
          <p className="mt-2 max-w-xl text-moss">
            Aucune API Orange n’est branchée. Ce téléphone fictif sert à démontrer le parcours réel :
            ville, RU, midi/soir, plat du jour, paiement simulé, code SMS.
          </p>
        </div>
      )}
      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        <div className="mx-auto w-[260px] rounded-[2.4rem] bg-ink p-3 shadow-tablet">
          <div className="rounded-[1.8rem] bg-[#0e1a14] px-4 py-5 text-[#d7f5e3]">
            <p className="text-center text-[10px] uppercase tracking-[0.3em] text-gold">USSD · TEST</p>
            <pre className="mt-4 min-h-[220px] whitespace-pre-wrap font-sans text-[15px] leading-6">{screen}</pre>
            {!ended && (
              <form
                className="mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="w-full rounded-lg bg-white/10 px-3 py-2 text-center text-lg"
                  inputMode="numeric"
                />
                <button disabled={busy} className="rounded-lg bg-gold px-3 font-semibold text-ink">
                  OK
                </button>
              </form>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-semibold">Numéro étudiant</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-2xl border border-sand bg-white px-4 py-3"
          />
          <div className="flex flex-wrap gap-3">
            <button
              disabled={busy}
              onClick={() => void send("", true)}
              className="rounded-2xl bg-forest px-5 py-3 font-semibold text-paper"
            >
              Composer *XXX#
            </button>
            <button
              onClick={() => {
                setSessionId(undefined);
                setEnded(false);
                setScreen("Composez *XXX# pour démarrer.\n(Mode TEST — pas d’opérateur réel)");
              }}
              className="rounded-2xl border border-forest px-5 py-3 font-semibold"
            >
              Raccrocher
            </button>
          </div>
          <p className="rounded-2xl bg-sand p-4 text-sm leading-6">
            Seuls les numéros inscrits dans la base universitaire (table des inscrits) peuvent réserver.
            Numéros de démo : +22670000001, +22670111111. Quota : 3 plats / jour (2 en fin de mois), 70 / mois.
            Après paiement, présentez le <strong>code suivi du numéro</strong> à la tablette.
          </p>
        </div>
      </div>
    </div>
  );
}
