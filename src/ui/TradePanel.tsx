import { useState } from "react";
import { istKaufbar } from "../engine/board";
import type { Action, GameState, Handelsangebot, SpielerId } from "../engine/types";

function eigeneFelder(state: GameState, spielerId: SpielerId): number[] {
  return state.brett.felder.filter((f) => istKaufbar(f) && state.besitz[f.id].eigentuemer === spielerId).map((f) => f.id);
}

type Entwurf = {
  partnerId: string;
  gebeFelder: number[];
  willFelder: number[];
  gebeGeld: number;
  willGeld: number;
  gebeFreiKarten: number;
  willFreiKarten: number;
};

function leererEntwurf(partnerId: string): Entwurf {
  return { partnerId, gebeFelder: [], willFelder: [], gebeGeld: 0, willGeld: 0, gebeFreiKarten: 0, willFreiKarten: 0 };
}

export function TradePanel({
  state,
  ichBin,
  onAction,
}: {
  state: GameState;
  ichBin: SpielerId;
  onAction: (action: Action) => void;
}) {
  const partnerListe = state.spieler.filter((s) => s.id !== ichBin && !s.bankrott);
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const [verlaufOffen, setVerlaufOffen] = useState(false);

  const ich = state.spieler.find((s) => s.id === ichBin)!;
  const partner = state.spieler.find((s) => s.id === entwurf?.partnerId);

  function feldName(id: number): string {
    return state.brett.felder.find((f) => f.id === id)?.name ?? String(id);
  }

  function spielerName(id: SpielerId): string {
    return state.spieler.find((s) => s.id === id)?.name ?? id;
  }

  function beschreibePaket(felder: number[], geld: number, freiKarten: number): string {
    return (
      [...felder.map(feldName), geld > 0 ? `${geld} Geld` : "", freiKarten > 0 ? `${freiKarten} Freikarte(n)` : ""].filter(Boolean).join(", ") ||
      "nichts"
    );
  }

  function toggle(liste: number[], id: number): number[] {
    return liste.includes(id) ? liste.filter((f) => f !== id) : [...liste, id];
  }

  function absenden() {
    if (!entwurf || !partner) return;
    onAction({
      typ: "handel-anbieten",
      angebot: {
        von: ichBin,
        an: partner.id,
        gebeFelder: entwurf.gebeFelder,
        gebeGeld: entwurf.gebeGeld,
        gebeFreiKarten: entwurf.gebeFreiKarten,
        willFelder: entwurf.willFelder,
        willGeld: entwurf.willGeld,
        willFreiKarten: entwurf.willFreiKarten,
      },
    });
    setEntwurf(null);
  }

  function bearbeiten(a: Handelsangebot) {
    onAction({ typ: "handel-ablehnen", angebotId: a.id });
    setEntwurf({
      partnerId: a.an,
      gebeFelder: a.gebeFelder,
      willFelder: a.willFelder,
      gebeGeld: a.gebeGeld,
      willGeld: a.willGeld,
      gebeFreiKarten: a.gebeFreiKarten,
      willFreiKarten: a.willFreiKarten,
    });
  }

  return (
    <div className="trade-panel">
      <h3>Handel</h3>

      {state.offeneAngebote.length === 0 && <p className="trade-leer">Gerade keine offenen Angebote.</p>}
      {state.offeneAngebote.map((a) => {
        const betrifftMich = a.von === ichBin || a.an === ichBin;
        return (
          <div key={a.id} className={`trade-angebot${betrifftMich ? "" : " trade-fremd"}`}>
            <div>
              <strong>{spielerName(a.von)}</strong> → <strong>{spielerName(a.an)}</strong>: gibt {beschreibePaket(a.gebeFelder, a.gebeGeld, a.gebeFreiKarten)}
              , will {beschreibePaket(a.willFelder, a.willGeld, a.willFreiKarten)}
              {a.nachricht && <div className="trade-nachricht">„{a.nachricht}“</div>}
            </div>
            {a.an === ichBin && (
              <div className="trade-aktionen">
                <button onClick={() => onAction({ typ: "handel-annehmen", angebotId: a.id })}>Annehmen</button>
                <button onClick={() => onAction({ typ: "handel-ablehnen", angebotId: a.id })}>Ablehnen</button>
              </div>
            )}
            {a.von === ichBin && (
              <div className="trade-aktionen">
                <button onClick={() => bearbeiten(a)}>Bearbeiten</button>
                <button onClick={() => onAction({ typ: "handel-ablehnen", angebotId: a.id })}>Zurückziehen</button>
              </div>
            )}
          </div>
        );
      })}

      {!entwurf && partnerListe.length > 0 && <button onClick={() => setEntwurf(leererEntwurf(partnerListe[0].id))}>Handel anbieten</button>}

      {entwurf && (
        <div className="trade-formular">
          <label>
            Mit:{" "}
            <select value={entwurf.partnerId} onChange={(ev) => setEntwurf({ ...entwurf, partnerId: ev.target.value })}>
              {partnerListe.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="trade-spalten">
            <div>
              <h4>Ich gebe</h4>
              {eigeneFelder(state, ichBin).map((id) => (
                <label key={id} className="trade-checkbox">
                  <input
                    type="checkbox"
                    checked={entwurf.gebeFelder.includes(id)}
                    onChange={() => setEntwurf({ ...entwurf, gebeFelder: toggle(entwurf.gebeFelder, id) })}
                  />
                  {feldName(id)}
                </label>
              ))}
              <label>
                Geld:{" "}
                <input
                  type="number"
                  min={0}
                  max={ich.geld}
                  value={entwurf.gebeGeld}
                  onChange={(ev) => setEntwurf({ ...entwurf, gebeGeld: Number(ev.target.value) })}
                />
              </label>
              <label>
                Freikarten:{" "}
                <input
                  type="number"
                  min={0}
                  max={ich.freiKarten}
                  value={entwurf.gebeFreiKarten}
                  onChange={(ev) => setEntwurf({ ...entwurf, gebeFreiKarten: Number(ev.target.value) })}
                />
              </label>
            </div>
            <div>
              <h4>Ich will</h4>
              {partner &&
                eigeneFelder(state, partner.id).map((id) => (
                  <label key={id} className="trade-checkbox">
                    <input
                      type="checkbox"
                      checked={entwurf.willFelder.includes(id)}
                      onChange={() => setEntwurf({ ...entwurf, willFelder: toggle(entwurf.willFelder, id) })}
                    />
                    {feldName(id)}
                  </label>
                ))}
              <label>
                Geld: <input type="number" min={0} value={entwurf.willGeld} onChange={(ev) => setEntwurf({ ...entwurf, willGeld: Number(ev.target.value) })} />
              </label>
              <label>
                Freikarten:{" "}
                <input
                  type="number"
                  min={0}
                  value={entwurf.willFreiKarten}
                  onChange={(ev) => setEntwurf({ ...entwurf, willFreiKarten: Number(ev.target.value) })}
                />
              </label>
            </div>
          </div>

          <div className="trade-aktionen">
            <button onClick={absenden} disabled={!partner}>
              Angebot senden
            </button>
            <button onClick={() => setEntwurf(null)}>Abbrechen</button>
          </div>
        </div>
      )}

      {state.handelsVerlauf.length > 0 && (
        <div className="trade-verlauf">
          <button className="trade-verlauf-umschalter" onClick={() => setVerlaufOffen((v) => !v)}>
            Verlauf ({state.handelsVerlauf.length}) {verlaufOffen ? "▲" : "▼"}
          </button>
          {verlaufOffen && (
            <div className="trade-verlauf-liste">
              {[...state.handelsVerlauf].reverse().map((h, i) => (
                <div key={i} className={`trade-verlauf-eintrag trade-verlauf-${h.ergebnis}`}>
                  <strong>{spielerName(h.von)}</strong> → <strong>{spielerName(h.an)}</strong>: {beschreibePaket(h.gebeFelder, h.gebeGeld, h.gebeFreiKarten)}
                  {" ↔ "}
                  {beschreibePaket(h.willFelder, h.willGeld, h.willFreiKarten)} — {h.ergebnis}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
