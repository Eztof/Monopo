/**
 * Der regelbasierte Gegner (Stufe 2 der Roadmap). Kein LLM — reine Heuristik
 * auf Basis von KiProfil.schwierigkeit. Das hält das Spiel gegen den
 * Computer spielbar, bevor die LLM-Anbindung (Stufe 4) dazukommt; die
 * Bewertungsfunktionen aus bewertung.ts sind so geschrieben, dass sie später
 * unverändert die KiKontext.bewertung für das LLM füllen können.
 *
 * naechsteAktion(state) liefert die nächste Action für das Spiel — entweder
 * eine "nebenbei"-Reaktion (Handel, Chat, Hilfsangebot), die unabhängig davon
 * ist, wer gerade am Zug ist, oder sonst die Zug-Entscheidung des gerade
 * aktiven KI-Akteurs. Liefert null, wenn gerade ein Mensch entscheiden muss.
 * Die aufrufende UI ruft das nach jedem dispatch erneut auf (kleine
 * Verzögerung für die Optik) — die Engine selbst blockiert nie.
 *
 * generiereKiAntwort() ist bewusst als einzelne, leicht austauschbare Funktion
 * isoliert: das ist der Platzhalter, der in Stufe 4 durch einen echten
 * LLM-Aufruf (Persönlichkeit, Chatverlauf, KiKontext) ersetzt wird.
 */
import { aktiverAkteur } from "./akteur";
import { feldById, gruppeVonFeld, istKaufbar } from "./board";
import { bewerteHandelsangebot, bietGrenze, kaufEntscheidung, schaetzeFeldWert } from "./bewertung";
import type { Action, GameState, Handelsangebot, KaufbaresFeld, Spieler, SpielerId, StrassenFeld } from "./types";

type KiSpieler = Spieler & { ki: NonNullable<Spieler["ki"]> };

function istKi(spieler: Spieler | undefined): spieler is KiSpieler {
  return !!spieler && spieler.steuerung === "ki" && !!spieler.ki;
}

/** Gnade wirkt als Multiplikator auf die Handelsmarge: >1 = wählerischer, <1 = großzügiger. */
const GNADE_MARGE: Record<NonNullable<Spieler["ki"]>["gnade"], number> = {
  mitleidend: 0.85,
  normal: 1,
  erbarmungslos: 1.3,
  spielerschonend: 0.85,
};

