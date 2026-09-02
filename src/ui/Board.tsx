import type { ReactNode } from "react";
import { gruppeVonFeld } from "../engine/board";
import type { Feld, GameState } from "../engine/types";

/** Position im 11x11-Perimeter-Grid, klassisches Monopoly-Layout. */
function gridPos(id: number): { row: number; col: number } {
  if (id === 0) return { row: 11, col: 11 };
  if (id <= 9) return { row: 11, col: 11 - id };
  if (id === 10) return { row: 11, col: 1 };
  if (id <= 19) return { row: 11 - (id - 10), col: 1 };
  if (id === 20) return { row: 1, col: 1 };
  if (id <= 29) return { row: 1, col: 1 + (id - 20) };
  if (id === 30) return { row: 1, col: 11 };
  return { col: 11, row: 1 + (id - 30) };
}

function feldKurzInfo(feld: Feld): string {
  switch (feld.art) {
    case "strasse":
    case "bahnhof":
    case "werk":
      return `${feld.kaufpreis}`;
    case "steuer":
      return `${feld.betrag}`;
    default:
      return "";
  }
}

export function Board({ state, center }: { state: GameState; center: ReactNode }) {
  return (
    <div className="brett">
      {state.brett.felder.map((feld) => {
        const { row, col } = gridPos(feld.id);
        const gruppe = feld.art === "strasse" ? gruppeVonFeld(state.brett, feld.id) : undefined;
        const bes = state.besitz[feld.id] as (typeof state.besitz)[number] | undefined;
        const eigentuemer = bes?.eigentuemer ? state.spieler.find((s) => s.id === bes.eigentuemer) : undefined;
        const spielerHier = state.spieler.filter((s) => !s.bankrott && s.position === feld.id);
        return (
          <div
            key={feld.id}
            className="feld"
            style={{ gridRow: row, gridColumn: col }}
            title={feld.name}
          >
            {gruppe && <div className="feld-farbe" style={{ background: gruppe.farbe }} />}
            <div className="feld-name">{feld.name}</div>
            <div className="feld-info">{feldKurzInfo(feld)}</div>
            {bes && bes.haeuser > 0 && (
              <div className="feld-haeuser">{bes.haeuser === 5 ? "🏨" : "🏠".repeat(bes.haeuser)}</div>
            )}
            {eigentuemer && (
              <div className="feld-eigentuemer" style={{ background: eigentuemer.farbe }} title={`Besitzer: ${eigentuemer.name}`} />
            )}
            {bes?.belastet && <div className="feld-hypothek">H</div>}
            {spielerHier.length > 0 && (
              <div className="feld-figuren">
                {spielerHier.map((s) => (
                  <span key={s.id} className="figur" style={{ background: s.farbe }} title={s.name} />
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="brett-mitte" style={{ gridRow: "2 / 11", gridColumn: "2 / 11" }}>
        {center}
      </div>
    </div>
  );
}
