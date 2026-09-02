/**
 * Der regelbasierte Gegner (Stufe 2 der Roadmap). Kein LLM — reine Heuristik
 * auf Basis von KiProfil.schwierigkeit. Das hält das Spiel gegen den
 * Computer spielbar, bevor die LLM-Anbindung (Stufe 4) dazukommt; die
 * Bewertungsfunktionen aus bewertung.ts sind so geschrieben, dass sie später
 * unverändert die KiKontext.bewertung für das LLM füllen können.
 *
 * naechsteAktion(state) liefert die nächste Action für den gerade
 * "aktiven" KI-Akteur oder null, wenn gerade ein Mensch dran ist bzw.
 * nichts zu tun ist. Die aufrufende UI ruft das nach jedem dispatch erneut
 * auf (kleine Verzögerung für die Optik) — die Engine selbst blockiert nie.
 */
import { aktiverAkteur } from "./akteur";
import { feldById, gruppeVonFeld, istKaufbar } from "./board";
import { bewerteHandelsangebot, bietGrenze, kaufEntscheidung } from "./bewertung";
import type { Action, GameState, KaufbaresFeld, Spieler, SpielerId, StrassenFeld } from "./types";

function istKi(spieler: Spieler | undefined): spieler is Spieler & { ki: NonNullable<Spieler["ki"]> } {
  return !!spieler && spieler.steuerung === "ki" && !!spieler.ki;
}

/** Reagiert auf ein offenes, an eine KI gerichtetes Handelsangebot — unabhängig von der aktuellen Phase. */
function handelsAntwort(state: GameState): Action | null {
  for (const angebot of state.offeneAngebote) {
    const empfaenger = state.spieler.find((p) => p.id === angebot.an);
    if (!istKi(empfaenger)) continue;
    const annehmen = bewerteHandelsangebot(state, angebot, empfaenger.ki.schwierigkeit);
    return annehmen
      ? { typ: "handel-annehmen", angebotId: angebot.id }
      : { typ: "handel-ablehnen", angebotId: angebot.id, nachricht: "Passt gerade nicht für mich." };
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
  const puffer = schwierigkeit.liquiditaetspuffer * 100;
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

/** Liefert die nächste Action für die KI, die gerade am Zug ist — oder null. */
export function naechsteAktion(state: GameState): Action | null {
  if (state.phase.typ === "spiel-ende") return null;

  const handel = handelsAntwort(state);
  if (handel) return handel;

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
