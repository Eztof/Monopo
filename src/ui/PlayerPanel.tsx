import { istKaufbar } from "../engine/board";
import type { GameState } from "../engine/types";

export function PlayerPanel({ state }: { state: GameState }) {
  return (
    <div className="spieler-panel">
      {state.spieler.map((s) => {
        const anzahlFelder = state.brett.felder.filter((f) => istKaufbar(f) && state.besitz[f.id].eigentuemer === s.id).length;
        const istAmZug = state.amZug === s.id;
        return (
          <div key={s.id} className={`spieler-zeile${istAmZug ? " am-zug" : ""}${s.bankrott ? " bankrott" : ""}`}>
            <span className="figur" style={{ background: s.farbe }} />
            <span className="spieler-name">{s.name}</span>
            <span className="spieler-geld">{state.brett.waehrung}{s.geld}</span>
            <span className="spieler-felder">{anzahlFelder} Felder</span>
            {s.imGefaengnis && <span className="spieler-tag">🔒</span>}
            {s.freiKarten > 0 && <span className="spieler-tag" title="Freikarten">🎫{s.freiKarten}</span>}
            {s.bankrott && <span className="spieler-tag">bankrott</span>}
          </div>
        );
      })}
    </div>
  );
}
