import { useEffect, useRef, useState } from "react";
import type { GameState, Spieler, SpielerId } from "../engine/types";

/** Ein eigenes, dauerhaftes Chatfenster pro Gegner — kein Gruppenchat, keine Dropdown-Umschaltung. */
export function ChatFenster({
  state,
  ichBin,
  partner,
  wartetAufAntwort,
  onChat,
}: {
  state: GameState;
  ichBin: SpielerId;
  partner: Spieler;
  wartetAufAntwort: boolean;
  onChat: (text: string) => void;
}) {
  const [entwurf, setEntwurf] = useState("");
  const ende = useRef<HTMLDivElement>(null);

  const nachrichten = state.log.filter(
    (e) => e.art === "chat" && Array.isArray(e.sichtbarFuer) && e.sichtbarFuer.includes(ichBin) && e.sichtbarFuer.includes(partner.id),
  );

  useEffect(() => {
    ende.current?.scrollIntoView({ block: "end" });
  }, [nachrichten.length, wartetAufAntwort]);

  function senden() {
    const text = entwurf.trim();
    if (!text) return;
    onChat(text);
    setEntwurf("");
  }

  return (
    <div className="chatfenster">
      <div className="chatfenster-kopf">
        <span className="figur" style={{ background: partner.farbe }} />
        <strong>{partner.name}</strong>
      </div>
      <div className="chatfenster-verlauf">
        {nachrichten.length === 0 && <p className="chatfenster-leer">Noch keine Nachrichten.</p>}
        {nachrichten.map((e, i) => (
          <div key={i} className={`chatfenster-nachricht${e.akteur === ichBin ? " eigene" : ""}`}>
            {e.text}
          </div>
        ))}
        {wartetAufAntwort && <div className="chatfenster-nachricht chatfenster-tippt">{partner.name} tippt …</div>}
        <div ref={ende} />
      </div>
      <div className="chatfenster-eingabe">
        <input
          type="text"
          value={entwurf}
          onChange={(ev) => setEntwurf(ev.target.value)}
          onKeyDown={(ev) => ev.key === "Enter" && senden()}
          placeholder={`Nachricht an ${partner.name}`}
          maxLength={280}
        />
        <button onClick={senden} disabled={!entwurf.trim()}>
          Senden
        </button>
      </div>
    </div>
  );
}
