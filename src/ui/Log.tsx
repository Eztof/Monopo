import { useEffect, useRef, useState } from "react";
import type { GameState, SpielerId } from "../engine/types";

export function Log({
  state,
  ichBin,
  onChat,
}: {
  state: GameState;
  ichBin: SpielerId | null;
  onChat: (text: string) => void;
}) {
  const [entwurf, setEntwurf] = useState("");
  const ende = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ende.current?.scrollIntoView({ block: "end" });
  }, [state.log.length]);

  function senden() {
    const text = entwurf.trim();
    if (!text || !ichBin) return;
    onChat(text);
    setEntwurf("");
  }

  return (
    <div className="log">
      <div className="log-eintraege">
        {state.log.map((e, i) => (
          <div key={i} className="log-eintrag">
            {e.akteur && <span className="log-akteur">{state.spieler.find((s) => s.id === e.akteur)?.name ?? e.akteur}: </span>}
            {e.text}
          </div>
        ))}
        <div ref={ende} />
      </div>
      <div className="log-eingabe">
        <input
          type="text"
          value={entwurf}
          onChange={(ev) => setEntwurf(ev.target.value)}
          onKeyDown={(ev) => ev.key === "Enter" && senden()}
          placeholder={ichBin ? "Nachricht an alle…" : "Chat"}
          disabled={!ichBin}
          maxLength={280}
        />
        <button onClick={senden} disabled={!ichBin || !entwurf.trim()}>
          Senden
        </button>
      </div>
    </div>
  );
}
