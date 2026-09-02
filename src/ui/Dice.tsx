import { aktiverAkteur } from "../engine/akteur";
import type { GameState } from "../engine/types";

/** Klassische Würfel-Punktmuster, als Indizes in einem 3x3-Raster (0..8). */
const MUSTER: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Wuerfel({ wert, farbe }: { wert: number | null; farbe: string }) {
  const aktiv = new Set(wert ? MUSTER[wert] : []);
  return (
    <div className="wuerfel" style={{ background: farbe }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className={`pip${aktiv.has(i) ? " an" : ""}`} />
      ))}
    </div>
  );
}

/** Zeigt den letzten Wurf, eingefärbt in der Farbe des gerade aktiven Spielers. */
export function Dice({ state }: { state: GameState }) {
  const aktivId = aktiverAkteur(state);
  const aktiv = state.spieler.find((p) => p.id === aktivId);
  const [w1, w2] = state.letzterWurf ?? [null, null];
  return (
    <div className="wuerfel-reihe">
      <Wuerfel wert={w1} farbe={aktiv?.farbe ?? "#888"} />
      <Wuerfel wert={w2} farbe={aktiv?.farbe ?? "#888"} />
    </div>
  );
}
