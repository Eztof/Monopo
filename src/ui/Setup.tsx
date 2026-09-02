import { useState } from "react";
import { schwierigkeitsGrade, type Spielerkonfiguration } from "../engine/state";
import type { KiProfil } from "../engine/types";

type Schwierigkeit = keyof typeof schwierigkeitsGrade;
type Gnade = KiProfil["gnade"];

interface SpielerEntwurf {
  name: string;
  farbe: string;
  steuerung: "mensch" | "ki";
  schwierigkeit: Schwierigkeit;
  persoenlichkeit: string;
  // Eigene Regler, per Voreinstellung befüllt, aber unabhängig verstellbar — das sind die
  // Einstellungen, die tatsächlich das Verhalten der KI verändern (siehe bewertung.ts/bot.ts).
  risikobereitschaft: number;
  handelsschlaeue: number;
  baufreude: number;
  gnade: Gnade;
}

const farben = ["#e6462f", "#2f7fe6", "#2fa64d", "#e6c02f", "#a64de6", "#2fc0c0"];

function neuerEntwurf(name: string, farbe: string, steuerung: "mensch" | "ki", schwierigkeit: Schwierigkeit = "mittel"): SpielerEntwurf {
  const preset = schwierigkeitsGrade[schwierigkeit];
  return {
    name,
    farbe,
    steuerung,
    schwierigkeit,
    persoenlichkeit: "",
    risikobereitschaft: preset.risikobereitschaft,
    handelsschlaeue: preset.handelsmarge,
    baufreude: preset.baufreude,
    gnade: "normal",
  };
}

const standard: SpielerEntwurf[] = [
  neuerEntwurf("Du", farben[0], "mensch"),
  { ...neuerEntwurf("Computer", farben[1], "ki"), persoenlichkeit: "Nüchtern und fair." },
];

const gnadeBeschreibung: Record<Gnade, string> = {
  mitleidend: "Hilft jedem, der kurz vor dem Bankrott steht",
  normal: "Greift nicht proaktiv ein",
  erbarmungslos: "Verhandelt zusätzlich härter, hilft nie",
  spielerschonend: "Bewahrt gezielt dich vorm Bankrott",
};

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

  function schwierigkeitWechseln(i: number, schwierigkeit: Schwierigkeit) {
    const preset = schwierigkeitsGrade[schwierigkeit];
    aktualisiere(i, {
      schwierigkeit,
      risikobereitschaft: preset.risikobereitschaft,
      handelsschlaeue: preset.handelsmarge,
      baufreude: preset.baufreude,
    });
  }

  function hinzufuegen() {
    if (entwuerfe.length >= 6) return;
    const i = entwuerfe.length;
    setEntwuerfe((liste) => [...liste, neuerEntwurf(`Spieler ${i + 1}`, farben[i % farben.length], "ki")]);
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
              schwierigkeit: {
                ...schwierigkeitsGrade[e.schwierigkeit],
                risikobereitschaft: e.risikobereitschaft,
                handelsmarge: e.handelsschlaeue,
                baufreude: e.baufreude,
              },
              persoenlichkeit: {
                name: e.name.trim(),
                beschreibung: e.persoenlichkeit || "Spielt neutral, ohne besondere Note.",
                beziehungen: {},
              },
              gnade: e.gnade,
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
            <div className="spieler-karte-zeile">
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
              <button className="entfernen" onClick={() => entfernen(i)} disabled={entwuerfe.length <= 2} title="Entfernen">
                ✕
              </button>
            </div>

            {e.steuerung === "ki" && (
              <div className="ki-einstellungen">
                <div className="ki-einstellungen-zeile">
                  <label>
                    Schwierigkeit:{" "}
                    <select value={e.schwierigkeit} onChange={(ev) => schwierigkeitWechseln(i, ev.target.value as Schwierigkeit)}>
                      <option value="leicht">Leicht</option>
                      <option value="mittel">Mittel</option>
                      <option value="schwer">Schwer</option>
                    </select>
                  </label>
                  <label>
                    Gnade:{" "}
                    <select value={e.gnade} onChange={(ev) => aktualisiere(i, { gnade: ev.target.value as Gnade })}>
                      <option value="mitleidend">Mitleidend</option>
                      <option value="normal">Normal</option>
                      <option value="erbarmungslos">Erbarmungslos</option>
                      <option value="spielerschonend">Spielerschonend</option>
                    </select>
                  </label>
                </div>
                <p className="gnade-hinweis">{gnadeBeschreibung[e.gnade]}</p>

                <label className="regler">
                  Risikobereitschaft ({Math.round(e.risikobereitschaft * 100)}%)
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={e.risikobereitschaft}
                    onChange={(ev) => aktualisiere(i, { risikobereitschaft: Number(ev.target.value) })}
                  />
                </label>
                <label className="regler">
                  Handelsschläue ({e.handelsschlaeue.toFixed(2)}×)
                  <input
                    type="range"
                    min={0.7}
                    max={1.5}
                    step={0.05}
                    value={e.handelsschlaeue}
                    onChange={(ev) => aktualisiere(i, { handelsschlaeue: Number(ev.target.value) })}
                  />
                </label>
                <label className="regler">
                  Haus/Hotel-Baufreude ({Math.round(e.baufreude * 100)}%)
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={e.baufreude}
                    onChange={(ev) => aktualisiere(i, { baufreude: Number(ev.target.value) })}
                  />
                </label>
                <input
                  type="text"
                  value={e.persoenlichkeit}
                  onChange={(ev) => aktualisiere(i, { persoenlichkeit: ev.target.value })}
                  placeholder="Persönlichkeit (Notiz, für die spätere LLM-Anbindung)"
                  maxLength={80}
                />
              </div>
            )}
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
