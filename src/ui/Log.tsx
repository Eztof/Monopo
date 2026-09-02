import { useEffect, useRef, useState } from "react";
import type { GameState, SpielerId } from "../engine/types";

/**
 * Ereignisse (alle sichtbar) + ein Einzel-Chat mit einem gewählten Partner — bewusst kein
 * Gruppenchat: jede KI bekommt ihr eigenes Gespräch, genau wie später mit echten Persönlichkeiten.
 */
export function Log({
  state,
  ichBin,
  onChat,
}: {
  state: GameState;
  ichBin: SpielerId | null;
  onChat: (text: string, an: SpielerId) => void;
}) {
  const partnerListe = state.spieler.filter((s) => s.id !== ichBin && !s.bankrott);
  const [partnerId, setPartnerId] = useState(partnerListe[0]?.id ?? "");
  const [entwurf, setEntwurf] = useState("");
  const ende = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!partnerListe.some((p) => p.id === partnerId) && partnerListe[0]) setPartnerId(partnerListe[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.spieler.length]);

  useEffect(() => {
    ende.current?.scrollIntoView({ block: "end" });
  }, [state.log.length, partnerId]);

  const sichtbar = state.log.filter(
    (e) => e.sichtbarFuer === "alle" || (ichBin && partnerId && Array.isArray(e.sichtbarFuer) && e.sichtbarFuer.includes(ichBin) && e.sichtbarFuer.includes(partnerId)),
  );

  function senden() {
    const text = entwurf.trim();
    if (!text || !ichBin || !partnerId) return;
    onChat(text, partnerId);
    setEntwurf("");
  }

  return (
    <div className="log">
      <div className="log-eintraege">
        {sichtbar.map((e, i) => (
          <div key={i} className="log-eintrag">
            {e.akteur && <span className="log-akteur">{state.spieler.find((s) => s.id === e.akteur)?.name ?? e.akteur}: </span>}
            {e.text}
          </div>
        ))}
        <div ref={ende} />
      </div>
      {ichBin && partnerListe.length > 0 && (
        <div className="log-eingabe">
          <select value={partnerId} onChange={(ev) => setPartnerId(ev.target.value)} title="Chat-Partner">
            {partnerListe.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={entwurf}
            onChange={(ev) => setEntwurf(ev.target.value)}
            onKeyDown={(ev) => ev.key === "Enter" && senden()}
            placeholder={`Nachricht an ${state.spieler.find((p) => p.id === partnerId)?.name ?? "…"}`}
            maxLength={280}
          />
          <button onClick={senden} disabled={!entwurf.trim()}>
            Senden
          </button>
        </div>
      )}
    </div>
  );
}
