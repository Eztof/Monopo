/**
 * Monopoly-Engine — Kern-Datenmodell
 *
 * Grundsatz: Der GameState ist die einzige Wahrheit. Die Engine ist eine reine
 * Funktion (state, action) => state. Kein setTimeout, keine Schleife, kein await.
 * Alles Asynchrone (LLM-Antworten, Animationen, Klicks) landet als Action von außen.
 *
 * Brett und Namen sind Konfiguration, keine Konstanten — damit ist das Spiel
 * ohne Hasbro-Markennamen veröffentlichbar.
 */

// ────────────────────────────────────────────────────────────
// Brett-Konfiguration (statisch, wird einmal geladen)
// ────────────────────────────────────────────────────────────

export type FeldId = number; // 0..39 bei Standardbrett
export type SpielerId = string;
export type GruppenId = string; // "braun", "hellblau", ...

export interface Farbgruppe {
  id: GruppenId;
  name: string;
  farbe: string; // Hex, nur für die UI
  felder: FeldId[];
}

interface FeldBasis {
  id: FeldId;
  name: string;
}

export interface StrassenFeld extends FeldBasis {
  art: "strasse";
  gruppe: GruppenId;
  kaufpreis: number;
  hypothekenwert: number;
  hauspreis: number;
  /** Index 0 = unbebaut, 1..4 = Häuser, 5 = Hotel */
  mieten: [number, number, number, number, number, number];
}

export interface BahnhofFeld extends FeldBasis {
  art: "bahnhof";
  kaufpreis: number;
  hypothekenwert: number;
  /** Miete nach Anzahl Bahnhöfe im Besitz: [1, 2, 3, 4] */
  mieten: [number, number, number, number];
}

export interface WerkFeld extends FeldBasis {
  art: "werk";
  kaufpreis: number;
  hypothekenwert: number;
  /** Multiplikator auf den Würfelwurf, je nach Anzahl Werke */
  multiplikatoren: [number, number];
}

export interface SteuerFeld extends FeldBasis {
  art: "steuer";
  betrag: number;
  /** Optional: Wahlmöglichkeit prozentual vom Vermögen (Einkommensteuer) */
  alternativProzent?: number;
}

export interface KartenFeld extends FeldBasis {
  art: "karte";
  stapel: "ereignis" | "gemeinschaft";
}

export interface NeutralFeld extends FeldBasis {
  art: "los" | "frei-parken" | "gefaengnis-besuch" | "gehe-ins-gefaengnis";
}

export type Feld =
  | StrassenFeld
  | BahnhofFeld
  | WerkFeld
  | SteuerFeld
  | KartenFeld
  | NeutralFeld;

/** Alles, was einen Besitzer haben kann */
export type KaufbaresFeld = StrassenFeld | BahnhofFeld | WerkFeld;

export interface Brett {
  name: string;
  waehrung: string;
  felder: Feld[];
  gruppen: Farbgruppe[];
  losGehalt: number;
  gefaengnisFeld: FeldId;
  gefaengnisKaution: number;
  /** Häuser/Hotels sind begrenzt — das ist eine echte strategische Regel */
  haeuserImVorrat: number; // klassisch 32
  hotelsImVorrat: number; // klassisch 12
}

// ────────────────────────────────────────────────────────────
// Karten
// ────────────────────────────────────────────────────────────

export type Karteneffekt =
  | { typ: "geld"; betrag: number } // negativ = zahlen
  | { typ: "geld-von-allen"; betrag: number }
  | { typ: "ziehe-zu"; ziel: FeldId; losGehaltWennVorbei: boolean }
  | { typ: "ziehe-relativ"; felder: number }
  | { typ: "ins-gefaengnis" }
  | { typ: "frei-karte" }
  | { typ: "reparaturen"; proHaus: number; proHotel: number }
  | { typ: "ziehe-zum-naechsten"; art: "bahnhof" | "werk"; mieteFaktor: number };

export interface Karte {
  id: string;
  stapel: "ereignis" | "gemeinschaft";
  text: string;
  effekt: Karteneffekt;
  /** Frei-Karten wandern in den Spielerbesitz statt unter den Stapel */
  behaltbar?: boolean;
}

// ────────────────────────────────────────────────────────────
// Laufender Spielstand
// ────────────────────────────────────────────────────────────

export interface Besitzstand {
  eigentuemer: SpielerId | null;
  belastet: boolean; // Hypothek aufgenommen
  /** 0..4 Häuser, 5 = Hotel. Nur bei Straßen relevant. */
  haeuser: 0 | 1 | 2 | 3 | 4 | 5;
}

