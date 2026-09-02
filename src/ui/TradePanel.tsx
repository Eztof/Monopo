import { useState } from "react";
import { istKaufbar } from "../engine/board";
import type { Action, GameState, SpielerId } from "../engine/types";

function eigeneFelder(state: GameState, spielerId: SpielerId): number[] {
  return state.brett.felder.filter((f) => istKaufbar(f) && state.besitz[f.id].eigentuemer === spielerId).map((f) => f.id);
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
  const [partnerId, setPartnerId] = useState(partnerListe[0]?.id ?? "");
  const [gebeFelder, setGebeFelder] = useState<number[]>([]);
  const [willFelder, setWillFelder] = useState<number[]>([]);
  const [gebeGeld, setGebeGeld] = useState(0);
  const [willGeld, setWillGeld] = useState(0);
  const [gebeFreiKarten, setGebeFreiKarten] = useState(0);
  const [willFreiKarten, setWillFreiKarten] = useState(0);
  const [offen, setOffen] = useState(false);

  const ich = state.spieler.find((s) => s.id === ichBin)!;
  const partner = state.spieler.find((s) => s.id === partnerId);
  const eingehend = state.offeneAngebote.filter((a) => a.an === ichBin);
  const ausgehend = state.offeneAngebote.filter((a) => a.von === ichBin);

  function feldName(id: number): string {
    return state.brett.felder.find((f) => f.id === id)?.name ?? String(id);
  }

  function toggle(liste: number[], setListe: (v: number[]) => void, id: number) {
    setListe(liste.includes(id) ? liste.filter((f) => f !== id) : [...liste, id]);
  }

  function absenden() {
    if (!partner) return;
    onAction({
      typ: "handel-anbieten",
      angebot: {
        von: ichBin,
        an: partner.id,
        gebeFelder,
        gebeGeld,
        gebeFreiKarten,
        willFelder,
        willGeld,
        willFreiKarten,
      },
    });
    setGebeFelder([]);
    setWillFelder([]);
    setGebeGeld(0);
    setWillGeld(0);
    setGebeFreiKarten(0);
    setWillFreiKarten(0);
    setOffen(false);
  }

  return (
    <div className="trade-panel">
      <h3>Handel</h3>

      {eingehend.map((a) => (
        <div key={a.id} className="trade-angebot">
          <div>
            <strong>{state.spieler.find((s) => s.id === a.von)?.name}</strong> bietet:{" "}
            {[...a.gebeFelder.map(feldName), a.gebeGeld > 0 ? `${a.gebeGeld} Geld` : "", a.gebeFreiKarten > 0 ? `${a.gebeFreiKarten} Freikarte(n)` : ""]
              .filter(Boolean)
              .join(", ") || "nichts"}
            {" für "}
            {[...a.willFelder.map(feldName), a.willGeld > 0 ? `${a.willGeld} Geld` : "", a.willFreiKarten > 0 ? `${a.willFreiKarten} Freikarte(n)` : ""]
              .filter(Boolean)
              .join(", ") || "nichts"}
            {a.nachricht && <div className="trade-nachricht">„{a.nachricht}“</div>}
          </div>
          <div className="trade-aktionen">
            <button onClick={() => onAction({ typ: "handel-annehmen", angebotId: a.id })}>Annehmen</button>
            <button onClick={() => onAction({ typ: "handel-ablehnen", angebotId: a.id })}>Ablehnen</button>
          </div>
        </div>
      ))}

      {ausgehend.map((a) => (
        <div key={a.id} className="trade-angebot trade-ausgehend">
          Angebot an {state.spieler.find((s) => s.id === a.an)?.name} läuft…
          <button onClick={() => onAction({ typ: "handel-ablehnen", angebotId: a.id })}>Zurückziehen</button>
        </div>
      ))}

      {!offen && partnerListe.length > 0 && <button onClick={() => setOffen(true)}>Handel anbieten</button>}

      {offen && (
        <div className="trade-formular">
          <label>
            Mit:{" "}
            <select value={partnerId} onChange={(ev) => setPartnerId(ev.target.value)}>
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
                  <input type="checkbox" checked={gebeFelder.includes(id)} onChange={() => toggle(gebeFelder, setGebeFelder, id)} />
                  {feldName(id)}
                </label>
              ))}
              <label>
                Geld: <input type="number" min={0} max={ich.geld} value={gebeGeld} onChange={(ev) => setGebeGeld(Number(ev.target.value))} />
              </label>
              <label>
                Freikarten:{" "}
                <input
                  type="number"
                  min={0}
                  max={ich.freiKarten}
                  value={gebeFreiKarten}
                  onChange={(ev) => setGebeFreiKarten(Number(ev.target.value))}
                />
              </label>
            </div>
            <div>
              <h4>Ich will</h4>
              {partner &&
                eigeneFelder(state, partner.id).map((id) => (
                  <label key={id} className="trade-checkbox">
                    <input type="checkbox" checked={willFelder.includes(id)} onChange={() => toggle(willFelder, setWillFelder, id)} />
                    {feldName(id)}
                  </label>
                ))}
              <label>
                Geld: <input type="number" min={0} value={willGeld} onChange={(ev) => setWillGeld(Number(ev.target.value))} />
              </label>
              <label>
                Freikarten:{" "}
                <input type="number" min={0} value={willFreiKarten} onChange={(ev) => setWillFreiKarten(Number(ev.target.value))} />
              </label>
            </div>
          </div>

          <div className="trade-aktionen">
            <button onClick={absenden} disabled={!partner}>
              Angebot senden
            </button>
            <button onClick={() => setOffen(false)}>Abbrechen</button>
          </div>
        </div>
      )}
    </div>
  );
}
