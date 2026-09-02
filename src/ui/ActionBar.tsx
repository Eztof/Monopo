import { useState } from "react";
import { feldById } from "../engine/board";
import type { Action, GameState, SpielerId } from "../engine/types";

/** Die Aktionsleiste für den Menschen, der gerade laut Phase entscheiden darf. */
export function ActionBar({ state, ichBin, onAction }: { state: GameState; ichBin: SpielerId; onAction: (a: Action) => void }) {
  const [gebot, setGebot] = useState(0);
  const s = state.spieler.find((p) => p.id === ichBin)!;
  const phase = state.phase;

  switch (phase.typ) {
    case "wuerfeln":
      return (
        <div className="action-bar">
          <button className="primaer" onClick={() => onAction({ typ: "wuerfeln" })}>
            Würfeln
          </button>
        </div>
      );

    case "gefaengnis-entscheidung":
      return (
        <div className="action-bar">
          <p>Du sitzt im Gefängnis (Versuch {s.gefaengnisRunden + 1}/3).</p>
          <button onClick={() => onAction({ typ: "wuerfeln" })}>Würfeln (Pasch = frei)</button>
          <button disabled={s.geld < state.brett.gefaengnisKaution} onClick={() => onAction({ typ: "kaution-zahlen" })}>
            Kaution zahlen ({state.brett.gefaengnisKaution})
          </button>
          {s.freiKarten > 0 && <button onClick={() => onAction({ typ: "frei-karte-nutzen" })}>Freikarte nutzen</button>}
        </div>
      );

    case "karte-bestaetigen":
      return (
        <div className="action-bar">
          <p className="karten-text">{phase.karte.text}</p>
          <button className="primaer" onClick={() => onAction({ typ: "weiter" })}>
            Weiter
          </button>
        </div>
      );

    case "kaufentscheidung": {
      const feld = feldById(state.brett, phase.feld);
      if (feld.art !== "strasse" && feld.art !== "bahnhof" && feld.art !== "werk") return null;
      return (
        <div className="action-bar">
          <p>
            {feld.name} kaufen für {feld.kaufpreis}?
          </p>
          <button className="primaer" disabled={s.geld < feld.kaufpreis} onClick={() => onAction({ typ: "kaufen" })}>
            Kaufen
          </button>
          <button onClick={() => onAction({ typ: "auktion-starten" })}>Versteigern</button>
        </div>
      );
    }

    case "auktion": {
      const auktion = phase.auktion;
      if (auktion.amZug !== ichBin) return <div className="action-bar">Warte auf die anderen Bieter…</div>;
      const feld = feldById(state.brett, auktion.feld);
      const minGebot = auktion.hoechstgebot + 1;
      return (
        <div className="action-bar">
          <p>
            Auktion: {feld.name} — Höchstgebot {auktion.hoechstgebot}
            {auktion.hoechstbietender ? ` (${state.spieler.find((p) => p.id === auktion.hoechstbietender)?.name})` : ""}
          </p>
          <input type="number" min={minGebot} value={gebot || minGebot} onChange={(ev) => setGebot(Number(ev.target.value))} />
          <button disabled={s.geld < (gebot || minGebot)} onClick={() => onAction({ typ: "bieten", betrag: gebot || minGebot })}>
            Bieten
          </button>
          <button onClick={() => onAction({ typ: "aussteigen" })}>Aussteigen</button>
        </div>
      );
    }

    case "schuld-offen": {
      const { schuld } = phase;
      return (
        <div className="action-bar">
          <p>
            Offene Schuld: {schuld.betrag} ({schuld.grund})
          </p>
          <button className="primaer" disabled={s.geld < schuld.betrag} onClick={() => onAction({ typ: "schuld-begleichen" })}>
            Begleichen
          </button>
          <button onClick={() => onAction({ typ: "bankrott-erklaeren" })}>Bankrott erklären</button>
        </div>
      );
    }

    case "zug-ende":
      return (
        <div className="action-bar">
          <button className="primaer" onClick={() => onAction({ typ: "zug-beenden" })}>
            Zug beenden
          </button>
        </div>
      );

    case "spiel-ende":
      return (
        <div className="action-bar">
          <p>{state.spieler.find((p) => p.id === phase.sieger)?.name} gewinnt das Spiel! 🎉</p>
        </div>
      );

    default:
      return null;
  }
}
