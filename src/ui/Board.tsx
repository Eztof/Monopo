import { useEffect, useRef, useState, type ReactNode } from "react";
import { gruppeVonFeld } from "../engine/board";
import type { Feld, GameState } from "../engine/types";
import { hexZuRgba } from "./farbe";

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

function feldKurzInfo(feld: Feld, topf: number): string {
  switch (feld.art) {
    case "strasse":
    case "bahnhof":
    case "werk":
      return `${feld.kaufpreis}`;
    case "steuer":
      return `${feld.betrag}`;
    case "frei-parken":
      return topf > 0 ? `Topf: ${topf}` : "";
    default:
      return "";
  }
}

/** Felder, auf denen gerade eben ein Spieler gelandet ist — kurz aufleuchtend statt nur am Pünktchen erkennbar. */
function useGeradeGelandet(state: GameState): Set<number> {
  const vorherigeRef = useRef<Record<string, number> | null>(null);
  const [blitz, setBlitz] = useState<Set<number>>(new Set());

  useEffect(() => {
    const vorherige = vorherigeRef.current;
    const neuePositionen: number[] = [];
    if (vorherige) {
      for (const s of state.spieler) {
        if (vorherige[s.id] !== undefined && vorherige[s.id] !== s.position) neuePositionen.push(s.position);
      }
    }
    vorherigeRef.current = Object.fromEntries(state.spieler.map((s) => [s.id, s.position]));

    if (neuePositionen.length === 0) return;
    setBlitz((alt) => new Set([...alt, ...neuePositionen]));
    const timer = setTimeout(() => {
      setBlitz((alt) => {
        const kopie = new Set(alt);
        neuePositionen.forEach((id) => kopie.delete(id));
        return kopie;
      });
    }, 900);
    return () => clearTimeout(timer);
  }, [state.spieler]);

  return blitz;
}

export function Board({
  state,
  center,
  onFieldClick,
}: {
  state: GameState;
  center: ReactNode;
  onFieldClick: (feldId: number) => void;
}) {
  const geradeGelandet = useGeradeGelandet(state);

  return (
    <div className="brett">
      {state.brett.felder.map((feld) => {
        const { row, col } = gridPos(feld.id);
        const gruppe = feld.art === "strasse" ? gruppeVonFeld(state.brett, feld.id) : undefined;
        const bes = state.besitz[feld.id] as (typeof state.besitz)[number] | undefined;
        const eigentuemer = bes?.eigentuemer ? state.spieler.find((s) => s.id === bes.eigentuemer) : undefined;
        const spielerHier = state.spieler.filter((s) => !s.bankrott && s.position === feld.id);
        return (
          <button
            key={feld.id}
            type="button"
            className={`feld${geradeGelandet.has(feld.id) ? " feld-blitz" : ""}`}
            style={{ gridRow: row, gridColumn: col, background: eigentuemer ? hexZuRgba(eigentuemer.farbe, bes?.belastet ? 0.18 : 0.4) : undefined }}
            title={feld.name}
            onClick={() => onFieldClick(feld.id)}
          >
            {gruppe && <div className="feld-farbe" style={{ background: gruppe.farbe }} />}
            <div className="feld-name">{feld.name}</div>
            <div className="feld-info">{feldKurzInfo(feld, state.frueParkenTopf)}</div>
            {bes && bes.haeuser > 0 && (
              <div className="feld-haeuser">{bes.haeuser === 5 ? "🏨" : "🏠".repeat(bes.haeuser)}</div>
            )}
            {eigentuemer && (
              <div className="feld-eigentuemer-name" style={{ color: eigentuemer.farbe }}>
                {eigentuemer.name}
              </div>
            )}
            {bes?.belastet && <div className="feld-hypothek">belastet</div>}
            {spielerHier.length > 0 && (
              <div className="feld-figuren">
                {spielerHier.map((s) => (
                  <span key={s.id} className="figur" style={{ background: s.farbe }} title={s.name} />
                ))}
              </div>
            )}
          </button>
        );
      })}
      <div className="brett-mitte" style={{ gridRow: "2 / 11", gridColumn: "2 / 11" }}>
        {center}
      </div>
    </div>
  );
}
