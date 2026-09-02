import { standardBrett } from "./board";
import { ereignisKarten, gemeinschaftKarten } from "./karten";
import { mische } from "./rng";
import type { Besitzstand, Brett, GameState, KiProfil, Spieler, SpielerId } from "./types";

export interface Spielerkonfiguration {
  id: SpielerId;
  name: string;
  farbe: string;
  steuerung: "mensch" | "ki";
  ki?: KiProfil;
}

export interface SpielkonfigurationOptionen {
  spieler: Spielerkonfiguration[];
  brett?: Brett;
  startgeld?: number;
  seed?: string;
}

/** Vorgefertigte Standard-Schwierigkeitsgrade — Zahlen für die Bewertungsfunktion, kein Prompt-Material. */
export const schwierigkeitsGrade = {
  leicht: {
    bewertungstiefe: 0.2,
    liquiditaetspuffer: 1.0,
    blockierneigung: 0.1,
    handelsmarge: 0.9,
    fehlerquote: 0.35,
    risikobereitschaft: 0.2,
    baufreude: 0.3,
  },
  mittel: {
    bewertungstiefe: 0.6,
    liquiditaetspuffer: 1.5,
    blockierneigung: 0.4,
    handelsmarge: 1.05,
    fehlerquote: 0.12,
    risikobereitschaft: 0.5,
    baufreude: 0.55,
  },
  schwer: {
    bewertungstiefe: 1.0,
    liquiditaetspuffer: 2.0,
    blockierneigung: 0.75,
    handelsmarge: 1.2,
    fehlerquote: 0.02,
    risikobereitschaft: 0.8,
    baufreude: 0.8,
  },
} as const satisfies Record<string, KiProfil["schwierigkeit"]>;

function zufallsSeed(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Baut aus einer Spielerliste + Brett einen validen, frischen GameState. */
export function erzeugeSpiel(optionen: SpielkonfigurationOptionen): GameState {
  const brett = optionen.brett ?? standardBrett;
  const startgeld = optionen.startgeld ?? 1500;
  const seed = optionen.seed ?? zufallsSeed();

  if (optionen.spieler.length < 2) {
    throw new Error("Monopoly braucht mindestens zwei Spieler.");
  }

  const spieler: Spieler[] = optionen.spieler.map((s) => ({
    id: s.id,
    name: s.name,
    farbe: s.farbe,
    position: 0,
    geld: startgeld,
    imGefaengnis: false,
    gefaengnisRunden: 0,
    freiKarten: 0,
    bankrott: false,
    steuerung: s.steuerung,
    ki: s.ki,
  }));

  const besitz: Record<number, Besitzstand> = {};
  for (const feld of brett.felder) {
    if (feld.art === "strasse" || feld.art === "bahnhof" || feld.art === "werk") {
      besitz[feld.id] = { eigentuemer: null, belastet: false, haeuser: 0 };
    }
  }

  const ereignisStapel = mische(
    ereignisKarten.map((k) => k.id),
    seed,
    1,
  );
  const gemeinschaftStapel = mische(
    gemeinschaftKarten.map((k) => k.id),
    seed,
    2,
  );

  return {
    brett,
    spieler,
    reihenfolge: spieler.map((s) => s.id),
    amZug: spieler[0].id,
    besitz,
    haeuserImVorrat: brett.haeuserImVorrat,
    hotelsImVorrat: brett.hotelsImVorrat,
    phase: { typ: "wuerfeln" },
    offeneAngebote: [],
    handelsVerlauf: [],
    frueParkenTopf: 0,
    letzterWurf: null,
    paschInFolge: 0,
    ereignisStapel,
    gemeinschaftStapel,
    log: [
      {
        runde: 1,
        akteur: null,
        text: `Spiel gestartet mit ${spieler.map((s) => s.name).join(", ")}.`,
        sichtbarFuer: "alle",
      },
    ],
    runde: 1,
    seed,
    ziehungsZaehler: 3, // 1 und 2 sind für das Mischen der Stapel verbraucht
  };
}
