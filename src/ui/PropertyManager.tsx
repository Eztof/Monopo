import { gruppeVonFeld, istKaufbar } from "../engine/board";
import type { Action, GameState, SpielerId } from "../engine/types";

/** Häuser bauen/verkaufen und Hypotheken verwalten — für den Spieler, der gerade selbst entscheiden darf. */
export function PropertyManager({
  state,
  spielerId,
  onAction,
}: {
  state: GameState;
  spielerId: SpielerId;
  onAction: (action: Action) => void;
}) {
  const eigeneFelder = state.brett.felder.filter((f) => istKaufbar(f) && state.besitz[f.id].eigentuemer === spielerId);
  if (eigeneFelder.length === 0) return null;

  return (
    <div className="property-manager">
      <h3>Mein Besitz</h3>
      <div className="property-liste">
        {eigeneFelder.map((feld) => {
          const bes = state.besitz[feld.id];
          const gruppe = feld.art === "strasse" ? gruppeVonFeld(state.brett, feld.id) : undefined;
          const vollstaendig = gruppe ? gruppe.felder.every((fid) => state.besitz[fid].eigentuemer === spielerId) : false;
          return (
            <div className="property-zeile" key={feld.id}>
              <span className="property-name">{feld.name}</span>
              {feld.art === "strasse" && bes.haeuser > 0 && <span>{bes.haeuser === 5 ? "🏨" : "🏠".repeat(bes.haeuser)}</span>}
              {bes.belastet && <span className="property-belastet">belastet</span>}
              <div className="property-aktionen">
                {feld.art === "strasse" && vollstaendig && !bes.belastet && bes.haeuser < 5 && (
                  <button onClick={() => onAction({ typ: "haus-bauen", feld: feld.id })}>+ Haus/Hotel</button>
                )}
                {feld.art === "strasse" && bes.haeuser > 0 && (
                  <button onClick={() => onAction({ typ: "haus-verkaufen", feld: feld.id })}>− Haus/Hotel</button>
                )}
                {!bes.belastet && bes.haeuser === 0 && (
                  <button onClick={() => onAction({ typ: "hypothek-aufnehmen", feld: feld.id })}>Hypothek aufnehmen</button>
                )}
                {bes.belastet && (
                  <button onClick={() => onAction({ typ: "hypothek-abloesen", feld: feld.id })}>Hypothek ablösen</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