export interface Spieler {
  id: SpielerId;
  name: string;
  farbe: string;
  position: FeldId;
  geld: number;
  imGefaengnis: boolean;
  gefaengnisRunden: number; // 0..3
  freiKarten: number;
  bankrott: boolean;
  steuerung: "mensch" | "ki";
  /** Nur bei steuerung === "ki" */
  ki?: KiProfil;
}

/**
 * Der Phasen-Automat. Das ist das Rückgrat: Auktionen, Schuldenregulierung und
 * KI-Bedenkzeit sind alles Zustände, in denen das Spiel wartet — keine Aufrufe,
 * die mitten im Zug blockieren.
 */
export type Phase =
  | { typ: "wuerfeln" }
  | { typ: "gefaengnis-entscheidung" }
  | { typ: "karte-bestaetigen"; karte: Karte }
  | { typ: "kaufentscheidung"; feld: FeldId }
  | { typ: "auktion"; auktion: Auktion }
  | { typ: "schuld-offen"; schuld: Schuld }
  | { typ: "zug-ende" }
  | { typ: "spiel-ende"; sieger: SpielerId };

/**
 * Ein Handel unterbricht keine Phase, er liegt daneben. Angenommen oder
 * abgelehnt macht das Spiel dort weiter, wo es stand.
 */
export interface Handelsangebot {
  id: string;
  von: SpielerId;
  an: SpielerId;
  gebeFelder: FeldId[];
  gebeGeld: number;
  gebeFreiKarten: number;
  willFelder: FeldId[];
  willGeld: number;
  willFreiKarten: number;
  /** Der Verhandlungstext — vom Menschen getippt oder vom LLM erzeugt */
  nachricht?: string;
  /** Kette von Gegenangeboten, damit die KI den Verlauf sieht */
  vorgaenger?: string;
}

export interface Auktion {
  feld: FeldId;
  hoechstgebot: number;
  hoechstbietender: SpielerId | null;
  /** Wer noch mitbietet — Reihenfolge ist die Bietreihenfolge */
  aktiveBieter: SpielerId[];
  amZug: SpielerId;
}

export interface Schuld {
  schuldner: SpielerId;
  /** null = Bank */
  glaeubiger: SpielerId | null;
  betrag: number;
  grund: string;
  /** Fließt der Betrag bei Begleichung in den Frei-Parken-Topf (Hausregel)? Nur bei glaeubiger === null relevant. */
  anFreiParkenTopf?: boolean;
}

/** Ein abgeschlossener Handel, fürs Nachlesen im Verlauf. */
export interface HandelsVerlaufEintrag extends Handelsangebot {
  ergebnis: "angenommen" | "abgelehnt";
}

export interface GameState {
  brett: Brett;
  spieler: Spieler[];
  reihenfolge: SpielerId[];
  amZug: SpielerId;
  besitz: Record<FeldId, Besitzstand>;
  haeuserImVorrat: number;
  hotelsImVorrat: number;
  phase: Phase;
  offeneAngebote: Handelsangebot[];
  /** Abgeschlossene Handel (angenommen oder abgelehnt), neueste zuletzt. */
  handelsVerlauf: HandelsVerlaufEintrag[];
  /** Hausregel: Steuern und sonstige Zahlungen an die Bank sammeln sich hier, bis jemand auf "Frei Parken" landet. */
  frueParkenTopf: number;
  letzterWurf: [number, number] | null;
  paschInFolge: 0 | 1 | 2;
  ereignisStapel: string[];
  gemeinschaftStapel: string[];
  /** Chronologisch, dient der UI, dem Undo und dem LLM als Gedächtnis */
  log: Ereignis[];
  runde: number;
  seed: string; // reproduzierbarer PRNG statt Math.random
  /** Zählt jede Zufallsziehung hoch — macht (seed, ziehung) -> Zufallswert eindeutig */
  ziehungsZaehler: number;
}

export interface Ereignis {
  runde: number;
  akteur: SpielerId | null;
  text: string;
  /** Für den Chat: wer darf das sehen? Geheime Handelsdetails z.B. nicht alle */
  sichtbarFuer: SpielerId[] | "alle";
  /** "chat" = echte Chatnachricht zwischen zwei Spielern, statt einer System-/Spielmeldung. */
  art?: "chat";
}

// ────────────────────────────────────────────────────────────
// Actions — der einzige Weg, den State zu verändern
// ────────────────────────────────────────────────────────────

