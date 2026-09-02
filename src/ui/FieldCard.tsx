import { feldById, gruppeVonFeld } from "../engine/board";
import type { Action, GameState, SpielerId } from "../engine/types";

const HAUSSTUFEN_NAMEN = ["Unbebaut", "1 Haus", "2 Häuser", "3 Häuser", "4 Häuser", "Hotel"];

/**
 * Die "virtuelle Spielkarte" zu einem angeklickten Feld: Mietstaffel, Hypothekenwert, und —
 * falls es das eigene Feld ist und gerade der eigene Zug läuft — das Bauen/Verkaufen/
 * Hypothek-Menü direkt hier statt in einer separaten Liste.
 */
export function FieldCard({
  state,
  feldId,
  verwaltbarAls,
  onAction,
  onClose,
}: {
  state: GameState;
  feldId: number;
  verwaltbarAls: SpielerId | null;
  onAction: (action: Action) => void;
  onClose: () => void;
}) {
  const feld = feldById(state.brett, feldId);
  const bes = state.besitz[feldId] as (typeof state.besitz)[number] | undefined;
  const eigentuemer = bes?.eigentuemer ? state.spieler.find((s) => s.id === bes.eigentuemer) : undefined;
  const gruppe = feld.art === "strasse" ? gruppeVonFeld(state.brett, feldId) : undefined;
  const kannVerwalten = !!bes && bes.eigentuemer === verwaltbarAls;
  const vollstaendig = gruppe ? gruppe.felder.every((fid) => state.besitz[fid].eigentuemer === verwaltbarAls) : false;

  return (
    <div className="feldkarte-overlay" onClick={onClose}>
      <div className="feldkarte" onClick={(ev) => ev.stopPropagation()}>
        {gruppe && <div className="feldkarte-farbe" style={{ background: gruppe.farbe }} />}
        <div className="feldkarte-kopf">
          <h3>{feld.name}</h3>
          <button className="feldkarte-schliessen" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>

        {eigentuemer && (
          <p className="feldkarte-besitzer">
            Besitzer: <span style={{ color: eigentuemer.farbe, fontWeight: 600 }}>{eigentuemer.name}</span>
            {bes?.belastet && <span className="property-belastet"> (belastet)</span>}
          </p>
        )}
        {bes && !eigentuemer && <p className="feldkarte-besitzer">Unbebaut, kein Besitzer.</p>}

        {(feld.art === "strasse" || feld.art === "bahnhof" || feld.art === "werk") && (
          <>
            <p>
              Kaufpreis: {feld.kaufpreis} · Hypothekenwert: {feld.hypothekenwert}
            </p>
            {feld.art === "strasse" && (
              <table className="mietstaffel">
                <tbody>
                  {feld.mieten.map((betrag, i) => (
                    <tr key={i} className={bes?.haeuser === i ? "aktuell" : undefined}>
                      <td>{HAUSSTUFEN_NAMEN[i]}</td>
                      <td>{betrag}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>Unbebaut, komplettes Monopol</td>
                    <td>{feld.mieten[0] * 2}</td>
                  </tr>
                </tbody>
              </table>
            )}
            {feld.art === "bahnhof" && (
              <table className="mietstaffel">
                <tbody>
                  {feld.mieten.map((betrag, i) => (
                    <tr key={i}>
                      <td>{i + 1} Bahnhof/Bahnhöfe</td>
                      <td>{betrag}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {feld.art === "werk" && (
              <table className="mietstaffel">
                <tbody>
                  {feld.multiplikatoren.map((m, i) => (
                    <tr key={i}>
                      <td>{i + 1} Werk(e)</td>
                      <td>{m}× Würfelsumme</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {feld.art === "steuer" && <p>Zu zahlen: {feld.betrag}</p>}
        {feld.art === "karte" && <p>Zufällige {feld.stapel === "ereignis" ? "Ereignis" : "Gemeinschafts"}-Karte.</p>}
        {feld.art === "frei-parken" && <p>Aktueller Topf (Hausregel): {state.frueParkenTopf}</p>}

        {kannVerwalten && bes && (
          <div className="feldkarte-verwaltung">
            {feld.art === "strasse" && vollstaendig && !bes.belastet && bes.haeuser < 5 && (
              <button onClick={() => onAction({ typ: "haus-bauen", feld: feldId })}>+ Haus/Hotel bauen</button>
            )}
            {feld.art === "strasse" && bes.haeuser > 0 && (
              <button onClick={() => onAction({ typ: "haus-verkaufen", feld: feldId })}>− Haus/Hotel verkaufen</button>
            )}
            {!bes.belastet && bes.haeuser === 0 && (
              <button onClick={() => onAction({ typ: "hypothek-aufnehmen", feld: feldId })}>Hypothek aufnehmen</button>
            )}
            {bes.belastet && <button onClick={() => onAction({ typ: "hypothek-abloesen", feld: feldId })}>Hypothek ablösen</button>}
          </div>
        )}
      </div>
    </div>
  );
}
