import { useEffect, useRef, useState } from "react";
import type { GameState, SpielerId } from "../engine/types";

interface Popup {
  id: number;
  delta: number;
  farbe: string;
}

/** Ploppt kurz +/-Beträge über den Würfeln auf, sobald sich das Geld eines Spielers ändert. */
export function GeldPopups({ state }: { state: GameState }) {
  const vorherigeRef = useRef<Record<SpielerId, number> | null>(null);
  const [popups, setPopups] = useState<Popup[]>([]);
  const zaehlerRef = useRef(0);

  useEffect(() => {
    const vorherige = vorherigeRef.current;
    if (vorherige) {
      const neue: Popup[] = [];
      for (const s of state.spieler) {
        const alt = vorherige[s.id];
        if (alt !== undefined && alt !== s.geld) {
          neue.push({ id: zaehlerRef.current++, delta: s.geld - alt, farbe: s.farbe });
        }
      }
      if (neue.length > 0) {
        setPopups((alt) => [...alt, ...neue]);
        for (const p of neue) {
          setTimeout(() => setPopups((alt) => alt.filter((x) => x.id !== p.id)), 1500);
        }
      }
    }
    vorherigeRef.current = Object.fromEntries(state.spieler.map((s) => [s.id, s.geld]));
  }, [state.spieler]);

  if (popups.length === 0) return null;

  return (
    <div className="geld-popups">
      {popups.map((p) => (
        <span key={p.id} className="geld-popup" style={{ color: p.farbe }}>
          {p.delta > 0 ? "+" : ""}
          {p.delta}
        </span>
      ))}
    </div>
  );
}
