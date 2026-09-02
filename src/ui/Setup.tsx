import { useState } from "react";
import { schwierigkeitsGrade, type Spielerkonfiguration } from "../engine/state";

type Schwierigkeit = keyof typeof schwierigkeitsGrade;

interface SpielerEntwurf {
  name: string;
  farbe: string;
  steuerung: "mensch" | "ki";
  schwierigkeit: Schwierigkeit;
  persoenlichkeit: string;
}

const farben = ["#e6462f", "#2f7fe6", "#2fa64d", "#e6c02f", "#a64de6", "#2fc0c0"];

const standard: SpielerEntwurf[] = [
  { name: "Du", farbe: farben[0], steuerung: "mensch", schwierigkeit: "mittel", persoenlichkeit: "" },
  { name: "Computer", farbe: farben[1], steuerung: "ki", schwierigkeit: "mittel", persoenlichkeit: "Nüchtern und fair." },
];

export interface SetupErgebnis {
  spieler: Spielerkonfiguration[];
  seed?: string;
}

export function Setup({ onStart }: { onStart: (ergebnis: SetupErgebnis) => void }) {
  const [entwuerfe, setEntwuerfe] = useState<SpielerEntwurf[]>(standard);
  const [seed, setSeed] = useState("");

  function aktualisiere(i: number, patch: Partial<SpielerEntwurf>) {
    setEntwuerfe((liste) => liste.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  function hinzufuegen() {
    if (entwuerfe.length >= 6) return;
    const i = entwuerfe.length;
    setEntwuerfe((liste) => [
      ...liste,
      { name: `Spieler ${i + 1}`, farbe: farben[i % farben.length], steuerung: "ki", schwierigkeit: "mittel", persoenlichkeit: "" },
    ]);
  }

  function entfernen(i: number) {
    if (entwuerfe.length <= 2) return;
    setEntwuerfe((liste) => liste.filter((_, idx) => idx !== i));
  }

  function starten() {
    const namen = entwuerfe.map((e) => e.name.trim());
    if (namen.some((n) => !n) || new Set(namen).size !== namen.length) {
      alert("Jeder Spieler braucht einen eindeutigen Namen.");
      return;
    }
    const spieler: Spielerkonfiguration[] = entwuerfe.map((e, i) => ({
      id: `s${i}`,
      name: e.name.trim(),
      farbe: e.farbe,
      steuerung: e.steuerung,
      ki:
        e.steuerung === "ki"
          ? {
              schwierigkeit: schwierigkeitsGrade[e.schwierigkeit],
              persoenlichkeit: {
                name: e.name.trim(),
                beschreibung: e.persoenlichkeit || "Spielt neutral, ohne besondere Note.",
                beziehungen: {},
              },
            }
          : undefined,
    }));
    onStart({ spieler, seed: seed.trim() || undefined });
  }

  return (
    <div className="setup">
      <h1>Monopoly</h1>
      <p className="setup-hinweis">Volle Regeln inkl. Auktionen. Lokal im Browser, gegen Menschen und/oder Computer.</p>

      <div className="spieler-liste">
        {entwuerfe.map((e, i) => (
          <div className="spieler-karte" key={i}>
            <input
              type="color"
              value={e.farbe}
              onChange={(ev) => aktualisiere(i, { farbe: ev.target.value })}
              aria-label="Farbe"
            />
            <input
              type="text"
              value={e.name}
              onChange={(ev) => aktualisiere(i, { name: ev.target.value })}
              placeholder="Name"
              maxLength={20}
            />
            <select value={e.steuerung} onChange={(ev) => aktualisiere(i, { steuerung: ev.target.value as "mensch" | "ki" })}>
              <option value="mensch">Mensch</option>
              <option value="ki">Computer</option>
            </select>
            {e.steuerung === "ki" && (
              <>
                <select
                  value={e.schwierigkeit}
                  onChange={(ev) => aktualisiere(i, { schwierigkeit: ev.target.value as Schwierigkeit })}
                >
                  <option value="leicht">Leicht</option>
                  <option value="mittel">Mittel</option>
                  <option value="schwer">Schwer</option>
                </select>
                <input
                  type="text"
                  value={e.persoenlichkeit}
                  onChange={(ev) => aktualisiere(i, { persoenlichkeit: ev.target.value })}
                  placeholder="Persönlichkeit (Notiz, für später)"
                  maxLength={80}
                />
              </>
            )}
            <button className="entfernen" onClick={() => entfernen(i)} disabled={entwuerfe.length <= 2} title="Entfernen">
              ✕
            </button>
          </div>
        ))}
      </div>

      <button onClick={hinzufuegen} disabled={entwuerfe.length >= 6}>
        + Spieler hinzufügen
      </button>

      <div className="seed-zeile">
        <label>
          Seed (optional, für reproduzierbare Partien):{" "}
          <input type="text" value={seed} onChange={(ev) => setSeed(ev.target.value)} placeholder="zufällig" />
        </label>
      </div>

      <button className="primaer" onClick={starten}>
        Spiel starten
      </button>
    </div>
  );
}