export type Action =
  | { typ: "wuerfeln" }
  | { typ: "kaufen" }
  | { typ: "auktion-starten" }
  | { typ: "bieten"; betrag: number }
  | { typ: "aussteigen" }
  | { typ: "haus-bauen"; feld: FeldId }
  | { typ: "haus-verkaufen"; feld: FeldId }
  | { typ: "hypothek-aufnehmen"; feld: FeldId }
  | { typ: "hypothek-abloesen"; feld: FeldId }
  | { typ: "handel-anbieten"; angebot: Omit<Handelsangebot, "id"> }
  | { typ: "handel-annehmen"; angebotId: string }
  | { typ: "handel-ablehnen"; angebotId: string; nachricht?: string }
  | { typ: "kaution-zahlen" }
  | { typ: "frei-karte-nutzen" }
  | { typ: "schuld-begleichen" }
  | { typ: "bankrott-erklaeren" }
  | { typ: "zug-beenden" }
  /** `an` gesetzt = private Nachricht (Einzel-Chat); weggelassen = öffentliche Ansage an alle. */
  | { typ: "chat"; von: SpielerId; an?: SpielerId; text: string }
  /** Bestätigt eine reine Info-Phase (z.B. eine gezogene Karte) und löst deren Effekt aus. */
  | { typ: "weiter" };

/** Die Engine lehnt ungültige Actions ab, statt zu werfen. */
export type ActionErgebnis =
  | { ok: true; state: GameState }
  | { ok: false; grund: string };

// ────────────────────────────────────────────────────────────
// KI-Schnittstelle
// ────────────────────────────────────────────────────────────

export interface KiProfil {
  /** Steuert die Bewertungsfunktion — nicht den Prompt */
  schwierigkeit: {
    /** 0 = kauft blind, 1 = rechnet Erwartungswerte */
    bewertungstiefe: number;
    /** Wie viel Bargeld als Puffer gehalten wird, in Miet-Einheiten */
    liquiditaetspuffer: number;
    /** Bereitschaft, Monopole des Gegners zu verhindern (0..1) */
    blockierneigung: number;
    /** Aufschlag/Abschlag beim Handeln (1.0 = fairer Marktwert) — "Handelsschläue" */
    handelsmarge: number;
    /** Wahrscheinlichkeit für bewusst suboptimale Züge */
    fehlerquote: number;
    /** 0 = ängstlich/konservativ, 1 = geht bis ans Limit (Käufe, Gebote, kleinerer Cash-Puffer) */
    risikobereitschaft: number;
    /** 0 = hortet Bargeld statt zu bauen, 1 = baut sofort bei jeder Gelegenheit aus */
    baufreude: number;
  };
  /** Steuert nur den Text — Ton, Trash Talk, Nachtragendsein */
  persoenlichkeit: {
    name: string;
    beschreibung: string;
    /** SillyTavern Character Card V2, falls importiert */
    kartenDaten?: Record<string, unknown>;
    /** Bleibende Haltung gegenüber Mitspielern, wächst über das Spiel */
    beziehungen: Record<SpielerId, number>; // -1..1
  };
  /**
   * Unabhängig von der Schwierigkeit: wie die KI mit Mitspielern umgeht, die kurz vor dem
   * Bankrott stehen. "spielerschonend" hilft gezielt dem menschlichen Spieler, "mitleidend"
   * jedem in Not, "normal" greift nicht ein, "erbarmungslos" verhandelt zusätzlich härter.
   */
  gnade: "mitleidend" | "normal" | "erbarmungslos" | "spielerschonend";
}

/** Was das LLM zu sehen bekommt — reduziert und ohne verdeckte Info */
export interface KiKontext {
  ichBin: SpielerId;
  rundenNr: number;
  meinGeld: number;
  meinBesitz: Array<{ feld: string; gruppe?: string; haeuser: number; belastet: boolean }>;
  gegner: Array<{ id: SpielerId; name: string; geld: number; besitz: string[] }>;
  /** Vorberechnet von der Engine, nicht vom Modell geschätzt */
  bewertung: {
    empfehlung: KiEntscheidung;
    alternativen: KiEntscheidung[];
    begruendung: string;
  };
  offeneFrage: "kaufen" | "bieten" | "handel-bewerten" | "handel-vorschlagen" | "chat";
  angebot?: Handelsangebot;
  chatVerlauf: Array<{ von: string; text: string }>;
}

/** Was das LLM zurückgeben muss. Wird strikt validiert. */
export type KiEntscheidung =
  | { aktion: "kaufen"; nachricht?: string }
  | { aktion: "ablehnen"; nachricht?: string }
  | { aktion: "bieten"; betrag: number; nachricht?: string }
  | { aktion: "annehmen"; nachricht?: string }
  | { aktion: "gegenangebot"; angebot: Omit<Handelsangebot, "id" | "von">; nachricht?: string }
  | { aktion: "nur-reden"; nachricht: string };
