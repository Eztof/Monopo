import { useEffect, useRef } from "react";
import type { GameState } from "../engine/types";

/** Das reine Ereignis-Log — was passiert ist, für alle sichtbar. Chat läuft getrennt (ChatFenster). */
export function EventLog({ state }: { state: GameState }) {
  const ende = useRef<HTMLDivElement>(null);
  const sichtbar = state.log.filter((e) => e.sichtbarFuer === "alle");

  useEffect(() => {
    ende.current?.scrollIntoView({ block: "end" });
  }, [sichtbar.length]);

  return (
    <div className="log">
      <h3>Ereignisse</h3>
      <div className="log-eintraege">
        {sichtbar.map((e, i) => (
          <div key={i} className="log-eintrag">
            {e.akteur && <span className="log-akteur">{state.spieler.find((s) => s.id === e.akteur)?.name ?? e.akteur}: </span>}
            {e.text}
          </div>
        ))}
        <div ref={ende} />
      </div>
    </div>
  );
}