function gleicheFelder(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

/** Reagiert auf ein offenes, an eine KI gerichtetes Handelsangebot — unabhängig von der aktuellen Phase. */
function handelsAntwort(state: GameState): Action | null {
  for (const angebot of state.offeneAngebote) {
    const empfaenger = state.spieler.find((p) => p.id === angebot.an);
    if (!istKi(empfaenger)) continue;
    const zusatzMarge = GNADE_MARGE[empfaenger.ki.gnade];
    const annehmen = bewerteHandelsangebot(state, angebot, empfaenger.ki.schwierigkeit, zusatzMarge);
    return annehmen
      ? { typ: "handel-annehmen", angebotId: angebot.id }
      : { typ: "handel-ablehnen", angebotId: angebot.id, nachricht: "Passt gerade nicht für mich." };
  }
  return null;
}

/**
 * Gnade-Verhalten: zeichnet sich durch eine offene Schuld ab, dass jemand kurz vor dem Bankrott
 * steht, bietet eine passend eingestellte KI ("mitleidend" jedem, "spielerschonend" gezielt dem
 * Menschen) die Deckungslücke als Geschenk-Handel an (nichts im Gegenzug verlangt).
 */
function hilfsAktion(state: GameState): Action | null {
  if (state.phase.typ !== "schuld-offen") return null;
  const { schuld } = state.phase;
  const beduerftiger = state.spieler.find((p) => p.id === schuld.schuldner);
  if (!beduerftiger || beduerftiger.geld >= schuld.betrag) return null;
  const luecke = schuld.betrag - beduerftiger.geld;

  for (const helfer of state.spieler) {
    if (!istKi(helfer) || helfer.bankrott || helfer.id === beduerftiger.id) continue;
    const gnade = helfer.ki.gnade;
    const hilftDiesemSpieler = gnade === "mitleidend" || (gnade === "spielerschonend" && beduerftiger.steuerung === "mensch");
    if (!hilftDiesemSpieler) continue;
    if (helfer.geld - luecke < 10) continue; // würde sich selbst in Not bringen
    if (state.offeneAngebote.some((a) => a.von === helfer.id && a.an === beduerftiger.id)) continue;
    if (state.handelsVerlauf.some((h) => h.von === helfer.id && h.an === beduerftiger.id && h.ergebnis === "abgelehnt")) continue;
    return {
      typ: "handel-anbieten",
      angebot: {
        von: helfer.id,
        an: beduerftiger.id,
        gebeFelder: [],
        gebeGeld: luecke,
        gebeFreiKarten: 0,
        willFelder: [],
        willGeld: 0,
        willFreiKarten: 0,
        nachricht: "Hier, damit das Spiel weitergeht.",
      },
    };
  }
  return null;
}

/** Platzhalter, solange kein LLM angebunden ist (siehe App.tsx: findeUnbeantworteteNachricht + llm.ts). */
export function generiereKiAntwort(): string {
  const antworten = [
    "Interessant. Lass mich kurz überlegen.",
    "Kommt drauf an, was du mir bietest.",
    "Ich behalte das im Hinterkopf.",
    "Gerade sieht es für mich anders aus, aber frag ruhig nochmal.",
    "Reden kostet nichts — verhandeln wir doch über einen Handel.",
  ];
  return antworten[Math.floor(Math.random() * antworten.length)];
}

/**
 * Sucht die jeweils letzte unbeantwortete private Chatnachricht an eine KI — unabhängig davon,
 * ob die Antwort dann von einem LLM (App.tsx) oder von generiereKiAntwort() (Platzhalter) kommt.
 */
export function findeUnbeantworteteNachricht(state: GameState): { ki: KiSpieler; partnerId: SpielerId } | null {
  for (const akteur of state.spieler) {
    if (!istKi(akteur)) continue;
    let partnerId: SpielerId | null = null;
    for (let i = state.log.length - 1; i >= 0; i--) {
      const e = state.log[i];
      if (e.art !== "chat" || !Array.isArray(e.sichtbarFuer) || !e.sichtbarFuer.includes(akteur.id)) continue;
      if (e.akteur && e.akteur !== akteur.id) partnerId = e.akteur;
      break; // die jeweils letzte Chatnachricht dieses Threads entscheidet
    }
    if (partnerId) return { ki: akteur, partnerId };
  }
  return null;
}

/** Der private Chatverlauf zwischen einer KI und einem Partner, fürs LLM als Nachrichtenliste. */
export function baueChatVerlauf(state: GameState, kiId: SpielerId, partnerId: SpielerId): Array<{ rolle: "user" | "assistant"; text: string }> {
  return state.log
    .filter((e) => e.art === "chat" && Array.isArray(e.sichtbarFuer) && e.sichtbarFuer.includes(kiId) && e.sichtbarFuer.includes(partnerId))
    .map((e) => ({ rolle: e.akteur === kiId ? ("assistant" as const) : ("user" as const), text: e.text }));
}

/** Straßen/Bahnhöfe/Werke eines Spielers als Namensliste — fürs Grounding im LLM-Prompt. */
function listeBesitz(state: GameState, spielerId: SpielerId): string {
  const namen = state.brett.felder.filter((f) => istKaufbar(f) && state.besitz[f.id].eigentuemer === spielerId).map((f) => f.name);
  return namen.length ? namen.join(", ") : "noch nichts";
}

/**
 * System-Prompt fürs LLM: Persönlichkeit statt Spielregeln — die Engine entscheidet, das Modell
 * redet nur. Enthält den echten Spielstand (Besitz/Geld beider Seiten), sonst erfindet das Modell
 * mangels Information Straßennamen und Beträge, die es im Spiel gar nicht gibt.
 */
export function baueChatSystemPrompt(state: GameState, ki: KiSpieler, partner: Spieler | undefined): string {
  const p = ki.ki.persoenlichkeit;
  // Wichtig: Spielernamen sind frei wählbar und können zufällig wie Pronomen aussehen (der Standard-
  // Menschname im Setup ist sogar wörtlich "Du"!). Deshalb NIE bloß den Namen hinschreiben, sondern
  // an jeder Stelle die Rolle in Großbuchstaben dranhängen — sonst verwechselt das Modell, wer von
  // beiden "du" (die KI-Figur) ist und wer der Gesprächspartner.
  const duLabel = `${ki.name} (DAS BIST DU)`;
  const gegenueberLabel = partner ? `${partner.name} (DEIN GESPRÄCHSPARTNER, NICHT DU)` : "deinem Gesprächspartner";
  return [
    `Du BIST "${p.name}", eine echte Person in einer laufenden Monopoly-Partie, und chattest gerade mit ${gegenueberLabel}.`,
    `Deine Persönlichkeit: ${p.beschreibung}`,
    `Echter aktueller Spielstand: ${duLabel} hat ${ki.geld} Spielgeld und besitzt: ${listeBesitz(state, ki.id)}.`,
    partner ? `${gegenueberLabel} hat ${partner.geld} Spielgeld und besitzt: ${listeBesitz(state, partner.id)}.` : "",
    partner
      ? `Verwechsle die beiden nicht: Wenn du über Geld oder Besitz sprichst, ist ${duLabel} = deine eigenen Werte, ${gegenueberLabel} = die Werte der anderen Person — auch wenn der Name zufällig wie ein Pronomen klingt.`
      : "",
    "Beziehe dich, wenn passend, auf diesen tatsächlichen Spielstand. Erfinde KEINE Straßennamen, Beträge oder Besitztümer, die hier nicht genannt sind.",
    `Bleib IMMER in dieser Rolle. Erwähne niemals, dass du eine KI, ein Sprachmodell, ein Chatbot oder eine Simulation bist — auch nicht in der Art "Ich bin die KI, die ${p.name} simuliert". Kein Meta-Kommentar, keine Erklärung deiner Antwort, keine Anführungszeichen um die eigene Rede, kein Ausstieg aus der Szene. Antworte direkt, ausschließlich als diese Person, so wie sie es selbst sagen würde.`,
    "Antworte kurz (ein bis drei Sätze), im Charakter, auf Deutsch.",
    "Du entscheidest hier NICHT über Käufe, Bauen oder Handel — das läuft automatisch in der Spiel-Engine. Hier chattest du nur; wenn du einen Handel vorschlagen willst, sag es in Worten, das eigentliche Angebot macht die Engine separat.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Ein Handelspaket als Text ("Ahornallee, 50 Spielgeld") — fürs Grounding im Handelskommentar. */
function beschreibePaket(state: GameState, felder: number[], geld: number, freiKarten: number): string {
  const teile = [
    ...felder.map((id) => feldById(state.brett, id).name),
    geld > 0 ? `${geld} Spielgeld` : "",
    freiKarten > 0 ? `${freiKarten} Freikarte(n)` : "",
  ].filter(Boolean);
  return teile.length ? teile.join(", ") : "nichts";
}

/**
 * Sucht einen Handel, den eine KI noch per Chat kommentieren sollte — nur, wenn ein Mensch beteiligt
 * ist (Kommentare zwischen zwei Bots sähe ohnehin niemand). Bevorzugt den zuletzt abgeschlossenen
 * Handel; ist der schon kommentiert (oder betrifft er keine KI/keinen Menschen), wird stattdessen
 * nach einem noch unkommentierten eigenen Vorschlag der KI gesucht. `kommentiert` verhindert, dass
 * derselbe Handel mehrfach kommentiert wird — der Aufrufer (App.tsx) trägt die ID dort ein.
 */
export function findeUnkommentiertenHandel(
  state: GameState,
  kommentiert: ReadonlySet<string>,
): { ki: KiSpieler; partnerId: SpielerId; angebot: Handelsangebot; ergebnis: "vorschlag" | "angenommen" | "abgelehnt" } | null {
  const letzterHandel = state.handelsVerlauf.at(-1);
  if (letzterHandel && !kommentiert.has(letzterHandel.id)) {
    const von = state.spieler.find((p) => p.id === letzterHandel.von);
    const an = state.spieler.find((p) => p.id === letzterHandel.an);
    if (istKi(von) && an?.steuerung === "mensch") return { ki: von, partnerId: letzterHandel.an, angebot: letzterHandel, ergebnis: letzterHandel.ergebnis };
    if (istKi(an) && von?.steuerung === "mensch") return { ki: an, partnerId: letzterHandel.von, angebot: letzterHandel, ergebnis: letzterHandel.ergebnis };
  }
  for (const angebot of state.offeneAngebote) {
    if (kommentiert.has(angebot.id)) continue;
    const von = state.spieler.find((p) => p.id === angebot.von);
    const an = state.spieler.find((p) => p.id === angebot.an);
    if (istKi(von) && an?.steuerung === "mensch") return { ki: von, partnerId: angebot.an, angebot, ergebnis: "vorschlag" };
  }
  return null;
}

/** Prompt fürs Kommentieren eines Handels — dieselbe Grounding-Basis wie der normale Chat-Prompt. */
export function baueHandelKommentarPrompt(
  state: GameState,
  ki: KiSpieler,
  partner: Spieler | undefined,
  angebot: Handelsangebot,
  ergebnis: "vorschlag" | "angenommen" | "abgelehnt",
): Array<{ rolle: "system" | "user"; text: string }> {
  const gibt = beschreibePaket(state, angebot.gebeFelder, angebot.gebeGeld, angebot.gebeFreiKarten);
  const will = beschreibePaket(state, angebot.willFelder, angebot.willGeld, angebot.willFreiKarten);
  // Dieselbe Vorsicht wie im Chat-Prompt: nie bloß den Namen, immer mit Rollen-Label — sonst kann
  // "Lisa bietet" mit "Du bietest" verwechselt werden, wenn Lisa zufällig so heißt wie ein Pronomen.
  const duLabel = `${ki.name} (DAS BIST DU)`;
  const gegenueberLabel = `${partner?.name ?? "dein Gesprächspartner"} (DEIN GESPRÄCHSPARTNER, NICHT DU)`;
  const perspektive = angebot.von === ki.id ? `${duLabel} bietest` : `${gegenueberLabel} bietet`;
  const ergebnisText = {
    vorschlag: "Das ist gerade als Vorschlag offen, noch nicht angenommen oder abgelehnt.",
    angenommen: "Dieser Handel wurde soeben angenommen.",
    abgelehnt: "Dieser Handel wurde soeben abgelehnt.",
  }[ergebnis];
  return [
    { rolle: "system", text: baueChatSystemPrompt(state, ki, partner) },
    {
      rolle: "user",
      text: `(Systemhinweis, keine echte Nachricht von ${gegenueberLabel}: ${perspektive} "${gibt}" für "${will}". ${ergebnisText} Kommentiere das kurz und im Charakter.)`,
    },
  ];
}

/** Beantwortet die jeweils letzte unbeantwortete private Nachricht an eine KI (Platzhalter-Fallback ohne LLM). */
function chatAntwort(state: GameState): Action | null {
  const ziel = findeUnbeantworteteNachricht(state);
  if (!ziel) return null;
  return { typ: "chat", von: ziel.ki.id, an: ziel.partnerId, text: generiereKiAntwort() };
}

/** Eine KI schlägt selbst einen Handel vor, um eine Farbgruppe zu vervollständigen. */
function initiativeAktion(state: GameState): Action | null {
  if (state.phase.typ === "auktion" || state.phase.typ === "spiel-ende") return null;
  for (const ki of state.spieler) {
    if (!istKi(ki) || ki.bankrott) continue;
    for (const gruppe of state.brett.gruppen) {
      const eigene = gruppe.felder.filter((fid) => state.besitz[fid].eigentuemer === ki.id);
      if (eigene.length === 0 || eigene.length === gruppe.felder.length) continue;
      const fehlende = gruppe.felder.filter((fid) => state.besitz[fid].eigentuemer !== ki.id);
      const besitzer = new Set(fehlende.map((fid) => state.besitz[fid].eigentuemer));
      if (besitzer.size !== 1 || besitzer.has(null)) continue;
      const partnerId = [...besitzer][0] as SpielerId;
      const partner = state.spieler.find((p) => p.id === partnerId);
      if (!partner || partner.bankrott) continue;
      if (state.offeneAngebote.some((a) => a.von === ki.id && a.an === partnerId)) continue;
      if (state.handelsVerlauf.some((h) => h.von === ki.id && h.an === partnerId && h.ergebnis === "abgelehnt" && gleicheFelder(h.willFelder, fehlende)))
        continue;

      const wert = fehlende.reduce((summe, fid) => summe + schaetzeFeldWert(state, ki.id, feldById(state.brett, fid) as KaufbaresFeld), 0);
      const puffer = ki.ki.schwierigkeit.liquiditaetspuffer * 100 * (1 - ki.ki.schwierigkeit.risikobereitschaft * 0.6);
      const angebot = Math.round(wert * ki.ki.schwierigkeit.handelsmarge);
      if (angebot <= 0 || angebot > ki.geld - puffer) continue;

      return {
        typ: "handel-anbieten",
        angebot: {
          von: ki.id,
          an: partnerId,
          gebeFelder: [],
          gebeGeld: angebot,
          gebeFreiKarten: 0,
          willFelder: fehlende,
          willGeld: 0,
          willFreiKarten: 0,
          nachricht: "Ich würde dir dafür etwas bieten.",
        },
      };
    }
  }
  return null;
}

function findeVerkaufbaresHaus(state: GameState, spielerId: SpielerId): Action | null {
  let bestes: { feld: StrassenFeld; haeuser: number } | null = null;
  for (const feld of state.brett.felder) {
    if (feld.art !== "strasse") continue;
    const bes = state.besitz[feld.id];
    if (bes.eigentuemer !== spielerId || bes.haeuser === 0) continue;
    const gruppe = gruppeVonFeld(state.brett, feld.id)!;
    const maxInGruppe = Math.max(...gruppe.felder.map((fid) => state.besitz[fid].haeuser));
    if (bes.haeuser !== maxInGruppe) continue; // Baustopp-Regel: nur vom höchsten Stand verkaufen
    if (!bestes || bes.haeuser > bestes.haeuser) bestes = { feld, haeuser: bes.haeuser };
  }
  return bestes ? { typ: "haus-verkaufen", feld: bestes.feld.id } : null;
}

function findeHypothekOption(state: GameState, spielerId: SpielerId): Action | null {
  for (const feld of state.brett.felder) {
    if (!istKaufbar(feld)) continue;
    const bes = state.besitz[feld.id];
    if (bes.eigentuemer !== spielerId || bes.belastet) continue;
    if (feld.art === "strasse" && bes.haeuser > 0) continue;
    return { typ: "hypothek-aufnehmen", feld: feld.id };
  }
  return null;
}

function baueEntscheidung(state: GameState, spielerId: SpielerId, schwierigkeit: NonNullable<Spieler["ki"]>["schwierigkeit"]): Action | null {
  const spieler = state.spieler.find((p) => p.id === spielerId)!;
  // Baufreude schrumpft den nötigen Puffer — eine baufreudige KI baut auch mal auf Kante.
  const puffer = schwierigkeit.liquiditaetspuffer * 100 * (1 - schwierigkeit.baufreude * 0.6);
  let beste: { feld: StrassenFeld; kosten: number } | null = null;
  for (const feld of state.brett.felder) {
    if (feld.art !== "strasse") continue;
    const bes = state.besitz[feld.id];
    if (bes.eigentuemer !== spielerId || bes.belastet || bes.haeuser >= 5) continue;
    const gruppe = gruppeVonFeld(state.brett, feld.id)!;
    const vollstaendig = gruppe.felder.every((fid) => state.besitz[fid].eigentuemer === spielerId && !state.besitz[fid].belastet);
    if (!vollstaendig) continue;
    if (bes.haeuser < 4) {
      const minInGruppe = Math.min(...gruppe.felder.map((fid) => state.besitz[fid].haeuser));
      if (bes.haeuser !== minInGruppe) continue;
    } else if (!gruppe.felder.every((fid) => state.besitz[fid].haeuser === 4)) {
      continue;
    }
    if (spieler.geld - feld.hauspreis < puffer) continue;
    if (!beste || feld.hauspreis < beste.kosten) beste = { feld, kosten: feld.hauspreis };
  }
  return beste ? { typ: "haus-bauen", feld: beste.feld.id } : null;
}

/** Liefert die nächste Action im Spiel — eine Nebenbei-Reaktion oder die Zug-Entscheidung der aktiven KI. */
export function naechsteAktion(state: GameState): Action | null {
  if (state.phase.typ === "spiel-ende") return null;

  const hilfe = hilfsAktion(state);
  if (hilfe) return hilfe;

  const handel = handelsAntwort(state);
  if (handel) return handel;

  const chat = chatAntwort(state);
  if (chat) return chat;

  const initiative = initiativeAktion(state);
  if (initiative) return initiative;

  const akteurId = aktiverAkteur(state);
  const akteur = state.spieler.find((p) => p.id === akteurId);
  if (!istKi(akteur)) return null;
  const schwierigkeit = akteur.ki.schwierigkeit;

  switch (state.phase.typ) {
    case "gefaengnis-entscheidung":
      if (akteur.freiKarten > 0) return { typ: "frei-karte-nutzen" };
      if (akteur.gefaengnisRunden < 2 && Math.random() < schwierigkeit.bewertungstiefe * 0.3 && akteur.geld >= state.brett.gefaengnisKaution * 3) {
        return { typ: "kaution-zahlen" };
      }
      return { typ: "wuerfeln" };

    case "wuerfeln":
      return { typ: "wuerfeln" };

    case "karte-bestaetigen":
      return { typ: "weiter" };

    case "kaufentscheidung": {
      const feld = feldById(state.brett, state.phase.feld) as KaufbaresFeld;
      const { kaufen } = kaufEntscheidung(state, akteurId, feld, schwierigkeit);
      return kaufen ? { typ: "kaufen" } : { typ: "auktion-starten" };
    }

    case "auktion": {
      const feld = feldById(state.brett, state.phase.auktion.feld) as KaufbaresFeld;
      const grenze = bietGrenze(state, akteurId, feld, schwierigkeit);
      const naechstesGebot = state.phase.auktion.hoechstgebot + Math.max(10, Math.round(feld.kaufpreis * 0.05));
      if (naechstesGebot <= grenze) return { typ: "bieten", betrag: naechstesGebot };
      return { typ: "aussteigen" };
    }

    case "schuld-offen": {
      const { schuld } = state.phase;
      if (akteur.geld >= schuld.betrag) return { typ: "schuld-begleichen" };
      return findeVerkaufbaresHaus(state, akteurId) ?? findeHypothekOption(state, akteurId) ?? { typ: "bankrott-erklaeren" };
    }

    case "zug-ende":
      return baueEntscheidung(state, akteurId, schwierigkeit) ?? { typ: "zug-beenden" };

    default:
      return null;
  }
}
